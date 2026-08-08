/**
 * Converts the small markdown subset used by the old blog textarea
 * (## / ### headings, - * 1. lists, **bold**, > quotes, ``` fences, blank-line
 * paragraphs, <br>) into HTML that TipTap can load. Used only to seed the
 * block editor when opening a legacy blog that has `content` but no blocks.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/&lt;br\s*\/?&gt;/gi, "<br>");
}

export function legacyMarkdownToHtml(markdown: string): string {
  const lines = (markdown || "").split("\n");
  const out: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;

  const flushList = () => {
    if (!list) return;
    const tag = list.ordered ? "ol" : "ul";
    out.push(`<${tag}>${list.items.map((i) => `<li>${i}</li>`).join("")}</${tag}>`);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (code) {
      if (line.startsWith("```")) {
        out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.push(raw);
      }
      continue;
    }

    if (line.startsWith("```")) {
      flushList();
      code = [];
      continue;
    }
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      out.push(`<h2>${inline(line.slice(2))}</h2>`);
      continue;
    }
    if (line.startsWith("> ")) {
      flushList();
      out.push(`<blockquote><p>${inline(line.slice(2))}</p></blockquote>`);
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(inline(line.slice(2)));
      continue;
    }
    const ordered = line.match(/^(\d+)\.\s+(.*)$/);
    if (ordered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(inline(ordered[2]));
      continue;
    }
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }

  flushList();
  if (code) out.push(`<pre><code>${escapeHtml((code as string[]).join("\n"))}</code></pre>`);
  return out.join("");
}

export default legacyMarkdownToHtml;

