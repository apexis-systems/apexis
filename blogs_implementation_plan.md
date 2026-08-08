# Replicate the Blog CMS feature into Apexis

## Context

rhinon-cms has a working "blog" content feature: authors create/edit posts in the admin panel (Next.js, TipTap rich editor, S3 image/video upload), and published posts render on the public rhinonlabs marketing site. The user wants the same capability for Apexis — but Apexis is a different codebase with a different shape, spread across three separate local repos:

- **`/Users/rhinon/Desktop/Apexis/apexis/backend`** — Express 5 + TypeScript (native `--experimental-strip-types`, ESM) + Sequelize + Postgres. Existing `/superadmin` API namespace, JWT auth (`verifyToken`/`isSuperAdmin` middleware), S3 already wired up (`@aws-sdk/client-s3`).
- **`/Users/rhinon/Desktop/Apexis/apexis/frontend`** — Next.js 16 App Router. Has a working `/superadmin` dashboard (role-gated layout, sidebar nav, shadcn/Radix/Tailwind UI). This is where blog authoring will live.
- **`/Users/rhinon/Desktop/Apexis/peak-project-flow`** — the actual public Apexis marketing site. Vite + React SPA (client-rendered only, no SSR), `react-router-dom`, shadcn/Tailwind, `@tanstack/react-query` installed but unused. This is where published posts will display, at `/blog` and `/blog/:slug`.

Per user decisions: build the blog feature into **Apexis's own backend/DB** (not a cross-call into rhinon-cms), and wire the **peak-project-flow** site as the public display surface. Nothing blog-related exists in any of these three repos today — this is a from-scratch build that mirrors rhinon-cms's proven pattern (Sequelize model → authenticated CRUD + public read routes → TipTap editor → public renderer), adapted to each repo's existing conventions (snake_case Sequelize fields, sequelize-cli migrations, shadcn components, Vite/client-side fetching).

## Backend (`apexis/backend`)

**Model** — new `backend/models/blogs.ts`, following the `manuals.ts` pattern (`sequelize.define`, `INTEGER` autoincrement PK, `paranoid: true`, snake_case columns):
`title`, `excerpt`, `slug` (unique), `content_blocks` (JSONB, default `[]` — stores `[{ id, type: "paragraph", html }]`, same single-block TipTap contract as rhinon-cms), `faqs` (JSONB, default `[]`), `category`, `meta_title`, `meta_description`, `author_name`, `author_role`, `author_avatar`, `cover_image`, `tags` (`ARRAY(STRING)`), `read_time`, `published_at`, `status` (ENUM `Draft`/`Published`, default `Draft`), `created_by` (INTEGER, nullable → FK to `users`).

Wire the `Blog.belongsTo(users, { as: "author", foreignKey: "created_by" })` association in `backend/models/index.ts` alongside the existing association block (~lines 171-174), and re-export `export const blogs = db.blogs;` — models here are auto-discovered from the directory, so the file itself needs no manual registration.

**Migration** — since `app.ts` has `sequelize.sync()` commented out ("use migrations for production"), add a real `sequelize-cli` migration under `backend/migrations/` (`queryInterface.createTable('blogs', ...)`) matching the model, not just a model edit like rhinon-cms does.

**Controller** — new `backend/controllers/blogController.ts`, mirroring `manualController.ts`'s structure:
- Admin: `listBlogs` (all statuses), `getBlog(id)`, `createBlog`, `updateBlog`, `deleteBlog` (soft delete via `paranoid`). Slug generation: port `slugify()`/`uniqueSlug()` helpers from rhinon-cms's `backend/src/routes/content.ts`.
- Public: `listPublishedBlogs` (`where: { status: "Published" }`, field-allowlisted response, ordered by `published_at DESC`), `getBlogBySlug` (404 if missing/not published).
- Upload: `uploadBlogImage` / `uploadBlogVideo` — multer memory storage + S3 `PutObjectCommand`, same shape as `manualController.ts`'s upload flow, but store the object under a `blogs/` prefix and return a **direct public URL** (`https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`), not a presigned URL — blog media must be publicly viewable on the marketing site, unlike private project files.
  - ⚠️ **Infra note**: the existing `apexis-bucket` pattern serves everything through presigned GETs (private). Making `blogs/*` publicly readable requires either a bucket policy statement scoped to that prefix or a CloudFront distribution in front of it. This is an AWS console/IaC change outside this codebase — flag it to the user before or during implementation, don't silently assume it's already public.

