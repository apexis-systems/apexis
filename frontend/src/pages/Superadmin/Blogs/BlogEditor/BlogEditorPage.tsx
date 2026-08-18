"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TbArrowLeft, TbEye, TbLoader, TbSparkles } from "react-icons/tb";
import { cn } from "@/lib/utils";
import { getBlogs, getBlog, createBlog, updateBlog } from "@/services/blogService";
import { ContentImageInput } from "@/pages/Superadmin/Blogs/ContentImageInput";
import { ParagraphBlock } from "./ParagraphBlock";
import { FaqEditor } from "./FaqEditor";
import { legacyMarkdownToHtml } from "./legacyMarkdown";
import {
  type Blog,
  type BlogFaq,
  type BlogStatus,
  flattenBlocksToHtml,
  newBlockId,
  slugifyTitle,
} from "./types";

const META_TITLE_LIMIT = 60;
const META_DESC_LIMIT = 160;
const WORDS_PER_MINUTE = 200;

function isEmptyHtml(html: string): boolean {
  return !html || !html.replace(/<[^>]*>/g, " ").trim();
}

function safeFormatDate(dateStr?: string | null): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/** "N min read" at ~200 wpm, counted across the whole doc (tags stripped). */
function computeReadTimeFromHtml(html: string): string {
  const words = html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min read`;
}

export function BlogEditorPage({ id }: { id?: string }) {
  const router = useRouter();
  const listPath = "/superadmin/blogs";

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState<BlogStatus | null>(null);
  const [error, setError] = useState("");

  const [original, setOriginal] = useState<Blog | null>(null);
  const [legacyConverted, setLegacyConverted] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  // One continuous document — images/video embed inline via the toolbar, so
  // there's no block list to manage anymore.
  const [content, setContent] = useState("");
  const [faqs, setFaqs] = useState<BlogFaq[]>([]);
  const [coverImage, setCoverImage] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [readTime, setReadTime] = useState("1 min read");
  const [readTimeTouched, setReadTimeTouched] = useState(false);
  const [publishedAt, setPublishedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [primaryKeywords, setPrimaryKeywords] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState("");
  const [authorName, setAuthorName] = useState("APEXIS");
  const [authorRole, setAuthorRole] = useState("Engineering");
  const [authorAvatar, setAuthorAvatar] = useState("");

  // Load the blog (edit mode) + the list once for the category suggestions.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getBlogs();
        if (cancelled) return;
        const distinct = Array.from(
          new Map(
            list
              .map((b) => (b.category || "").trim())
              .filter(Boolean)
              .map((c) => [c.toLowerCase(), c])
          ).values()
        ).sort();
        setCategories(distinct);
      } catch {
        /* suggestions only */
      }
    })();

    if (!id) return () => { cancelled = true; };

    (async () => {
      try {
        const blog = await getBlog(id);
        if (cancelled) return;
        const b = blog as any;
        const rawPublishedAt = b.publishedAt || b.published_at;
        const rawContentBlocks = b.contentBlocks || b.content_blocks;
        const rawCoverImage = b.coverImage || b.cover_image;
        const rawMetaTitle = b.metaTitle || b.meta_title;
        const rawMetaDescription = b.metaDescription || b.meta_description;
        const rawAuthorName = b.authorName || b.author_name;
        const rawAuthorRole = b.authorRole || b.author_role;
        const rawAuthorAvatar = b.authorAvatar || b.author_avatar;
        const rawReadTime = b.readTime || b.read_time;
        const rawPrimaryKeywords = b.primaryKeywords || b.primary_keywords;
        const rawSecondaryKeywords = b.secondaryKeywords || b.secondary_keywords;

        setOriginal(blog);
        setTitle(blog.title || "");
        setSlug(blog.slug || "");
        setSlugTouched(true);
        setExcerpt(blog.excerpt || "");
        setCoverImage(rawCoverImage || "");
        setCategory(blog.category || "");
        setTags((blog.tags || []).join(", "));
        setReadTime(rawReadTime || "1 min read");
        setReadTimeTouched(true);
        setPublishedAt(safeFormatDate(rawPublishedAt));
        setMetaTitle(rawMetaTitle || "");
        setMetaDescription(rawMetaDescription || "");
        setPrimaryKeywords((rawPrimaryKeywords || []).join(", "));
        setSecondaryKeywords((rawSecondaryKeywords || []).join(", "));
        setAuthorName(rawAuthorName || "APEXIS");
        setAuthorRole(rawAuthorRole || "Engineering");
        setAuthorAvatar(rawAuthorAvatar || "");
        setFaqs(blog.faqs || []);
        if (rawContentBlocks?.length) {
          const isSingleParagraph = rawContentBlocks.length === 1 && rawContentBlocks[0].type === "paragraph";
          setContent(isSingleParagraph ? rawContentBlocks[0].html : flattenBlocksToHtml(rawContentBlocks));
          if (!isSingleParagraph) setLegacyConverted(true);
        } else if (blog.content) {
          setContent(legacyMarkdownToHtml(blog.content));
          setLegacyConverted(true);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load blog");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id]);


  // Auto slug (create mode, until touched) + auto read time (until touched).
  useEffect(() => {
    if (!id && !slugTouched) setSlug(slugifyTitle(title));
  }, [title, id, slugTouched]);

  useEffect(() => {
    if (!readTimeTouched) setReadTime(computeReadTimeFromHtml(content));
  }, [content, readTimeTouched]);

  const cleanFaqs = useMemo(
    () => faqs.filter((f) => f.question.trim() && f.answer.trim()),
    [faqs]
  );

  const handleSave = useCallback(
    async (status: BlogStatus) => {
      setError("");
      const cleanBlocks = isEmptyHtml(content)
        ? []
        : [{ id: newBlockId(), type: "paragraph" as const, html: content }];
      if (!title.trim()) { setError("Title is required."); return; }
      if (!excerpt.trim()) { setError("Excerpt is required."); return; }
      if (cleanBlocks.length === 0 && !original?.content) {
        setError("Write something before saving.");
        return;
      }

      const payload = {
        title: title.trim(),
        slug: slug.trim() || slugifyTitle(title),
        excerpt: excerpt.trim(),
        contentBlocks: cleanBlocks,
        faqs: cleanFaqs,
        coverImage: coverImage || null,
        category: category.trim() || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        primaryKeywords: primaryKeywords.split(",").map((k) => k.trim()).filter(Boolean),
        secondaryKeywords: secondaryKeywords.split(",").map((k) => k.trim()).filter(Boolean),
        readTime,
        publishedAt: new Date(`${publishedAt}T00:00:00`).toISOString(),
        metaTitle: metaTitle.trim() || null,
        metaDescription: metaDescription.trim() || null,
        authorName: authorName.trim() || "APEXIS",
        authorRole: authorRole.trim() || "Engineering",
        authorAvatar: authorAvatar || null,
        status,
      };

      setSaving(status);
      try {
        if (id) {
          const updated = await updateBlog(id, payload);
          setOriginal(updated);
          setSlug(updated.slug);
          setLegacyConverted(false);
        } else {
          const created = await createBlog(payload);
          router.replace(`/superadmin/blogs/${created.id}`);
        }
      } catch (err: any) {
        setError(err.message || "Save failed");
      } finally {
        setSaving(null);
      }
    },
    [
      id, title, slug, excerpt, content, cleanFaqs, coverImage, category, tags,
      primaryKeywords, secondaryKeywords, readTime,
      publishedAt, metaTitle, metaDescription, authorName, authorRole, authorAvatar,
      original, router, listPath,
    ]
  );

  const status: BlogStatus = original?.status || "Draft";
  const slugChangedOnPublished =
    !!original && original.status === "Published" && slug.trim() !== original.slug;

  if (loading) {
    return (
      <main className="flex h-full min-h-0 w-full items-center justify-center rounded-xl glass-panel">
        <TbLoader size={22} className="animate-spin text-stone-400" />
      </main>
    );
  }

  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl glass-panel">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => router.push(listPath)}
            className="rounded-lg p-2 text-gray-600 hover:bg-stone-100"
            title="Back to blogs"
          >
            <TbArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-gray-900">
              {id ? "Edit Blog" : "New Blog"}
            </h1>
          </div>
          <span
            className={cn(
              "ml-2 shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest",
              status === "Published"
                ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                : "border-amber-100 bg-amber-50 text-amber-600"
            )}
          >
            {status}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => window.open(`/superadmin/blogs/${id}/preview`, "_blank", "noopener,noreferrer")}
            disabled={!id}
            title={id ? "Open preview in a new tab" : "Save as draft to preview"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <TbEye size={14} /> Preview
          </button>
          <button
            onClick={() => handleSave("Draft")}
            disabled={!!saving}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-stone-100 disabled:opacity-60"
          >
            {saving === "Draft" ? "Saving…" : "Save as Draft"}
          </button>
          <button
            onClick={() => handleSave("Published")}
            disabled={!!saving}
            className="rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {saving === "Published" ? "Publishing…" : status === "Published" ? "Update" : "Publish"}
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-medium text-red-600">{error}</div>
      )}
      {legacyConverted && (
        <div className="border-b border-cyan-100 bg-cyan-50 px-4 py-2 text-xs font-medium text-cyan-700">
          This post was converted from legacy markdown into a paragraph block — review the formatting before saving.
        </div>
      )}

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* Left — content */}
          <div className="min-w-0 space-y-5">
            <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Title
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="7 UI design principles every product manager should know"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-lg font-bold tracking-tight outline-none focus:ring-2 focus:ring-stone-900"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Blog URL
                <div className="flex items-center overflow-hidden rounded-lg border border-stone-200 bg-white focus-within:ring-2 focus-within:ring-stone-900">
                  <span className="shrink-0 border-r border-stone-100 bg-stone-50 px-3 py-2 text-sm text-stone-400">/blogs/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => { setSlug(slugifyTitle(e.target.value) || e.target.value.toLowerCase()); setSlugTouched(true); }}
                    placeholder="auto-generated-from-title"
                    className="w-full bg-transparent px-3 py-2 text-sm outline-none"
                  />
                </div>
                {slugChangedOnPublished && (
                  <p className="text-xs font-normal text-amber-600">
                    Changing the URL of a published post breaks existing links to it.
                  </p>
                )}
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Excerpt
                <textarea
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="One or two sentences shown on the blog card."
                  className="h-20 w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                />
              </label>
            </div>

            <ParagraphBlock html={content} onChange={setContent} />

            <div className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
              <FaqEditor faqs={faqs} onChange={setFaqs} />
            </div>
          </div>

          {/* Right — settings rail */}
          <div className="space-y-4">
            <SettingsCard title="Publishing">
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Published Date
                <input
                  type="date"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                <span className="flex items-center justify-between">
                  Read Time
                  {readTimeTouched && (
                    <button
                      type="button"
                      onClick={() => { setReadTimeTouched(false); setReadTime(computeReadTimeFromHtml(content)); }}
                      className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-500 hover:bg-stone-100"
                      title="Recalculate from content"
                    >
                      <TbSparkles size={11} /> auto
                    </button>
                  )}
                </span>
                <input
                  type="text"
                  value={readTime}
                  onChange={(e) => { setReadTime(e.target.value); setReadTimeTouched(true); }}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                />
                {!readTimeTouched && (
                  <span className="text-[10px] font-normal text-stone-400">Auto-calculated from your content.</span>
                )}
              </label>
            </SettingsCard>

            <SettingsCard title="Organize">
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Category
                <input
                  type="text"
                  list="blog-categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Product Fundamentals"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                />
                <datalist id="blog-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Tags (comma separated)
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Operations, AI"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                />
              </label>
            </SettingsCard>

            <SettingsCard title="SEO">
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                <span className="flex items-center justify-between">
                  Meta Title
                  <CharCounter value={metaTitle} limit={META_TITLE_LIMIT} />
                </span>
                <input
                  type="text"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder={title || "Falls back to the blog title"}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                <span className="flex items-center justify-between">
                  Meta Description
                  <CharCounter value={metaDescription} limit={META_DESC_LIMIT} />
                </span>
                <textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder={excerpt || "Falls back to the excerpt"}
                  className="h-24 w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Primary Keywords (comma separated)
                <input
                  type="text"
                  value={primaryKeywords}
                  onChange={(e) => setPrimaryKeywords(e.target.value)}
                  placeholder="e.g. construction site reporting"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Secondary Keywords (comma separated)
                <input
                  type="text"
                  value={secondaryKeywords}
                  onChange={(e) => setSecondaryKeywords(e.target.value)}
                  placeholder="e.g. daily progress reports, site documentation"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                />
              </label>
            </SettingsCard>

            <SettingsCard title="Thumbnail">
              <ContentImageInput value={coverImage} onChange={setCoverImage} />
            </SettingsCard>

            <SettingsCard title="Author">
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Name
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Designation
                <input
                  type="text"
                  value={authorRole}
                  onChange={(e) => setAuthorRole(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                />
              </label>
              <ContentImageInput label="Avatar" value={authorAvatar} onChange={setAuthorAvatar} />
            </SettingsCard>
          </div>
        </div>
      </div>
    </main>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">{title}</h2>
      {children}
    </div>
  );
}

function CharCounter({ value, limit }: { value: string; limit: number }) {
  return (
    <span
      className={cn(
        "text-[10px] font-semibold tabular-nums",
        value.length > limit ? "text-amber-600" : "text-stone-400"
      )}
    >
      {value.length}/{limit}
    </span>
  );
}

export default BlogEditorPage;
