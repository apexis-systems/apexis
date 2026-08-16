export type BlogStatus = "Draft" | "Published";

export type BlogBlock =
  | { id: string; type: "paragraph"; html: string }
  | { id: string; type: "image"; url: string; alt?: string; credit?: string }
  | { id: string; type: "video"; url: string; caption?: string }
  | { id: string; type: "youtube"; url: string; caption?: string };

export type BlogBlockType = BlogBlock["type"];

export interface BlogFaq {
  question: string;
  answer: string;
}

export interface Blog {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  contentBlocks: BlogBlock[];
  faqs: BlogFaq[];
  category?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  slug: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string | null;
  coverImage?: string | null;
  tags: string[];
  primaryKeywords: string[];
  secondaryKeywords: string[];
  readTime: string;
  publishedAt: string;
  status: BlogStatus;
  updatedAt?: string;
}

export function newBlockId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function extractYouTubeId(url: string): string | null {
  const m = (url || "").match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

/** Words across paragraph blocks (tags stripped) → "N min read" at ~200 wpm. */
export function computeReadTime(blocks: BlogBlock[]): string {
  const text = blocks
    .filter((b): b is Extract<BlogBlock, { type: "paragraph" }> => b.type === "paragraph")
    .map((b) => b.html.replace(/<[^>]*>/g, " "))
    .join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

/**
 * Flattens a legacy multi-block post (separate paragraph/image/video/youtube
 * blocks, from before images/video embedded inline) into one HTML string for
 * the single continuous editor. Mirrors the same inline markup the editor's
 * image/video toolbar buttons produce, so the flattened content is editable
 * exactly like anything authored inline.
 */
export function flattenBlocksToHtml(blocks: BlogBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "paragraph") return b.html;
      if (b.type === "image") {
        const caption = b.credit ? `<p><em>${b.credit}</em></p>` : "";
        return `<img src="${b.url}" alt="${b.alt || ""}" />${caption}`;
      }
      if (b.type === "video") {
        const caption = b.caption ? `<p><em>${b.caption}</em></p>` : "";
        return `<div data-video-embed data-src="${b.url}" data-kind="file" data-width="100%"></div>${caption}`;
      }
      // youtube
      const videoId = extractYouTubeId(b.url);
      if (!videoId) return "";
      const caption = b.caption ? `<p><em>${b.caption}</em></p>` : "";
      return `<div data-video-embed data-src="${b.url}" data-kind="youtube" data-video-id="${videoId}" data-width="100%"></div>${caption}`;
    })
    .join("");
}

export function slugifyTitle(input: string): string {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const typesHelper = {
  newBlockId,
  extractYouTubeId,
  computeReadTime,
  flattenBlocksToHtml,
  slugifyTitle,
};

export default typesHelper;