**Routes** — two new files, mirroring rhinon-cms's admin/public split:
- `backend/routes/blogRoutes.ts` — `router.use(verifyToken); router.use(isSuperAdmin);` then CRUD + upload endpoints. Mount at `app.use("/api/blogs", blogRoutes)` in `app.ts`.
- `backend/routes/blogPublicRoutes.ts` — no auth middleware, just `GET /` and `GET /:slug`. Mount at `app.use("/api/public/blogs", blogPublicRoutes)`.
- No CORS changes needed — `app.ts`'s `corsOptions` already reflects `origin: true` globally, so peak-project-flow's origin is automatically allowed.

## Superadmin admin panel (`apexis/frontend`)

**Nav** — add a `{ href: "/superadmin/blog", label: "Blog", icon: <FileText/Newspaper> }` entry to `superadminNavItems` in `frontend/src/components/superadmin/SuperadminSidebar.tsx`.

**Pages** — follow the established thin-wrapper pattern (`app/superadmin/<x>/page.tsx` → `pages/Superadmin/<X>.tsx`):
- `app/superadmin/blog/page.tsx` → new `pages/Superadmin/SuperadminBlog.tsx` (list view — table + stats cards + delete-confirm dialog, structurally mirroring `pages/Superadmin/SuperadminTeams.tsx`; "New Post" button → `/superadmin/blog/new`).
- `app/superadmin/blog/new/page.tsx` and `app/superadmin/blog/[id]/page.tsx` → both render a new `pages/Superadmin/SuperadminBlogEditor.tsx` (create vs. edit mode based on presence of `id` param).

**Service** — new `frontend/src/services/blogService.ts`, mirroring `services/superadminService.ts` (`PrivateAxios` calls to `/blogs`, `/blogs/:id`, `/blogs/upload-image`, `/blogs/upload-video`).

