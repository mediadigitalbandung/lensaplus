import Link from "next/link";
import Image from "next/image";
import { truncate } from "@/lib/utils";
import ClientDate from "@/components/ClientDate";

// Small inline "X dilihat" count shown next to the date in every card variant.
// Hidden when the count is missing or zero so brand-new articles stay clean.
function Views({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <>
      <span className="mx-1 sm:mx-1.5">&middot;</span>
      <span className="align-middle normal-case">
        {count.toLocaleString("id-ID")} dilihat
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

export default function ArticleCard({
  title,
  slug,
  excerpt,
  featuredImage,
  category,
  author,
  publishedAt,
  viewCount,
  variant = "standard",
}: ArticleCardProps) {
  /* ── Hero variant ── */
  if (variant === "hero" || variant === "featured") {
    return (
      <article className="group">
        <Link href={`/berita/${slug}`} className="block">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl sm:rounded-2xl shadow-[0_4px_24px_rgba(28,25,23,0.03)] border border-stone-200/40">
            {featuredImage ? (
              <Image
                src={featuredImage}
                alt={title}
                fill
                priority
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
            ) : (
              <div className="h-full w-full bg-surface-container-low" />
            )}
          </div>
        </Link>
        <div className="mt-2.5 sm:mt-4">
          <Link
            href={`/kategori/${category.slug}`}
            className="inline-block text-[10px] sm:text-label-md font-bold uppercase tracking-wider text-primary hover:text-primary-dark transition-colors"
          >
            {category.name}
          </Link>
          <Link href={`/berita/${slug}`}>
            <h2 className="mt-1.5 sm:mt-2.5 font-serif text-title-lg sm:text-headline-md leading-tight text-on-surface transition-colors duration-300 group-hover:text-primary">
              {title}
            </h2>
          </Link>
          {excerpt && (
            <p className="mt-2 sm:mt-3 line-clamp-2 sm:line-clamp-3 text-body-sm sm:text-body-md leading-relaxed text-on-surface-variant">
              {truncate(excerpt, 200)}
            </p>
          )}
          <p className="mt-2 sm:mt-3 text-[10px] sm:text-label-md uppercase tracking-wider text-on-surface-variant truncate">
            {publishedAt && (
              <>
                <ClientDate date={publishedAt} format="relative-or-long" />
                <span className="mx-1.5">&middot;</span>
              </>
            )}
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
      <article className="group flex gap-3 sm:gap-4">
        <div className="relative h-16 w-24 sm:h-20 sm:w-28 shrink-0 overflow-hidden rounded-lg sm:rounded-xl border border-stone-200/40">
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
        </div>
        <div className="flex flex-1 flex-col justify-center min-w-0">
          <Link
            href={`/berita/${slug}`}
            className="line-clamp-2 text-[13px] sm:text-title-sm leading-snug text-on-surface transition-colors duration-300 group-hover:text-primary"
          >
            {title}
          </Link>
          <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-label-sm uppercase tracking-wider text-on-surface-variant truncate">
            {publishedAt && <ClientDate date={publishedAt} format="relative-or-long" />}
            <Views count={viewCount} />
          </p>
        </div>
      </article>
    );
  }

  /* ── Headline variant — no border, use spacing ── */
  if (variant === "headline") {
    return (
      <article className="group border-l-2 border-transparent pb-3 mb-3 sm:pb-4 sm:mb-4 pl-0 transition-all duration-300 ease-out hover:border-primary hover:pl-3">
        <Link
          href={`/kategori/${category.slug}`}
          className="text-[10px] sm:text-label-md font-bold uppercase tracking-wider text-primary hover:text-primary-dark transition-colors"
        >
          {category.name}
        </Link>
        <Link href={`/berita/${slug}`}>
          <h3 className="mt-1 text-title-sm leading-snug text-on-surface transition-colors duration-300 group-hover:text-primary">
            {title}
          </h3>
        </Link>
        <p className="mt-1 sm:mt-1.5 text-[10px] sm:text-label-sm uppercase tracking-wider text-on-surface-variant">
          {publishedAt && <ClientDate date={publishedAt} format="relative-or-long" />}
          <Views count={viewCount} />
        </p>
      </article>
    );
  }

  /* ── Standard / Default variant ── */
  return (
    <article className="group">
      <Link href={`/berita/${slug}`} className="block">
        <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden rounded-lg sm:rounded-xl border border-stone-200/40 shadow-[0_2px_12px_rgba(28,25,23,0.015)]">
          {featuredImage ? (
            <Image
              src={featuredImage}
              alt={title}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="h-full w-full bg-surface-container-low" />
          )}
        </div>
      </Link>
      <div className="mt-2 sm:mt-3">
        <Link
          href={`/kategori/${category.slug}`}
          className="inline-block text-[10px] sm:text-label-sm font-bold uppercase tracking-wider text-primary hover:text-primary-dark transition-colors mb-0.5 sm:mb-1"
        >
          {category.name}
        </Link>
        <Link href={`/berita/${slug}`}>
          <h3 className="mt-0.5 sm:mt-1 line-clamp-2 font-serif text-[13px] sm:text-title-md lg:text-title-lg leading-snug text-on-surface transition-colors duration-300 group-hover:text-primary">
            {title}
          </h3>
        </Link>
        <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-label-sm uppercase tracking-wider text-on-surface-variant truncate">
          {publishedAt && (
            <>
              <ClientDate date={publishedAt} format="relative-or-long" />
              <span className="mx-1 sm:mx-1.5">&middot;</span>
            </>
          )}
          {author.name}
          <Views count={viewCount} />
        </p>
      </div>
    </article>
  );
}
