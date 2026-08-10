"use client";

import { useState } from "react";
import { TbPlus, TbTrash, TbCode, TbX, TbCheck } from "react-icons/tb";
import type { BlogFaq } from "./types";

/**
 * Accepts either a plain array [{question, answer}] (also q/a) or a full
 * schema.org FAQPage object ({ mainEntity: [{ name, acceptedAnswer: { text } }] }).
 */
function parseFaqJson(raw: string): BlogFaq[] {
  const data = JSON.parse(raw);
  const source: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.mainEntity)
      ? data.mainEntity
      : [];
  const items = source
    .map((item): BlogFaq => ({
      question: String(item?.question ?? item?.q ?? item?.name ?? "").trim(),
      answer: String(
        item?.answer ?? item?.a ?? item?.acceptedAnswer?.text ?? item?.acceptedAnswer ?? ""
      ).trim(),
    }))
    .filter((f) => f.question && f.answer);
  if (!items.length) throw new Error("No FAQs found in the JSON");
  return items;
}

export function FaqEditor({
  faqs = [],
  onChange,
}: {
  faqs?: BlogFaq[];
  onChange?: (faqs: BlogFaq[]) => void;
} = {}) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [imported, setImported] = useState(0);

  const patch = (index: number, p: Partial<BlogFaq>) =>
    onChange?.(faqs.map((f, i) => (i === index ? { ...f, ...p } : f)));

  const handleImport = () => {
    setJsonError("");
    try {
      const items = parseFaqJson(jsonText);
      // Imported items replace empty rows but keep any FAQs already written.
      onChange?.([...faqs.filter((f) => f.question.trim() || f.answer.trim()), ...items]);
      setImported(items.length);
      setJsonText("");
      setJsonOpen(false);
      setTimeout(() => setImported(0), 4000);
    } catch (err: any) {
      setJsonError(err.message === "No FAQs found in the JSON" ? err.message : "Invalid JSON — check the format and try again.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-stone-900">FAQs (optional)</h2>
          <p className="text-xs text-stone-400">
            Render as an accordion on the blog page and power the FAQ schema for Google.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {imported > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <TbCheck size={13} /> {imported} imported
            </span>
          )}
          <button
            type="button"
            onClick={() => { setJsonOpen((v) => !v); setJsonError(""); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium hover:bg-stone-100"
          >
            <TbCode size={13} /> Paste JSON
          </button>
          <button
            type="button"
            onClick={() => onChange?.([...faqs, { question: "", answer: "" }])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium hover:bg-stone-100"
          >
            <TbPlus size={13} /> Add FAQ
          </button>
        </div>
      </div>

      {jsonOpen && (
        <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50/60 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-stone-500">
              Paste either a plain array — <code className="rounded bg-white px-1 py-0.5 text-[10px]">[{"{"}&quot;question&quot;: &quot;…&quot;, &quot;answer&quot;: &quot;…&quot;{"}"}]</code> —
              or a full <code className="rounded bg-white px-1 py-0.5 text-[10px]">FAQPage</code> schema with <code className="rounded bg-white px-1 py-0.5 text-[10px]">mainEntity</code>.
              The FAQ schema on the live page is generated automatically from these.
            </p>
            <button type="button" onClick={() => setJsonOpen(false)} className="p-1 text-stone-400 hover:text-stone-700" title="Close">
              <TbX size={14} />
            </button>
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder={'[\n  { "question": "What is …?", "answer": "It is …" }\n]'}
            className="h-40 w-full resize-y rounded-lg border border-stone-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-stone-900"
          />
          {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleImport}
              disabled={!jsonText.trim()}
              className="rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              Import FAQs
            </button>
          </div>
        </div>
      )}

      {faqs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 px-4 py-6 text-center text-xs text-stone-400">
          No FAQs added. These render as an accordion on the blog page.
        </p>
      ) : (
        faqs.map((faq, index) => (
          <div key={index} className="space-y-2 rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={faq.question}
                onChange={(e) => patch(index, { question: e.target.value })}
                placeholder={`Question ${index + 1}`}
                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 outline-none focus:ring-2 focus:ring-stone-900 bg-white text-sm font-medium"
              />
              <button
                type="button"
                onClick={() => onChange?.(faqs.filter((_, i) => i !== index))}
                className="p-2 rounded-lg text-stone-300 hover:bg-red-50 hover:text-red-600"
                title="Remove FAQ"
              >
                <TbTrash size={15} />
              </button>
            </div>
            <textarea
              value={faq.answer}
              onChange={(e) => patch(index, { answer: e.target.value })}
              placeholder="Answer"
              className="w-full px-3 py-2 rounded-lg border border-stone-200 outline-none focus:ring-2 focus:ring-stone-900 bg-white resize-none h-20 text-sm"
            />
          </div>
        ))
      )}
    </div>
  );
}

export default FaqEditor;
