"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "@tiptap/core";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Image from "@tiptap/extension-image";
import { VideoEmbed } from "./videoNode";
import { extractYouTubeId } from "./types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TbBold,
  TbItalic,
  TbUnderline,
  TbStrikethrough,
  TbLetterA,
  TbHighlight,
  TbSubscript,
  TbSuperscript,
  TbList,
  TbListNumbers,
  TbIndentDecrease,
  TbIndentIncrease,
  TbAlignLeft,
  TbAlignCenter,
  TbAlignRight,
  TbAlignJustified,
  TbBlockquote,
  TbCode,
  TbSourceCode,
  TbLink,
  TbLinkOff,
  TbClearFormatting,
  TbTable,
  TbRowInsertBottom,
  TbColumnInsertRight,
  TbRowRemove,
  TbColumnRemove,
  TbTableOff,
  TbPhoto,
  TbTrash,
  TbUpload,
  TbLoader,
  TbX,
  TbVideo,
  TbBrandYoutube,
} from "react-icons/tb";
import { cn } from "@/lib/utils";
import { uploadBlogImage, uploadBlogVideo } from "@/services/blogService";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (fontFamily: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
    };
    color: {
      setColor: (color: string) => ReturnType;
      unsetColor: () => ReturnType;
    };
  }
}






const CustomTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style?.color?.replace(/['"]+/g, "") || null,
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.color) return {};
          return { style: `color: ${attributes.color}` };
        },
      },
      fontFamily: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style?.fontFamily?.replace(/['"]+/g, "") || null,
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.fontFamily) return {};
          return { style: `font-family: ${attributes.fontFamily}` };
        },
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setColor:
        (color: string) =>
        ({ chain }: any) => {
          return chain().setMark("textStyle", { color }).run();
        },
      unsetColor:
        () =>
        ({ chain }: any) => {
          return chain().setMark("textStyle", { color: null }).removeEmptyTextStyle().run();
        },
      setFontFamily:
        (fontFamily: string) =>
        ({ chain }: any) => {
          return chain().setMark("textStyle", { fontFamily }).run();
        },
      unsetFontFamily:
        () =>
        ({ chain }: any) => {
          return chain().setMark("textStyle", { fontFamily: null }).removeEmptyTextStyle().run();
        },
    };
  },
});

const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "100%",
        parseHTML: (element: HTMLElement) => element.style.width || element.getAttribute("width") || "100%",
        renderHTML: (attributes: Record<string, any>) => {
          return {
            style: `width: ${attributes.width}; max-width: 100%; height: auto;`,
            width: attributes.width,
          };
        },
      },
      align: {
        default: "center",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-align") || "center",
        renderHTML: (attributes: Record<string, any>) => {
          let style = "display: block; ";
          if (attributes.align === "left") {
            style += "margin-right: auto; margin-left: 0;";
          } else if (attributes.align === "right") {
            style += "margin-left: auto; margin-right: 0;";
          } else {
            style += "margin-left: auto; margin-right: auto;";
          }
          return {
            "data-align": attributes.align,
            style,
          };
        },
      },
    };
  },
});

const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Cyan", value: "#0891b2" },
  { label: "Blue", value: "#2563eb" },
  { label: "Emerald", value: "#059669" },
  { label: "Amber", value: "#d97706" },
  { label: "Red", value: "#dc2626" },
  { label: "Gray", value: "#6b7280" },
];