**Rich editor (the biggest chunk of work)** — port rhinon-cms's TipTap editor from `rhinontech/admin-panel/components/Admin/Content/BlogEditor/`:
- Add TipTap deps to `frontend/package.json`: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-placeholder`, `@tiptap/extension-text-style` (or `text-style-kit`), `@tiptap/extension-highlight`, `@tiptap/extension-subscript`, `@tiptap/extension-superscript`, `@tiptap/extension-text-align`, table extensions, `@tiptap/extension-link`.
- Port `ParagraphBlock.tsx` (the actual rich editor + toolbar) — the TipTap editor logic/extensions port directly, but the toolbar UI must be re-skinned from rhinon-cms's own button/dropdown kit to Apexis's shadcn primitives (`components/ui/button`, `dropdown-menu`, `popover`, `select`).
- Port `videoNode.ts` as-is (framework-agnostic custom TipTap node for inline video/YouTube embeds).
- Port `ContentImageInput.tsx` (upload-or-paste-URL widget, reused for cover image + author avatar) and `FaqEditor.tsx` (add/edit/remove FAQ rows + paste-JSON import).
- Port `types.ts` (Blog/BlogBlock/BlogFaq TS types + `newBlockId`, `extractYouTubeId`, `computeReadTime`, `slugifyTitle` helpers), adjusting field names to the backend's snake_case contract.
- Editor page fields to replicate: title, slug (auto from title until touched), excerpt, the TipTap body, FAQs, category, tags, meta title/description (with char counters), cover image, author name/role/avatar, and Save-as-Draft / Publish buttons — same UX as rhinon-cms's `BlogEditorPage.tsx`.
- Save contract: same as rhinon-cms — the editor's HTML output collapses into a single `content_blocks: [{ id, type: "paragraph", html }]` element on save.

## Public site (`peak-project-flow`)

peak-project-flow is a Vite SPA with no server-side data layer today — this is the one piece with no direct file to port; it's new client-side fetching wired into existing UI conventions.

- New `src/lib/blog-api.ts` — `fetch()`-based client (or `axios`, to match nothing existing) with `getBlogs()` → `GET {VITE_API_BASE_URL}/api/public/blogs`, `getBlogBySlug(slug)` → `GET {VITE_API_BASE_URL}/api/public/blogs/:slug`. Add `VITE_API_BASE_URL` to a new `.env.example` (Vite exposes vars via `import.meta.env.VITE_*`).
- Use the already-installed-but-unused `@tanstack/react-query` (`QueryClientProvider` already wraps `App.tsx`) for `useQuery` calls in the new pages — this is exactly what it was set up for.
- New `src/pages/Blog.tsx` (list) and `src/pages/BlogPost.tsx` (detail, `useParams<{slug}>()`), structured like `src/pages/Founder.tsx`: `<SEO .../>` + `<Navbar/>` + `<AnimatedSection>` content + `<Footer/>`. Reuse `src/components/common/SEO.tsx` for per-post title/description/canonical/OG tags and JSON-LD (`BlogPosting` schema, `FAQPage` if FAQs exist) — same `useEffect`-driven pattern already used site-wide.
- New `src/components/blog/BlogContent.tsx` — renders `content_blocks[0].html` via `dangerouslySetInnerHTML`, wrapped in a `prose` class (Tailwind Typography plugin is already installed) for styling, with a basic script-stripping sanitize step ported from rhinon-cms's `blocks.ts` (`stripScripts`). No need to port the legacy multi-block/markdown-fallback handling — this is a greenfield table, every row will always be the single-block shape.
- Add routes to `src/App.tsx` above the `{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}` marker: `/blog` → `Blog`, `/blog/:slug` → `BlogPost`.
- Add a "Blog" nav link to `src/components/landing/Navbar.tsx`.
- **SEO caveat to flag**: this site is 100% client-rendered (Vercel static SPA, `vercel.json` rewrites everything to `index.html`) — meta tags are set post-hydration via `SEO.tsx`'s `useEffect`, same limitation the rest of the site already accepts. Crawlers that don't execute JS may see generic tags briefly. Not a blocker, just consistent with existing behavior — no SSR migration in scope here.

## Deliverable

Save this plan as `/Users/rhinon/Desktop/Apexis/apexis/BLOG_FEATURE_PLAN.md` (repo root of the `apexis` monorepo) as the first step, so it's tracked alongside the code it describes.

## Verification

1. **Backend**: run the new migration (`sequelize-cli db:migrate`), boot the backend, and manually exercise the API — create a draft via `POST /api/blogs` (superadmin JWT), confirm `GET /api/public/blogs` excludes it, `PUT` it to `status: "Published"`, confirm it now appears on `GET /api/public/blogs` and `GET /api/public/blogs/:slug`. Upload a test image and confirm the returned URL is actually publicly fetchable (curl it) — this validates the S3 bucket-policy change landed.
2. **Superadmin**: `npm run dev` in `apexis/frontend`, log in as a superadmin, go to `/superadmin/blog`, create a post through the full editor (images, a table, an FAQ), Publish it, confirm it lists correctly and edits persist.
3. **Public site**: `npm run dev` in `peak-project-flow` with `VITE_API_BASE_URL` pointed at the local backend, visit `/blog` and `/blog/<slug>`, confirm the post renders correctly, SEO/OG tags update per-post, and the FAQ/JSON-LD render if present.
