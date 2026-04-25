"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  ImageIcon,
  LinkIcon,
  Youtube as YoutubeIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Code,
  Minus,
  Table as TableIcon,
  Sparkles,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import ImagePickerModal from "./ImagePickerModal";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /**
   * Optional context — used by AI Tools to know the current article title.
   * If not provided, AI Tools fall back to the first heading or a snippet.
   */
  articleTitle?: string;
  /**
   * Optional callbacks for AI tools — when provided, the AI result is also
   * dispatched to the parent (e.g. to populate the title or meta-desc field).
   */
  onAiTitle?: (suggestion: string) => void;
  onAiMeta?: (suggestion: string) => void;
  onAiCaption?: (suggestion: string) => void;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded p-1.5 transition-colors",
        active
          ? "bg-primary-light text-primary"
          : "text-txt-secondary hover:bg-surface-secondary",
        disabled && "cursor-not-allowed opacity-30"
      )}
    >
      {children}
    </button>
  );
}

type AiFeature = "seo_title" | "meta_description" | "social_caption";

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Tulis artikel Anda di sini...",
  articleTitle,
  onAiTitle,
  onAiMeta,
  onAiCaption,
}: RichTextEditorProps) {
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState<AiFeature | null>(null);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const aiMenuRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      ImageExtension.configure({ inline: false }),
      Youtube.configure({ width: 640, height: 360 }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true, HTMLAttributes: { class: "tiptap-table" } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "article-content prose prose-lg max-w-none font-serif min-h-[400px] px-6 py-4 focus:outline-none",
      },
    },
  });

  const handleImageSelect = useCallback(
    (url: string) => {
      if (url && editor) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
    [editor]
  );

  const addLink = useCallback(() => {
    const url = window.prompt("Masukkan URL link:");
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const addYoutube = useCallback(() => {
    const url = window.prompt("Masukkan URL video YouTube:");
    if (url && editor) {
      editor.chain().focus().setYoutubeVideo({ src: url }).run();
    }
  }, [editor]);

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target as Node)) {
        setTableMenuOpen(false);
      }
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setAiMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── AI Tools ───
  const callAi = useCallback(
    async (feature: AiFeature) => {
      if (!editor) return;
      const html = editor.getHTML();
      const plain = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (plain.length < 30) {
        window.alert("Tulis konten artikel terlebih dahulu (minimal 30 karakter).");
        return;
      }

      // Derive a title-ish hint
      const hint =
        articleTitle?.trim() ||
        (() => {
          const m = html.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i);
          return m ? m[1].trim() : plain.slice(0, 80);
        })();

      // Map the editor's AI feature to the /api/ai/generate route's feature param
      const apiFeature =
        feature === "seo_title"
          ? "seo_title"
          : feature === "meta_description"
          ? "meta_description"
          : "summary"; // social caption uses summary path; below we tweak the prompt-side via title hint

      setAiLoading(feature);
      try {
        const res = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feature: apiFeature,
            title:
              feature === "social_caption"
                ? `[Caption Sosmed Instagram/Twitter, gaya engaging, ≤220 karakter, sertakan 3 hashtag relevan] ${hint}`
                : hint,
            content: plain.slice(0, 3000),
          }),
        });
        const data = await res.json();
        if (!data.success || !data.data?.result) {
          window.alert(data.error || "Gagal generate AI");
          return;
        }
        const suggestion = String(data.data.result).trim();

        // Dispatch via callback if provided, else prompt to copy
        if (feature === "seo_title" && onAiTitle) {
          onAiTitle(suggestion);
        } else if (feature === "meta_description" && onAiMeta) {
          onAiMeta(suggestion);
        } else if (feature === "social_caption" && onAiCaption) {
          onAiCaption(suggestion);
        } else {
          // Fallback: show & let user copy
          window.prompt("Hasil AI (Ctrl+C untuk salin):", suggestion);
        }
      } catch {
        window.alert("Gagal menghubungi AI service. Coba lagi.");
      } finally {
        setAiLoading(null);
        setAiMenuOpen(false);
      }
    },
    [editor, articleTitle, onAiTitle, onAiMeta, onAiCaption]
  );

  if (!editor) return null;

  const inTable = editor.isActive("table");

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Underline"
        >
          <UnderlineIcon size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough size={16} />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 size={16} />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Kutipan"
        >
          <Quote size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code Block (Pasal)"
        >
          <Code size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          <Minus size={16} />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="Rata Kiri"
        >
          <AlignLeft size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="Rata Tengah"
        >
          <AlignCenter size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title="Rata Kanan"
        >
          <AlignRight size={16} />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Media */}
        <ToolbarButton onClick={() => setImagePickerOpen(true)} title="Sisipkan Gambar (upload / galeri)">
          <ImageIcon size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={addLink} active={editor.isActive("link")} title="Sisipkan Link">
          <LinkIcon size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={addYoutube} title="Sisipkan Video YouTube">
          <YoutubeIcon size={16} />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Table dropdown */}
        <div className="relative" ref={tableMenuRef}>
          <button
            type="button"
            onClick={() => {
              setTableMenuOpen((s) => !s);
              setAiMenuOpen(false);
            }}
            title="Tabel"
            className={cn(
              "flex items-center gap-0.5 rounded p-1.5 transition-colors",
              inTable
                ? "bg-primary-light text-primary"
                : "text-txt-secondary hover:bg-surface-secondary"
            )}
          >
            <TableIcon size={16} />
            <ChevronDown size={11} />
          </button>
          {tableMenuOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 min-w-[180px] rounded-md border border-border bg-surface shadow-lg">
              <button
                type="button"
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run();
                  setTableMenuOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs text-txt-primary hover:bg-surface-secondary"
              >
                Sisipkan Tabel 3×3
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnBefore().run()}
                disabled={!inTable}
                className="block w-full px-3 py-2 text-left text-xs text-txt-secondary hover:bg-surface-secondary disabled:opacity-40"
              >
                Tambah kolom kiri
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                disabled={!inTable}
                className="block w-full px-3 py-2 text-left text-xs text-txt-secondary hover:bg-surface-secondary disabled:opacity-40"
              >
                Tambah kolom kanan
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteColumn().run()}
                disabled={!inTable}
                className="block w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Hapus kolom
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={() => editor.chain().focus().addRowBefore().run()}
                disabled={!inTable}
                className="block w-full px-3 py-2 text-left text-xs text-txt-secondary hover:bg-surface-secondary disabled:opacity-40"
              >
                Tambah baris atas
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                disabled={!inTable}
                className="block w-full px-3 py-2 text-left text-xs text-txt-secondary hover:bg-surface-secondary disabled:opacity-40"
              >
                Tambah baris bawah
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteRow().run()}
                disabled={!inTable}
                className="block w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Hapus baris
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                disabled={!inTable}
                className="block w-full px-3 py-2 text-left text-xs text-txt-secondary hover:bg-surface-secondary disabled:opacity-40"
              >
                Toggle baris header
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().deleteTable().run();
                  setTableMenuOpen(false);
                }}
                disabled={!inTable}
                className="block w-full px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                Hapus tabel
              </button>
            </div>
          )}
        </div>

        {/* AI Tools dropdown */}
        <div className="relative" ref={aiMenuRef}>
          <button
            type="button"
            onClick={() => {
              setAiMenuOpen((s) => !s);
              setTableMenuOpen(false);
            }}
            title="AI Tools"
            className="flex items-center gap-0.5 rounded p-1.5 text-primary transition-colors hover:bg-primary-light"
          >
            {aiLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            <ChevronDown size={11} />
          </button>
          {aiMenuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 min-w-[220px] rounded-md border border-border bg-surface shadow-lg">
              <div className="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-txt-muted">
                AI Tools
              </div>
              <button
                type="button"
                onClick={() => callAi("seo_title")}
                disabled={aiLoading !== null}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-txt-primary hover:bg-surface-secondary disabled:opacity-50"
              >
                {aiLoading === "seo_title" ? (
                  <Loader2 size={12} className="animate-spin text-primary" />
                ) : (
                  <Sparkles size={12} className="text-primary" />
                )}
                Generate Judul (SEO)
              </button>
              <button
                type="button"
                onClick={() => callAi("meta_description")}
                disabled={aiLoading !== null}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-txt-primary hover:bg-surface-secondary disabled:opacity-50"
              >
                {aiLoading === "meta_description" ? (
                  <Loader2 size={12} className="animate-spin text-primary" />
                ) : (
                  <Sparkles size={12} className="text-primary" />
                )}
                Generate Meta Description
              </button>
              <button
                type="button"
                onClick={() => callAi("social_caption")}
                disabled={aiLoading !== null}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-txt-primary hover:bg-surface-secondary disabled:opacity-50"
              >
                {aiLoading === "social_caption" ? (
                  <Loader2 size={12} className="animate-spin text-primary" />
                ) : (
                  <Sparkles size={12} className="text-primary" />
                )}
                Generate Caption Sosmed
              </button>
            </div>
          )}
        </div>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo size={16} />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Word count */}
      <div className="border-t border-border px-4 py-2 text-xs text-txt-muted">
        {editor.storage.characterCount?.words?.() ?? 0} kata &middot;{" "}
        {editor.storage.characterCount?.characters?.() ?? 0} karakter &middot;{" "}
        ~{Math.max(1, Math.ceil((editor.storage.characterCount?.words?.() ?? 0) / 200))} menit baca
      </div>

      <ImagePickerModal
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onSelect={handleImageSelect}
      />
    </div>
  );
}
