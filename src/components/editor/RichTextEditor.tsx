"use client";

import { useEditor, EditorContent, Node as TiptapNode, mergeAttributes } from "@tiptap/react";
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
  X,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import ImagePickerModal, { type PickedImage } from "./ImagePickerModal";

const Figcaption = TiptapNode.create({
  name: "figcaption",
  group: "block",
  content: "inline*",
  selectable: false,
  draggable: false,
  defining: true,
  parseHTML() {
    return [{ tag: "figcaption" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figcaption", mergeAttributes(HTMLAttributes), 0];
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state } = this.editor;
        const { $from } = state.selection;
        if ($from.parent.type.name !== "figcaption") return false;
        const figureDepth = $from.depth - 1;
        if (figureDepth < 0 || $from.node(figureDepth).type.name !== "figure") {
          return false;
        }
        const afterPos = $from.after(figureDepth);
        return this.editor
          .chain()
          .insertContentAt(afterPos, { type: "paragraph" })
          .setTextSelection(afterPos + 1)
          .run();
      },
    };
  },
});

const Figure = TiptapNode.create({
  name: "figure",
  group: "block",
  content: "image figcaption?",
  draggable: true,
  isolating: true,
  defining: true,
  parseHTML() {
    return [{ tag: "figure" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes), 0];
  },
});

function isSafeMediaUrl(raw: string): boolean {
  const s = raw.trim();
  return /^https?:\/\//i.test(s) || /^\/(?!\/)/.test(s);
}

function isSafeHrefUrl(raw: string): boolean {
  const s = raw.trim();
  return /^https?:\/\//i.test(s) || /^\/(?!\/)/.test(s) || /^mailto:/i.test(s);
}

function computeEditorCounts(text: string): { words: number; chars: number } {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return { words: 0, chars: 0 };
  return {
    words: cleaned.split(" ").filter(Boolean).length,
    chars: cleaned.length,
  };
}

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
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "rounded-lg p-1.5 transition-colors",
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

type AiFeature =
  | "seo_title"
  | "meta_description"
  | "social_caption"
  | "content_ideas"
  | "write_article"
  | "high_ctr_meta"
  | "expand_article";

type AutomationAiFeature = "content_ideas" | "write_article" | "high_ctr_meta";

const AI_MODAL_META: Record<
  AutomationAiFeature,
  { title: string; label: string; placeholder: string; notesPlaceholder: string }
