import Link from "next/link";
import Image from "next/image";
import { Eye } from "lucide-react";
import { truncate } from "@/lib/utils";

// Small inline "X dilihat" badge shown next to the date in every card variant.
// Hidden when the count is missing or zero so brand-new articles stay clean.
function Views({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <>
      <span className="mx-1 sm:mx-1.5">&middot;</span>
      <span className="inline-flex items-center gap-0.5 align-middle normal-case">
        <Eye size={11} aria-hidden />
        {count.toLocaleString("id-ID")}
      </span>
    </>
  );
}

interface ArticleCardProps {
  title: string;
  slug: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  category: { name: string; slug: string };
  author: { name: string };
  publishedAt: Date | string | null;
  readTime?: number | null;
  viewCount?: number;
  verificationLabel?: string;
  variant?: "hero" | "standard" | "compact" | "headline" | "default" | "featured";
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m yang lalu`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}j yang lalu`;
  return formatDate(date);
}

export default function ArticleCard({
  title,
  slug,
  excerpt,
  featuredImage,
  category,
  author,
  publishedAt,
  readTime,
  viewCount,
  verificationLabel = "UNVERIFIED",
  variant = "standard",
}: ArticleCardProps) {
  /* ── Hero variant ── */
  if (variant === "hero" || variant === "featured") {
    return (
      <article className="group">
        <Link href={`/berita/${slug}`} className="block">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm">
            {featuredImage ? (
              <Image
                src={featuredImage}
                alt={title}
                fill
                priority
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full bg-surface-container-low" />
            )}
            {/* Kartawarta-red accent line that wipes in left→right on hover */}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-secondary transition-transform duration-500 ease-out group-hover:scale-x-100" />
          </div>
        </Link>
        <div className="mt-4">
          <Link
            href={`/kategori/${category.slug}`}
            className="text-label-md font-bold uppercase tracking-wider text-primary"
          >
            {category.name}
          </Link>
          <Link href={`/berita/${slug}`}>
            <h2 className="mt-2 font-serif text-headline-md leading-tight text-on-surface transition-colors duration-300 group-hover:text-primary">
              {title}
            </h2>
          </Link>
          {excerpt && (
            <p className="mt-3 line-clamp-3 text-body-md leading-relaxed text-on-surface-variant">
              {truncate(excerpt, 200)}
            </p>
          )}
          <p className="mt-3 text-label-md uppercase tracking-wider text-on-surface-variant">
            {formatTime(publishedAt)}
            <span className="mx-1.5">&middot;</span>
            {author.name}
            <Views count={viewCount} />
          </p>
        </div>
      </article>
    );
  }

  /* ── Compact variant ── */
  if (variant === "compact") {
    return (
      <article className="group flex gap-4">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-sm">
          {featuredImage ? (
            <Image
              src={featuredImage}
              alt={title}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-surface-container-low" />
          )}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-secondary transition-transform duration-500 ease-out group-hover:scale-x-100" />
        </div>
        <div className="flex flex-1 flex-col justify-center min-w-0">
          <Link
            href={`/berita/${slug}`}
            className="line-clamp-2 text-title-sm leading-snug text-on-surface transition-colors duration-300 group-hover:text-primary"
          >
            {title}
          </Link>
          <p className="mt-1.5 text-label-sm uppercase tracking-wider text-on-surface-variant">
            {formatTime(publishedAt)}
            <Views count={viewCount} />
          </p>
        </div>
      </article>
    );
  }

  /* ── Headline variant — no border, use spacing ── */
  if (variant === "headline") {
    return (
      <article className="group border-l-2 border-transparent pb-4 mb-4 pl-0 transition-all duration-300 ease-out hover:border-secondary hover:pl-3">
        <Link
          href={`/kategori/${category.slug}`}
          className="text-label-md font-bold uppercase tracking-wider text-primary"
        >
          {category.name}
        </Link>
        <Link href={`/berita/${slug}`}>
          <h3 className="mt-1 text-title-sm leading-snug text-on-surface transition-colors duration-300 group-hover:text-primary">
            {title}
          </h3>
        </Link>
        <p className="mt-1.5 text-label-sm uppercase tracking-wider text-on-surface-variant">
          {formatTime(publishedAt)}
          <Views count={viewCount} />
        </p>
      </article>
    );
  }

  /* ── Standard / Default variant ──
     Ukuran scale 2-tahap: di mobile sempit (<sm) card biasanya 2-per-baris
     dengan lebar ~140-180px, jadi font dan padding kecil supaya konten
     terbaca utuh tanpa overflow. Di sm+ (≥640px) card lebih lebar (~280px+)
     jadi naik ke ukuran title-lg yang generous. */
  return (
    <article className="group">
      <Link href={`/berita/${slug}`} className="block">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm">
          {featuredImage ? (
            <Image
              src={featuredImage}
              alt={title}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-surface-container-low" />
          )}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-secondary transition-transform duration-500 ease-out group-hover:scale-x-100" />
        </div>
      </Link>
      <div className="mt-2 sm:mt-3">
        <Link
          href={`/kategori/${category.slug}`}
          className="text-[10px] sm:text-label-md font-bold uppercase tracking-wider text-primary"
        >
          {category.name}
        </Link>
        <Link href={`/berita/${slug}`}>
          <h3 className="mt-1 sm:mt-1.5 line-clamp-2 font-serif text-title-sm sm:text-title-lg leading-snug text-on-surface transition-colors duration-300 group-hover:text-primary">
            {title}
          </h3>
        </Link>
        <p className="mt-1.5 sm:mt-2.5 text-[10px] sm:text-label-md uppercase tracking-wider text-on-surface-variant truncate">
          {formatTime(publishedAt)}
          <span className="mx-1 sm:mx-1.5">&middot;</span>
          {author.name}
          <Views count={viewCount} />
        </p>
      </div>
    </article>
  );
}