const HIGHLIGHT_COLORS = [
  { label: "None", value: "" },
  { label: "Yellow", value: "#fef08a" },
  { label: "Cyan", value: "#a5f3fc" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Orange", value: "#fed7aa" },
];

const FONTS = [
  { label: "Sans Serif", value: "" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Monospace", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
];

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        active ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-stone-200" />;
}

function InsertImageButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url: uploadedUrl } = await uploadBlogImage(file);
      editor.chain().focus().setImage({ src: uploadedUrl }).run();
      setOpen(false);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      editor.chain().focus().setImage({ src: url.trim() }).run();
      setUrl("");
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Insert Image"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "p-1.5 rounded-md transition-colors text-stone-500 hover:bg-stone-100 hover:text-stone-900",
            open && "bg-stone-100 text-stone-900"
          )}
        >
          <TbPhoto size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3 bg-white border border-stone-200 shadow-md rounded-lg z-[110]">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-stone-700">Insert Image</h4>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg border border-stone-300 bg-white py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-50 text-stone-700 cursor-pointer"
            >
              {uploading ? <TbLoader size={15} className="animate-spin text-stone-500" /> : <TbUpload size={15} />}
              {uploading ? "Uploading..." : "Upload from Computer"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

            <div className="relative flex items-center py-1">
              <span className="absolute inset-x-0 h-px bg-stone-200" />
              <span className="relative mx-auto bg-white px-2 text-[10px] text-stone-400 font-medium">OR</span>
            </div>

            <form onSubmit={handleUrlSubmit} className="flex gap-1.5">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste image URL..."
                className="flex-1 h-8 px-2.5 rounded-md border border-stone-200 text-xs outline-none focus:ring-1 focus:ring-stone-900 bg-white text-stone-900"
              />
              <button
                type="submit"
                disabled={!url.trim()}
                className="h-8 px-3 rounded-md bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
              >
                Insert
              </button>
            </form>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const MAX_VIDEO_MB = 100;

function InsertVideoButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`Video exceeds the ${MAX_VIDEO_MB} MB limit`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    setError("");
    try {
      const { url: uploadedUrl } = await uploadBlogVideo(file);
      editor.chain().focus().setVideoEmbed({ src: uploadedUrl, kind: "file" }).run();
      setOpen(false);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    const youtubeId = extractYouTubeId(trimmed);
    editor.chain().focus().setVideoEmbed({ src: trimmed, kind: youtubeId ? "youtube" : "file" }).run();
    setUrl("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Insert Video"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "p-1.5 rounded-md transition-colors text-stone-500 hover:bg-stone-100 hover:text-stone-900",
            open && "bg-stone-100 text-stone-900"
          )}
        >
          <TbVideo size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3 bg-white border border-stone-200 shadow-md rounded-lg z-[110]">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-stone-700">Insert Video</h4>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg border border-stone-300 bg-white py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-50 text-stone-700 cursor-pointer"
            >
              {uploading ? <TbLoader size={15} className="animate-spin text-stone-500" /> : <TbUpload size={15} />}
              {uploading ? "Uploading..." : "Upload from Computer"}
            </button>
            <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleFile} className="hidden" />
            <p className="text-[10px] text-stone-400">MP4, WebM or MOV — up to {MAX_VIDEO_MB} MB.</p>
            {error && <p className="text-[10px] text-red-500">{error}</p>}

            <div className="relative flex items-center py-1">
              <span className="absolute inset-x-0 h-px bg-stone-200" />
              <span className="relative mx-auto bg-white px-2 text-[10px] text-stone-400 font-medium">OR</span>
            </div>

            <form onSubmit={handleUrlSubmit} className="flex gap-1.5">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a YouTube or video URL..."
                className="flex-1 h-8 px-2.5 rounded-md border border-stone-200 text-xs outline-none focus:ring-1 focus:ring-stone-900 bg-white text-stone-900"
              />
              <button
                type="submit"
                disabled={!url.trim()}
                className="h-8 px-3 rounded-md bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
              >
                Insert
              </button>
            </form>
            <p className="flex items-center gap-1 text-[10px] text-stone-400">
              <TbBrandYoutube size={13} /> YouTube links embed automatically.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ParagraphBlock({
  html = "",
  onChange,
}: {
  html?: string;
  onChange?: (html: string) => void;
} = {}) {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true, // toolbar active-states track the cursor
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: "Write something…" }),
      CustomTextStyle,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      Underline,
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: "https" }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      CustomImage,
      VideoEmbed,
    ],
    content: html || "",
    editorProps: {
      attributes: {
        class:
          "blog-tiptap min-h-[65vh] px-4 py-3 text-[15px] leading-relaxed text-stone-800 outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
  });

  // Keep editor in sync if the block html changes externally (e.g. legacy conversion seed).
  useEffect(() => {
    if (editor && html !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(html || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, editor]);

  const setLink = useCallback((ed: Editor) => {
    const previous = ed.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous || "https://");
    if (url === null) return;
    if (url === "" || url === "https://") {
      ed.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    ed.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, []);

  if (!editor) {
    return <div className="min-h-[160px] rounded-lg bg-stone-50 animate-pulse" />;
  }

  const styleValue = editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
      ? "h3"
      : editor.isActive("heading", { level: 4 })
        ? "h4"
        : "p";

  const fontValue = (editor.getAttributes("textStyle").fontFamily as string) || "";
  const currentColor = (editor.getAttributes("textStyle").color as string) || "";
  const inTable = editor.isActive("table");

  const selectClass =
    "h-7 rounded-md border border-stone-200 bg-white px-1.5 text-xs font-medium text-stone-700 outline-none focus:ring-1 focus:ring-stone-900";

  return (
    <div className="rounded-lg border border-stone-200 bg-white focus-within:ring-2 focus-within:ring-stone-900 transition-shadow">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-stone-100 px-2 py-1.5">
        {/* Font family */}
        <select
          title="Font"
          value={fontValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v) editor.chain().focus().setFontFamily(v).run();
            else editor.chain().focus().unsetFontFamily().run();
          }}
          className={selectClass}
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Paragraph style */}
        <select
          title="Paragraph style"
          value={styleValue}
          onChange={(e) => {
            const v = e.target.value;
            const chain = editor.chain().focus();
            if (v === "p") chain.setParagraph().run();
            else chain.toggleHeading({ level: Number(v.slice(1)) as 2 | 3 | 4 }).run();
          }}
          className={cn(selectClass, "ml-1")}
        >
          <option value="p">Normal</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>

        <Divider />

        <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <TbBold size={16} />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <TbItalic size={16} />
        </ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <TbUnderline size={16} />
        </ToolbarButton>
        <ToolbarButton title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <TbStrikethrough size={16} />
        </ToolbarButton>

        <Divider />

        {/* Text color */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Text color"
              onMouseDown={(e) => e.preventDefault()}
              className="p-1.5 rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-900"
            >
              <span className="flex flex-col items-center">
                <TbLetterA size={14} />
                <span className="mt-px h-1 w-4 rounded-sm" style={{ background: currentColor || "#1c1917" }} />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[140px]">
            {TEXT_COLORS.map((c) => (
              <DropdownMenuItem
                key={c.label}
                onSelect={() => {
                  if (c.value) editor.chain().focus().setColor(c.value).run();
                  else editor.chain().focus().unsetColor().run();
                }}
                className="gap-2.5"
              >
                <span className="h-3.5 w-3.5 rounded-full border border-stone-200" style={{ background: c.value || "#1c1917" }} />
                {c.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Highlight */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Highlight"
              onMouseDown={(e) => e.preventDefault()}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                editor.isActive("highlight") ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
              )}
            >
              <TbHighlight size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[140px]">
            {HIGHLIGHT_COLORS.map((c) => (
              <DropdownMenuItem
                key={c.label}
                onSelect={() => {
                  if (c.value) editor.chain().focus().setHighlight({ color: c.value }).run();
                  else editor.chain().focus().unsetHighlight().run();
                }}
                className="gap-2.5"
              >
                <span className="h-3.5 w-3.5 rounded-full border border-stone-200" style={{ background: c.value || "#ffffff" }} />
                {c.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarButton title="Subscript" active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()}>
          <TbSubscript size={16} />
        </ToolbarButton>
        <ToolbarButton title="Superscript" active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
          <TbSuperscript size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <TbListNumbers size={16} />
        </ToolbarButton>
        <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <TbList size={16} />
        </ToolbarButton>
        <ToolbarButton title="Decrease indent" onClick={() => editor.chain().focus().liftListItem("listItem").run()}>
          <TbIndentDecrease size={16} />
        </ToolbarButton>
        <ToolbarButton title="Increase indent" onClick={() => editor.chain().focus().sinkListItem("listItem").run()}>
          <TbIndentIncrease size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <TbAlignLeft size={16} />
        </ToolbarButton>
        <ToolbarButton title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <TbAlignCenter size={16} />
        </ToolbarButton>
        <ToolbarButton title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <TbAlignRight size={16} />
        </ToolbarButton>
        <ToolbarButton title="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
          <TbAlignJustified size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <TbBlockquote size={16} />
        </ToolbarButton>
        <ToolbarButton title="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
          <TbCode size={16} />
        </ToolbarButton>
        <ToolbarButton title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <TbSourceCode size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="Add link" active={editor.isActive("link")} onClick={() => setLink(editor)}>
          <TbLink size={16} />
        </ToolbarButton>
        {editor.isActive("link") && (
          <ToolbarButton title="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}>
            <TbLinkOff size={16} />
          </ToolbarButton>
        )}

        <InsertImageButton editor={editor} />
        <InsertVideoButton editor={editor} />

        <ToolbarButton
          title="Insert table"
          active={inTable}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TbTable size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="Clear formatting"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <TbClearFormatting size={16} />
        </ToolbarButton>
      </div>

      {/* Contextual table controls */}
      {inTable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-stone-100 bg-stone-50/60 px-2 py-1">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-stone-400">Table</span>
          <ToolbarButton title="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
            <TbRowInsertBottom size={15} />
          </ToolbarButton>
          <ToolbarButton title="Add column right" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <TbColumnInsertRight size={15} />
          </ToolbarButton>
          <ToolbarButton title="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
            <TbRowRemove size={15} />
          </ToolbarButton>
          <ToolbarButton title="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
            <TbColumnRemove size={15} />
          </ToolbarButton>
          <ToolbarButton title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
            <TbTableOff size={15} />
          </ToolbarButton>
        </div>
      )}

      {/* Contextual image controls */}
      {editor.isActive("image") && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-100 bg-stone-50/60 px-3 py-1.5 text-xs text-stone-500">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-stone-400">Image</span>

          <Divider />

          {/* Alignment */}
          <ToolbarButton
            title="Align Left"
            active={editor.getAttributes("image").align === "left"}
            onClick={() => editor.chain().focus().updateAttributes("image", { align: "left" }).run()}
          >
            <TbAlignLeft size={15} />
          </ToolbarButton>
          <ToolbarButton
            title="Align Center"
            active={editor.getAttributes("image").align === "center" || !editor.getAttributes("image").align}
            onClick={() => editor.chain().focus().updateAttributes("image", { align: "center" }).run()}
          >
            <TbAlignCenter size={15} />
          </ToolbarButton>
          <ToolbarButton
            title="Align Right"
            active={editor.getAttributes("image").align === "right"}
            onClick={() => editor.chain().focus().updateAttributes("image", { align: "right" }).run()}
          >
            <TbAlignRight size={15} />
          </ToolbarButton>

          <Divider />

          {/* Preset Sizes */}
          <span className="text-[11px] font-medium text-stone-400 font-sans">Size:</span>
          {(["25%", "50%", "75%", "100%"] as const).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => editor.chain().focus().updateAttributes("image", { width: size }).run()}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer",
                editor.getAttributes("image").width === size
                  ? "bg-stone-900 border-stone-900 text-white"
                  : "bg-white border-stone-200 hover:bg-stone-100 text-stone-600"
              )}
            >
              {size}
            </button>
          ))}

          {/* Slider for custom size */}
          <div className="flex items-center gap-2 ml-2">
            <span className="text-[11px] font-medium text-stone-400 font-sans">Custom:</span>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={parseInt(editor.getAttributes("image").width || "100")}
              onChange={(e) => editor.chain().focus().updateAttributes("image", { width: `${e.target.value}%` }).run()}
              className="w-20 accent-stone-900 cursor-pointer h-1.5 rounded-lg appearance-none bg-stone-200"
            />
            <span className="text-[11px] font-medium w-8 text-stone-600 font-sans text-right">
              {parseInt(editor.getAttributes("image").width || "100")}%
            </span>
          </div>

          <Divider />

          {/* Alt text */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <span className="text-[11px] font-medium text-stone-400 shrink-0 font-sans">Alt Text:</span>
            <input
              type="text"
              placeholder="Describe image..."
              value={editor.getAttributes("image").alt || ""}
              onChange={(e) => editor.chain().focus().updateAttributes("image", { alt: e.target.value }).run()}
              className="flex-1 max-w-[300px] h-6 px-2 rounded border border-stone-200 text-[11px] outline-none focus:ring-1 focus:ring-stone-900 bg-white text-stone-900"
            />
          </div>

          <Divider />

          {/* Delete Image */}
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteSelection().run()}
            className="p-1 rounded text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
            title="Delete Image"
          >
            <TbTrash size={15} />
          </button>
        </div>
      )}

      {/* Contextual video controls */}
      {editor.isActive("videoEmbed") && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-100 bg-stone-50/60 px-3 py-1.5 text-xs text-stone-500">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-stone-400">
            {editor.getAttributes("videoEmbed").kind === "youtube" ? "YouTube" : "Video"}
          </span>

          <Divider />

          <span className="text-[11px] font-medium text-stone-400 font-sans">Width:</span>
          {(["50%", "75%", "100%"] as const).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => editor.chain().focus().updateAttributes("videoEmbed", { width: size }).run()}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer",
                editor.getAttributes("videoEmbed").width === size
                  ? "bg-stone-900 border-stone-900 text-white"
                  : "bg-white border-stone-200 hover:bg-stone-100 text-stone-600"
              )}
            >
              {size}
            </button>
          ))}

          <Divider />

          <button
            type="button"
            onClick={() => editor.chain().focus().deleteSelection().run()}
            className="p-1 rounded text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
            title="Delete Video"
          >
            <TbTrash size={15} />
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
