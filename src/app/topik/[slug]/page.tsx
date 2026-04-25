import { redirect } from "next/navigation";

/**
 * `/topik/[slug]` is an alias for `/kategori/[slug]`.
 *
 * The canonical category page already provides the full topic experience —
 * sliders, polling, paginated articles, sidebar — so this route 308-redirects
 * to it. Search engines and shared links resolve to the canonical URL.
 */
export default function TopikDetailRedirect({
  params,
}: {
  params: { slug: string };
}) {
  redirect(`/kategori/${params.slug}`);
}
