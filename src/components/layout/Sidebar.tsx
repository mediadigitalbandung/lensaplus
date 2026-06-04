import Link from "next/link";
import Image from "next/image";

interface SidebarArticle {
  title: string;
  slug: string;
  category: string;
  publishedAt: string;
  viewCount?: number;
  featuredImage?: string | null;
}

interface SidebarProps {
  trending?: SidebarArticle[];
  recent?: SidebarArticle[];
  popular?: SidebarArticle[];
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m yang lalu`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}j yang lalu`;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}


export default function Sidebar({ trending = [], recent = [], popular = [] }: SidebarProps) {
  return (
    <aside className="space-y-8" aria-label="Sidebar artikel">
      {/* Trending */}
      {trending.length > 0 && (
        <section aria-labelledby="sidebar-trending-heading">
          <div className="flex items-center justify-between">
            <h3 id="sidebar-trending-heading" className="border-l-[3px] border-primary pl-3 text-sm font-bold uppercase tracking-wide text-txt-primary">Terpopuler 24 Jam</h3>
            <Link href="/search?q=trending" className="text-xs font-medium text-primary hover:underline">
              Lihat Lainnya &rarr;
            </Link>
          </div>
          <ul className="mt-4">
            {trending.map((article, i) => (
              <li
                key={article.slug}
                className={`flex gap-3 py-3 ${
                  i < trending.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span className="shrink-0 text-2xl font-extrabold leading-none text-primary/20">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Link
                  href={`/berita/${article.slug}`}
                  className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-secondary"
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  {article.featuredImage && (
                    <Image
                      src={article.featuredImage}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/berita/${article.slug}`}
                    className="line-clamp-2 text-sm font-semibold leading-snug text-txt-primary hover:underline"
                  >
                    {article.title}
                  </Link>
                  <div className="mt-1 flex items-center gap-2 text-xs text-txt-muted">
                    <span>{article.category}</span>
                    {article.viewCount ? (
                      <>
                        <span className="h-3 w-px bg-border" />
                        <span>{article.viewCount.toLocaleString("id-ID")} views</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Terbaru */}
      {recent.length > 0 && (
        <section aria-labelledby="sidebar-terbaru-heading">
          <h3 id="sidebar-terbaru-heading" className="border-l-[3px] border-primary pl-3 text-sm font-bold uppercase tracking-wide text-txt-primary">Terbaru</h3>
          <ul className="mt-4">
            {recent.map((article, i) => (
              <li
                key={article.slug}
                className={`py-3 ${
                  i < recent.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <Link
                  href={`/berita/${article.slug}`}
                  className="text-sm font-semibold leading-snug text-txt-primary hover:underline"
                >
                  {article.title}
                </Link>
                <p className="mt-1 text-xs text-txt-muted">
                  {formatTime(article.publishedAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Paling Dibaca */}
      {popular.length > 0 && (
        <section aria-labelledby="sidebar-populer-heading">
          <h3 id="sidebar-populer-heading" className="border-l-[3px] border-primary pl-3 text-sm font-bold uppercase tracking-wide text-txt-primary">Paling Dibaca</h3>
          <ul className="mt-4">
            {popular.map((article, i) => (
              <li
                key={article.slug}
                className={`py-3 ${
                  i < popular.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <Link
                  href={`/berita/${article.slug}`}
                  className="text-sm font-semibold leading-snug text-txt-primary hover:underline"
                >
                  {article.title}
                </Link>
                <div className="mt-1 flex items-center gap-2 text-xs text-txt-muted">
                  <span>{article.category}</span>
                  {article.viewCount && (
                    <>
                      <span className="h-3 w-px bg-border" />
                      <span>
                        {article.viewCount.toLocaleString("id-ID")} views
                      </span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
