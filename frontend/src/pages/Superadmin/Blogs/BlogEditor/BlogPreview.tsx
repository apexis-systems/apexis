"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TbExternalLink } from "react-icons/tb";
import { type BlogBlock, type BlogFaq, extractYouTubeId } from "./types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rhinonlabs.com";

export function BlogPreview({
  open = false,
  onOpenChange,
  title = "",
  excerpt = "",
  coverImage = "",
  authorName = "",
  authorRole = "",
  readTime = "",
  category = "",
  blocks = [],
  faqs = [],
  slug = "",
  isPublished = false,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  excerpt?: string;
  coverImage?: string;
  authorName?: string;
  authorRole?: string;
  readTime?: string;
  category?: string;
  blocks?: BlogBlock[];
  faqs?: BlogFaq[];
  slug?: string;
  isPublished?: boolean;
} = {}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[92vw] max-h-[88vh] overflow-y-auto border-white/10 bg-[#0a0f1e] p-0 text-white">
        <DialogTitle className="sr-only">Blog preview</DialogTitle>
        <div className="p-8 sm:p-12">
          <div className="mb-6 flex items-center justify-between gap-4">
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
              {category || "Insight"} · {readTime}
            </span>
            {isPublished && slug && (
              <a
                href={`${SITE_URL}/blogs/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300"
              >
                Open live page <TbExternalLink size={14} />
              </a>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{title || "Untitled post"}</h1>
          {excerpt && <p className="mt-4 text-lg text-white/60">{excerpt}</p>}
          <p className="mt-4 text-sm text-white/40">
            {authorName} · {authorRole}
          </p>

          {coverImage && (
            <img src={coverImage} alt="" className="mt-8 w-full rounded-2xl border border-white/10 object-cover" />
          )}

          <div className="preview-article mt-10 space-y-8">
            {(blocks || []).map((block) => {
              if (block.type === "paragraph") {
                return <div key={block.id} className="preview-html" dangerouslySetInnerHTML={{ __html: block.html }} />;
              }
              if (block.type === "image") {
                if (!block.url) return null;
                return (
                  <figure key={block.id}>
                    <img src={block.url} alt={block.alt || ""} className="w-full rounded-2xl border border-white/10" />
                    {block.credit && <figcaption className="mt-2 text-center text-xs text-white/40">{block.credit}</figcaption>}
                  </figure>
                );
              }
              if (block.type === "video") {
                if (!block.url) return null;
                return (
                  <figure key={block.id}>
                    <video src={block.url} controls preload="metadata" className="w-full rounded-2xl border border-white/10 bg-black" />
                    {block.caption && <figcaption className="mt-2 text-center text-xs text-white/40">{block.caption}</figcaption>}
                  </figure>
                );
              }
              const videoId = extractYouTubeId(block.url);
              if (!videoId) return null;
              return (
                <figure key={block.id}>
                  <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                      title="YouTube video"
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  {block.caption && <figcaption className="mt-2 text-center text-xs text-white/40">{block.caption}</figcaption>}
                </figure>
              );
            })}
          </div>

          {(faqs || []).filter((f) => f.question?.trim() && f.answer?.trim()).length > 0 && (
            <div className="mt-12 border-t border-white/10 pt-8">
              <h2 className="mb-5 text-xl font-black tracking-tight">Frequently asked questions</h2>
              <div className="space-y-3">
                {(faqs || [])
                  .filter((f) => f.question?.trim() && f.answer?.trim())
                  .map((faq, i) => (
                    <details key={i} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <summary className="cursor-pointer text-sm font-semibold">{faq.question}</summary>
                      <p className="mt-2 text-sm text-white/60">{faq.answer}</p>
                    </details>
                  ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
