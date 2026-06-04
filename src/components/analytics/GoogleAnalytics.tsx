import Script from "next/script";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Injects the Google Analytics 4 (gtag.js) tracking tag into every public page
 * so GA4 actually COLLECTS pageviews/users. Without this tag, the GA4 Data-API
 * reader in `src/lib/stats/google-analytics.ts` has no data to report.
 *
 * The Measurement ID (G-XXXXXXX) is read from `SystemSetting.ga4_measurement_id`
 * (settable in Pengaturan → Google, no redeploy needed) with an env fallback.
 * The DB read is wrapped in `unstable_cache` (5-min TTL) so it does NOT opt the
 * whole site out of static/ISR rendering. Renders nothing until a valid ID is
 * configured, so it's safe to mount unconditionally.
 */
const getMeasurementId = unstable_cache(
  async (): Promise<string> => {
    try {
      const row = await prisma.systemSetting.findUnique({
        where: { key: "ga4_measurement_id" },
      });
      return (row?.value || "").trim();
    } catch {
      return "";
    }
  },
  ["ga4-measurement-id"],
  { revalidate: 300, tags: ["ga4-measurement-id"] },
);

export default async function GoogleAnalytics() {
  const fromDb = await getMeasurementId();
  const id = (fromDb || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "").trim();

  // Only emit the tag for a well-formed Measurement ID (G-XXXXXXXX).
  if (!/^G-[A-Z0-9]{4,}$/i.test(id)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
