"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Printer, List } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

interface Props {
  markdown: string;
  errorMessage?: string | null;
}

function slugifyHeading(text: string, index: number) {
  const base = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base ? `doc-${base}-${index}` : `doc-heading-${index}`;
}

export default function DocumentationClient({
  markdown,
  errorMessage,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Render markdown with TOC
  const { html, toc } = useMemo(() => {
    if (!markdown)
      return { html: "", toc: [] as TocEntry[] };

    const tocEntries: TocEntry[] = [];
    const renderer = new marked.Renderer();
    let headingIndex = 0;

    renderer.heading = ({ tokens, depth }) => {
      const text = tokens
        .map((t) => ("text" in t && typeof t.text === "string" ? t.text : ""))
        .join("");
      const id = slugifyHeading(text, headingIndex++);
      if (depth <= 3) {
        tocEntries.push({ id, text, level: depth });
      }
      return `<h${depth} id="${id}" class="doc-h doc-h${depth}">${text}</h${depth}>`;
    };

    marked.use({ renderer });
    const rawHtml = marked.parse(markdown, {
      async: false,
      breaks: false,
      gfm: true,
    }) as string;

    const clean = DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ["id", "class"],
    });

    return { html: clean, toc: tocEntries };
  }, [markdown]);

  // Scroll spy
  useEffect(() => {
    if (toc.length === 0) return;
    const container = contentRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "0px 0px -75% 0px", threshold: 0 },
    );

    const headings = container.querySelectorAll<HTMLElement>(
      "h1[id], h2[id], h3[id]",
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [toc]);

  function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handlePrint() {
    window.print();
  }

  if (errorMessage) {
    return (
      <div>
        <div className="mb-6 flex items-center gap-2">
          <BookOpen size={24} className="text-primary" />
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
            Dokumentasi
          </h1>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">Gagal memuat: {errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="doc-wrap">
      <style jsx global>{`
        .doc-wrap .doc-content {
          font-family: var(--font-newsreader), serif;
          color: #191c1d;
          line-height: 1.7;
        }
        .doc-wrap .doc-content h1.doc-h {
          font-size: 2rem;
          font-weight: 700;
          margin: 2rem 0 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #c4c6d0;
          scroll-margin-top: 5rem;
        }
        .doc-wrap .doc-content h2.doc-h {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 1.5rem 0 0.75rem;
          color: #002045;
          scroll-margin-top: 5rem;
        }
        .doc-wrap .doc-content h3.doc-h {
          font-size: 1.2rem;
          font-weight: 700;
          margin: 1.25rem 0 0.5rem;
          scroll-margin-top: 5rem;
        }
        .doc-wrap .doc-content p {
          margin: 0.75rem 0;
        }
        .doc-wrap .doc-content ul,
        .doc-wrap .doc-content ol {
          padding-left: 1.5rem;
          margin: 0.75rem 0;
        }
        .doc-wrap .doc-content li {
          margin: 0.25rem 0;
        }
        .doc-wrap .doc-content code {
          background: #e8eaeb;
          padding: 0.1rem 0.35rem;
          border-radius: 3px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.85em;
        }
        .doc-wrap .doc-content pre {
          background: #002045;
          color: #e8edf3;
          padding: 1rem;
          border-radius: 8px;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .doc-wrap .doc-content pre code {
          background: transparent;
          padding: 0;
          color: inherit;
        }
        .doc-wrap .doc-content blockquote {
          border-left: 4px solid #002045;
          padding: 0.25rem 1rem;
          color: #44474e;
          background: #f1f3f4;
          margin: 1rem 0;
          border-radius: 0 6px 6px 0;
        }
        .doc-wrap .doc-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.9rem;
        }
        .doc-wrap .doc-content th,
        .doc-wrap .doc-content td {
          border: 1px solid #c4c6d0;
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .doc-wrap .doc-content th {
          background: #e8eaeb;
          font-weight: 600;
        }
        .doc-wrap .doc-content a {
          color: #002045;
          text-decoration: underline;
        }
        .doc-wrap .doc-content hr {
          border: 0;
          border-top: 1px solid #c4c6d0;
          margin: 2rem 0;
        }

        @media print {
          .doc-sidebar,
          .doc-topbar {
            display: none !important;
          }
          .doc-content {
            max-width: 100% !important;
          }
        }
      `}</style>

      <div className="doc-topbar mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen size={24} className="text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
              Dokumentasi Fitur
            </h1>
          </div>
          <p className="mt-1 text-sm text-txt-secondary">
            docs/FEATURE_REFERENCE.md — referensi lengkap fitur Kartawarta.
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="btn-secondary flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold"
        >
          <Printer size={14} />
          Print / PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar ToC */}
        <aside className="doc-sidebar hidden lg:block">
          <div className="sticky top-20 rounded-2xl border border-border bg-surface p-4 shadow-card max-h-[calc(100vh-6rem)] overflow-y-auto">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-txt-secondary mb-3 uppercase tracking-wider">
              <List size={12} /> Daftar Isi
            </h3>
            {toc.length === 0 ? (
              <p className="text-xs text-txt-muted">
                Tidak ada heading.
              </p>
            ) : (
              <nav className="space-y-0.5">
                {toc.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => scrollToId(t.id)}
                    className={`block w-full text-left text-xs leading-tight py-1.5 rounded px-2 transition-colors ${
                      activeId === t.id
                        ? "bg-primary-light text-primary font-semibold"
                        : "text-txt-secondary hover:bg-surface-secondary"
                    } ${t.level === 2 ? "pl-4" : ""} ${
                      t.level === 3 ? "pl-6" : ""
                    }`}
                  >
                    {t.text}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </aside>

        {/* Content */}
        <div
          ref={contentRef}
          className="doc-content rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card max-w-4xl"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