> = {
  content_ideas: {
    title: "Buat Ide Konten",
    label: "Topik atau Kata Kunci",
    placeholder: "Contoh: Kebijakan Ekonomi Digital Indonesia 2026",
    notesPlaceholder: "Sudut pandang, target pembaca, atau fokus tambahan (opsional)",
  },
  write_article: {
    title: "Tulis Draf Artikel Lengkap",
    label: "Topik atau Judul Artikel",
    placeholder: "Contoh: Dampak Penyesuaian Tarif Pajak terhadap UMKM",
    notesPlaceholder: "Arahan fokus, poin penting, atau konteks berita (opsional)",
  },
  high_ctr_meta: {
    title: "Variasi Judul & Meta (High CTR)",
    label: "Topik atau Judul Dasar",
    placeholder: "Masukkan judul dasar atau topik artikel...",
    notesPlaceholder: "Konteks tambahan untuk variasi judul & deskripsi (opsional)",
  },
};

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
  const [aiError, setAiError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ words: number; chars: number }>({ words: 0, chars: 0 });
  const [aiPromptModal, setAiPromptModal] = useState<{
    feature: AutomationAiFeature;
    topic: string;
    notes: string;
    error: string;
  } | null>(null);
  const [urlModal, setUrlModal] = useState<{
    kind: "link" | "youtube";
    url: string;
    error: string;
  } | null>(null);
  const [aiResultModal, setAiResultModal] = useState<{ title: string; text: string } | null>(null);
  const [copiedResult, setCopiedResult] = useState(false);
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
      Figure,
      Figcaption,
      Youtube.configure({ width: 640, height: 360 }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true, HTMLAttributes: { class: "tiptap-table" } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    onCreate: ({ editor: ed }) => {
      setCounts(computeEditorCounts(ed.getText({ blockSeparator: " " })));
    },
    onUpdate: ({ editor: ed }) => {
      setCounts(computeEditorCounts(ed.getText({ blockSeparator: " " })));
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "article-content prose prose-lg max-w-none font-serif min-h-[400px] px-6 py-4 focus:outline-none",
      },
    },
  });

  const handleImageSelect = useCallback(
    (input: string | PickedImage) => {
      if (!editor) return;
      const picked: PickedImage =
        typeof input === "string" ? { url: input } : input;
      if (!picked.url || !isSafeMediaUrl(picked.url)) return;

      const escapeHtml = (s: string) =>
        s
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

      const alt = escapeHtml(picked.title || "");
      const url = escapeHtml(picked.url.trim());
      const caption = picked.caption?.trim();
      const credit = picked.credit?.trim();

      // If we have caption or credit, insert as <figure> with figcaption.
      // Otherwise just insert a plain image so the existing TipTap Image extension owns it.
      if (caption || credit) {
        const captionHtml = caption ? escapeHtml(caption) : "";
        const creditHtml = credit
          ? `<em>Sumber: ${escapeHtml(credit)}</em>`
          : "";
        const separator = captionHtml && creditHtml ? " — " : "";
        const figureHtml = `<figure><img src="${url}" alt="${alt}" /><figcaption>${captionHtml}${separator}${creditHtml}</figcaption></figure><p></p>`;
        editor.chain().focus().insertContent(figureHtml).run();
      } else {
        editor.chain().focus().setImage({ src: picked.url.trim(), alt: picked.title || undefined }).run();
      }
    },
    [editor]
  );

  const addLink = useCallback(() => {
    setUrlModal({ kind: "link", url: "", error: "" });
  }, []);

  const addYoutube = useCallback(() => {
    setUrlModal({ kind: "youtube", url: "", error: "" });
  }, []);

  const submitUrlModal = useCallback(() => {
    if (!urlModal || !editor) return;
    const raw = urlModal.url.trim();
    if (!raw) {
      setUrlModal({ ...urlModal, error: "URL wajib diisi." });
      return;
    }
    if (urlModal.kind === "link") {
      if (!isSafeHrefUrl(raw)) {
        setUrlModal({ ...urlModal, error: "Gunakan URL http://, https://, mailto:, atau path /..." });
        return;
      }
      editor.chain().focus().setLink({ href: raw }).run();
    } else {
      if (!/^https?:\/\//i.test(raw)) {
        setUrlModal({ ...urlModal, error: "Masukkan URL YouTube yang diawali http:// atau https://." });
        return;
      }
      editor.chain().focus().setYoutubeVideo({ src: raw }).run();
    }
    setUrlModal(null);
  }, [urlModal, editor]);

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

  // Close active modals on Escape
  useEffect(() => {
    if (!aiPromptModal && !urlModal && !aiResultModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (aiPromptModal && !aiLoading) setAiPromptModal(null);
      if (urlModal) setUrlModal(null);
      if (aiResultModal) setAiResultModal(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aiPromptModal, urlModal, aiResultModal, aiLoading]);

  // Sync external content changes into the editor. TipTap's `useEditor` only reads
  // `content` once at init, so programmatic updates from the parent (e.g. the
  // Perplexity "Riset & Tulis" feature filling the body) would otherwise never
  // appear. Only push when the incoming HTML differs from the editor's current
  // HTML to avoid clobbering the caret on the user's own typing.
  useEffect(() => {
    if (!editor) return;
    const incoming = content || "";
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, { emitUpdate: false });
      setCounts(computeEditorCounts(editor.getText({ blockSeparator: " " })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor]);

  // ─── AI Tools ───
  const executeAi = useCallback(
    async (feature: AiFeature, topic?: string, extraNotes?: string) => {
      if (!editor) return;
      setAiError(null);

      const isAutomation =
        feature === "content_ideas" ||
        feature === "write_article" ||
        feature === "high_ctr_meta";
      const html = editor.getHTML();
      const plain = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

      if (!isAutomation && plain.length < 30) {
        setAiError("Tulis konten artikel terlebih dahulu (minimal 30 karakter).");
        return;
      }

      const cleanTopic = (topic || "").trim();
      if (isAutomation && !cleanTopic) {
        setAiError("Topik/judul untuk AI wajib diisi.");
        return;
      }

      const hint = isAutomation
        ? cleanTopic
        : articleTitle?.trim() ||
          (() => {
            const m = html.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i);
            return m ? m[1].trim() : plain.slice(0, 80);
          })();

      const contextContent = isAutomation
        ? plain.slice(0, 3000) || (extraNotes || "").trim() || cleanTopic
        : plain.slice(0, 3000);

      const apiFeature =
        feature === "seo_title"
          ? "seo_title"
          : feature === "meta_description"
          ? "meta_description"
          : feature === "social_caption"
          ? "summary"
          : feature;

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
            content: contextContent,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success || !data.data?.result) {
          setAiError(data.error || "Gagal generate AI");
          return;
        }
        const suggestion = String(data.data.result).trim();

        if (feature === "seo_title" && onAiTitle) {
          onAiTitle(suggestion);
        } else if (feature === "meta_description" && onAiMeta) {
          onAiMeta(suggestion);
        } else if (feature === "social_caption" && onAiCaption) {
          onAiCaption(suggestion);
        } else if (feature === "expand_article") {
          editor.chain().focus("end").insertContent(suggestion).run();
        } else if (isAutomation) {
          editor.chain().focus().insertContent(suggestion).run();
        } else {
          setCopiedResult(false);
          setAiResultModal({
            title:
              feature === "seo_title"
                ? "Saran Judul SEO"
                : feature === "meta_description"
                ? "Saran Meta Description"
                : "Saran Caption Sosmed",
            text: suggestion,
          });
        }
        setAiPromptModal(null);
      } catch {
        setAiError("Gagal menghubungi AI service. Coba lagi.");
      } finally {
        setAiLoading(null);
        setAiMenuOpen(false);
      }
    },
    [editor, articleTitle, onAiTitle, onAiMeta, onAiCaption]
  );

  const callAi = useCallback(
    (feature: AiFeature) => {
      if (!editor) return;
      setAiError(null);
      if (
        feature === "content_ideas" ||
        feature === "write_article" ||
        feature === "high_ctr_meta"
      ) {
        setAiMenuOpen(false);
        setAiPromptModal({
          feature,
          topic: articleTitle?.trim() || "",
          notes: "",
          error: "",
        });
        return;
      }
      void executeAi(feature);
    },
    [editor, articleTitle, executeAi]
  );

  if (!editor) return null;

  const inTable = editor.isActive("table");

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
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
              "flex items-center gap-0.5 rounded-lg p-1.5 transition-colors",
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
            className="flex items-center gap-0.5 rounded-lg p-1.5 text-primary transition-colors hover:bg-primary-light"
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
              <div className="border-t border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-txt-muted bg-surface-secondary">
                Automation Penulisan
              </div>
              <button
                type="button"
                onClick={() => callAi("content_ideas")}
                disabled={aiLoading !== null}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-txt-primary hover:bg-surface-secondary disabled:opacity-50"
              >
                {aiLoading === "content_ideas" ? (
                  <Loader2 size={12} className="animate-spin text-primary" />
                ) : (
                  <Sparkles size={12} className="text-primary" />
                )}
                Buat Ide Konten
              </button>
              <button
                type="button"
                onClick={() => callAi("write_article")}
                disabled={aiLoading !== null}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-txt-primary hover:bg-surface-secondary disabled:opacity-50"
              >
                {aiLoading === "write_article" ? (
                  <Loader2 size={12} className="animate-spin text-primary" />
                ) : (
                  <Sparkles size={12} className="text-primary" />
                )}
                Tulis Artikel Lengkap
              </button>
              <button
                type="button"
                onClick={() => callAi("expand_article")}
                disabled={aiLoading !== null}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-primary hover:bg-surface-secondary disabled:opacity-50"
              >
                {aiLoading === "expand_article" ? (
                  <Loader2 size={12} className="animate-spin text-primary" />
                ) : (
                  <Sparkles size={12} className="text-primary" />
                )}
                Perpanjang Isi Artikel (+ Paragraf)
              </button>
              <button
                type="button"
                onClick={() => callAi("high_ctr_meta")}
                disabled={aiLoading !== null}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-txt-primary hover:bg-surface-secondary disabled:opacity-50"
              >
                {aiLoading === "high_ctr_meta" ? (
                  <Loader2 size={12} className="animate-spin text-primary" />
                ) : (
                  <Sparkles size={12} className="text-primary" />
                )}
                Variasi Judul & Meta (High CTR)
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

      {aiError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 border-b border-border border-l-4 border-l-red-600 bg-surface px-4 py-2 text-xs text-red-700"
        >
          <span>{aiError}</span>
          <button
            type="button"
            onClick={() => setAiError(null)}
            className="rounded p-0.5 text-txt-muted hover:text-txt-primary"
            aria-label="Tutup pesan error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Word count */}
      <div className="border-t border-border px-4 py-2 text-xs text-txt-muted">
        {counts.words.toLocaleString("id-ID")} kata &middot;{" "}
        {counts.chars.toLocaleString("id-ID")} karakter &middot;{" "}
        ~{Math.max(1, Math.ceil(counts.words / 200))} menit baca
      </div>

      <ImagePickerModal
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onSelect={handleImageSelect}
      />

      {aiPromptModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rte-ai-prompt-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !aiLoading && setAiPromptModal(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="rte-ai-prompt-title" className="text-base font-bold text-txt-primary">
                {AI_MODAL_META[aiPromptModal.feature].title}
              </h3>
              <button
                type="button"
                onClick={() => !aiLoading && setAiPromptModal(null)}
                className="rounded-md p-1 text-txt-muted hover:text-txt-primary"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-txt-secondary">
                  {AI_MODAL_META[aiPromptModal.feature].label}
                </label>
                <input
                  type="text"
                  value={aiPromptModal.topic}
                  onChange={(e) =>
                    setAiPromptModal((prev) =>
                      prev ? { ...prev, topic: e.target.value, error: "" } : null
                    )
                  }
                  placeholder={AI_MODAL_META[aiPromptModal.feature].placeholder}
                  className="input w-full text-sm"
                  autoFocus
                  disabled={aiLoading !== null}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-txt-secondary">
                  Konteks / Arahan Tambahan <span className="font-normal text-txt-muted">(opsional)</span>
                </label>
                <textarea
                  rows={3}
                  value={aiPromptModal.notes}
                  onChange={(e) =>
                    setAiPromptModal((prev) =>
                      prev ? { ...prev, notes: e.target.value } : null
                    )
                  }
                  placeholder={AI_MODAL_META[aiPromptModal.feature].notesPlaceholder}
                  className="input w-full resize-none text-sm"
                  disabled={aiLoading !== null}
                />
              </div>
              {aiPromptModal.error && (
                <p role="alert" className="text-xs text-red-700">
                  {aiPromptModal.error}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAiPromptModal(null)}
                  disabled={aiLoading !== null}
                  className="btn-ghost text-xs disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={aiLoading !== null}
                  onClick={() => {
                    if (!aiPromptModal.topic.trim()) {
                      setAiPromptModal((prev) =>
                        prev ? { ...prev, error: "Topik atau judul wajib diisi." } : null
                      );
                      return;
                    }
                    void executeAi(
                      aiPromptModal.feature,
                      aiPromptModal.topic,
                      aiPromptModal.notes
                    );
                  }}
                  className="btn-primary inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {aiLoading ? "Memproses..." : "Generate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {urlModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rte-url-modal-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setUrlModal(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="rte-url-modal-title" className="text-base font-bold text-txt-primary">
                {urlModal.kind === "link" ? "Sisipkan Link" : "Sisipkan Video YouTube"}
              </h3>
              <button
                type="button"
                onClick={() => setUrlModal(null)}
                className="rounded-md p-1 text-txt-muted hover:text-txt-primary"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>
            <input
              type="url"
              value={urlModal.url}
              onChange={(e) =>
                setUrlModal((prev) => (prev ? { ...prev, url: e.target.value, error: "" } : null))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitUrlModal();
                }
              }}
              placeholder={
                urlModal.kind === "link"
                  ? "https://contoh.com/referensi"
                  : "https://www.youtube.com/watch?v=..."
              }
              className="input w-full text-sm"
              autoFocus
            />
            {urlModal.error && (
              <p role="alert" className="mt-2 text-xs text-red-700">
                {urlModal.error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setUrlModal(null)} className="btn-ghost text-xs">
                Batal
              </button>
              <button type="button" onClick={submitUrlModal} className="btn-primary text-xs">
                Sisipkan
              </button>
            </div>
          </div>
        </div>
      )}

      {aiResultModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rte-ai-result-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setAiResultModal(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="rte-ai-result-title" className="text-base font-bold text-txt-primary">
                {aiResultModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setAiResultModal(null)}
                className="rounded-md p-1 text-txt-muted hover:text-txt-primary"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>
            <textarea
              readOnly
              rows={4}
              value={aiResultModal.text}
              className="input w-full resize-none text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAiResultModal(null)}
                className="btn-ghost text-xs"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(aiResultModal.text).then(() => {
                    setCopiedResult(true);
                  }).catch(() => {});
                }}
                className="btn-primary inline-flex items-center gap-1.5 text-xs"
              >
                {copiedResult ? <Check size={13} /> : <Copy size={13} />}
                {copiedResult ? "Tersalin" : "Salin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
