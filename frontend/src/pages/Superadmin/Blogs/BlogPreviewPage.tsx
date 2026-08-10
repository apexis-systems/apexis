"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TbArrowLeft, TbClock, TbList, TbLink, TbBrandLinkedin, TbBrandWhatsapp, TbBrandX, TbCheck } from "react-icons/tb";
import { getBlog } from "@/services/blogService";
import type { Blog } from "./BlogEditor/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://apexis.in";

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function slugifyHeading(text: string): string {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface TocItem {
  id: string;
  label: string;
}

export function BlogPreviewPage({ id }: { id: string }) {
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getBlog(id);
        if (!cancelled) setBlog(data);
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.error || "Failed to load blog");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const contentHtml = useMemo(() => {
    const block = blog?.contentBlocks?.find((b) => b.type === "paragraph");
    return block && block.type === "paragraph" ? block.html : "";
  }, [blog]);

  useEffect(() => {
    if (!contentRef.current) return;
    const headings = Array.from(contentRef.current.querySelectorAll("h2, h3, h4"));
    const items: TocItem[] = headings.map((h, i) => {
      const label = h.textContent?.trim() || `Section ${i + 1}`;
      let hid = slugifyHeading(label) || `section-${i + 1}`;
      if (contentRef.current!.querySelectorAll(`#${CSS.escape(hid)}`).length > 1 || h.id === "") {
        hid = `${hid}-${i + 1}`;
      }
      h.id = hid;
      return { id: hid, label };
    });
    setTocItems(items);
  }, [contentHtml]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  const cleanFaqs = (blog?.faqs || []).filter((f) => f.question?.trim() && f.answer?.trim());
  const cleanTags = blog?.tags || [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(38_33%_95%)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(24_95%_53%)] border-t-transparent" />
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-[hsl(38_33%_95%)] px-4 text-center">
        <p className="text-lg font-bold text-[hsl(30_10%_15%)]">Couldn&apos;t load this post</p>
        <p className="text-sm text-[hsl(30_8%_45%)]">{error || "Blog not found."}</p>
      </div>
    );
  }

  const shareUrl = blog.slug ? `${SITE_URL}/blogs/${blog.slug}` : window.location.href;

  return (
    <div className="min-h-screen bg-[hsl(38_33%_95%)]">
      {/* Preview utility bar — not part of the published design, admin-only chrome */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[hsl(35_15%_85%)] bg-[hsl(30_10%_15%)] px-4 py-2.5 text-white">
        <div className="flex items-center gap-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => window.close()}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <TbArrowLeft size={14} /> Close preview
          </button>
          <span className="text-white/20">|</span>
          <span
            className={
              blog.status === "Published"
                ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400"
                : "rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400"
            }
          >
            {blog.status}
          </span>
        </div>
        <span className="hidden text-[11px] font-medium uppercase tracking-widest text-white/40 sm:block">
          Preview
        </span>
      </div>

      <article className="pt-12 pb-20 lg:pt-16">
        <div className="container mx-auto max-w-5xl px-4 lg:px-8">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            {blog.category && (
              <span className="inline-flex items-center rounded-full border border-[hsl(24_95%_53%/0.3)] px-3 py-1 text-xs font-semibold text-[hsl(24_95%_53%)]">
                {blog.category}
              </span>
            )}
            <span className="text-xs text-[hsl(30_8%_45%)]">{formatDate(blog.publishedAt)}</span>
            <span className="flex items-center gap-1 text-xs text-[hsl(30_8%_45%)]">
              <TbClock size={13} />
              {blog.readTime}
            </span>
          </div>

          <h1 className="mb-5 text-3xl font-bold leading-[1.15] tracking-tight text-[hsl(30_10%_15%)] sm:text-4xl lg:text-5xl">
            {blog.title || "Untitled post"}
          </h1>
          {blog.excerpt && (
            <p className="mb-8 max-w-3xl text-base font-light leading-relaxed text-[hsl(30_8%_45%)] sm:text-lg">
              {blog.excerpt}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-y border-[hsl(35_15%_85%)] py-5">
            <div className="flex items-center gap-3">
              {blog.authorAvatar ? (
                <img
                  src={blog.authorAvatar}
                  alt={blog.authorName}
                  className="h-11 w-11 rounded-full object-cover ring-1 ring-[hsl(35_15%_85%)]"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(37_18%_91%)] text-sm font-bold text-[hsl(30_8%_45%)] ring-1 ring-[hsl(35_15%_85%)]">
                  {blog.authorName?.[0]?.toUpperCase() || "A"}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-[hsl(30_10%_15%)]">{blog.authorName}</p>
                <p className="text-xs text-[hsl(30_8%_45%)]">{blog.authorRole}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Share on LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(35_15%_85%)] text-[hsl(30_8%_45%)] transition-colors hover:border-[hsl(24_95%_53%/0.4)] hover:text-[hsl(24_95%_53%)]"
              >
                <TbBrandLinkedin size={16} />
              </a>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(blog.title)}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Share on X"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(35_15%_85%)] text-[hsl(30_8%_45%)] transition-colors hover:border-[hsl(24_95%_53%/0.4)] hover:text-[hsl(24_95%_53%)]"
              >
                <TbBrandX size={16} />
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${blog.title} ${shareUrl}`)}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Share on WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(35_15%_85%)] text-[hsl(30_8%_45%)] transition-colors hover:border-[hsl(24_95%_53%/0.4)] hover:text-[hsl(24_95%_53%)]"
              >
                <TbBrandWhatsapp size={16} />
              </a>
              <button
                type="button"
                onClick={handleCopyLink}
                aria-label="Copy link"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(35_15%_85%)] text-[hsl(30_8%_45%)] transition-colors hover:border-[hsl(24_95%_53%/0.4)] hover:text-[hsl(24_95%_53%)]"
              >
                {copied ? <TbCheck size={16} className="text-emerald-600" /> : <TbLink size={16} />}
              </button>
            </div>
          </div>

          {blog.coverImage && (
            <div className="mt-10 overflow-hidden rounded-2xl border border-[hsl(35_15%_85%)] bg-white">
              <img
                src={blog.coverImage}
                alt={blog.title}
                className="h-auto max-h-[480px] w-full object-cover"
              />
            </div>
          )}

          <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_260px]">
            <div>
              <div ref={contentRef} className="blog-prose" dangerouslySetInnerHTML={{ __html: contentHtml }} />

              {cleanTags.length > 0 && (
                <div className="mt-10 flex flex-wrap gap-2 border-t border-[hsl(35_15%_85%)] pt-8">
                  {cleanTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[hsl(37_18%_91%)] px-3 py-1 text-xs font-medium text-[hsl(30_8%_45%)]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {cleanFaqs.length > 0 && (
                <div className="mt-16 border-t border-[hsl(35_15%_85%)] pt-12">
                  <h2 className="mb-6 text-xl font-bold text-[hsl(30_10%_15%)] sm:text-2xl">
                    Frequently Asked Questions
                  </h2>
                  <div className="space-y-3">
                    {cleanFaqs.map((faq, i) => (
                      <details
                        key={i}
                        className="group rounded-xl border border-[hsl(35_15%_85%)] bg-white px-5 py-4"
                      >
                        <summary className="cursor-pointer list-none text-sm font-semibold text-[hsl(30_10%_15%)] marker:content-none">
                          {faq.question}
                        </summary>
                        <p className="mt-3 text-sm font-light leading-relaxed text-[hsl(30_8%_45%)]">
                          {faq.answer}
                        </p>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {tocItems.length > 0 && (
              <div className="lg:sticky lg:top-16 lg:h-fit">
                <div className="rounded-xl border border-[hsl(35_15%_85%)] bg-white p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <TbList size={16} className="text-[hsl(24_95%_53%)]" />
                    <h3 className="text-sm font-semibold tracking-wide text-[hsl(30_10%_15%)]">
                      Table of Contents
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {tocItems.map((item) => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          className="text-sm font-light leading-snug text-[hsl(30_8%_45%)] transition-colors hover:text-[hsl(24_95%_53%)]"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

export default BlogPreviewPage;
