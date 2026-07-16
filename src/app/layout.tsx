import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { Suspense } from "react";
import TopLoader from "@/components/layout/TopLoader";
import PublicNav from "@/components/layout/PublicNav";
import PublicTicker from "@/components/layout/PublicTicker";
import PublicFooter from "@/components/layout/PublicFooter";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import SideRailAds from "@/components/ads/SideRailAds";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import InstallTracker from "@/components/pwa/InstallTracker";
import InstallTeaser from "@/components/pwa/InstallTeaser";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import { getDewanPersNumber } from "@/lib/public-settings";


const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport = { width: "device-width", initialScale: 1 };

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com"
  ),
  title: {
    default: "Lensaplus — Portal Berita Digital Modern",
    template: "%s | Lensaplus",
  },
  description:
    "Portal berita digital modern — menyajikan informasi terkini seputar bisnis, ekonomi, pemerintahan, hukum, olahraga, hiburan, teknologi, dan peristiwa lokal tepercaya.",
  keywords: [
    "berita Bandung",
    "berita Jawa Barat",
    "berita Indonesia",
    "bisnis ekonomi",
    "pemerintahan",
    "kebijakan publik",
    "berita hukum",
    "putusan pengadilan",
    "olahraga",
    "hiburan",
    "teknologi",
    "media digital",
    "Lensaplus",
    "Lensa+",
  ],
  authors: [{ name: "Lensaplus" }],
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Lensaplus",
    title: "Lensaplus — Portal Berita Digital Modern",
    description:
      "Informasi digital terkini — menyajikan berita bisnis, ekonomi, pemerintahan, hukum, olahraga, hiburan, teknologi, dan peristiwa lokal tepercaya.",
    images: [{ url: "/lensaplus-icon.png", width: 512, height: 512, alt: "Lensaplus" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lensaplus — Portal Berita Digital Modern",
    description:
      "Informasi digital terkini — menyajikan berita bisnis, ekonomi, pemerintahan, hukum, olahraga, hiburan, teknologi, dan peristiwa lokal tepercaya.",
    images: ["/lensaplus-icon.png"],
  },
  verification: {
    google: "aOYlnEshfJKwCD4v8OePC3vgPACRIRt2bO5s9dziFj0",
    other: {
      ...(process.env.BING_VERIFICATION
        ? { "msvalidate.01": process.env.BING_VERIFICATION }
        : {}),
      ...(process.env.YANDEX_VERIFICATION
        ? { "yandex-verification": process.env.YANDEX_VERIFICATION }
        : {}),
    },
  },
  category: "news",
  icons: {
    icon: "/lensaplus-icon.png",
    apple: "/lensaplus-icon.png",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dewanPersNumber = await getDewanPersNumber();
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "ca-pub-5936356841993880";
  // Funding Choices uses the bare publisher id (pub-XXXX), not the ca-pub form.
  const fundingPubId = adsenseClientId.replace(/^ca-/, "");

  return (
    <html lang="id" className={`${plusJakartaSans.variable} ${inter.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        {/* RSS auto-discovery for feed readers (Feedly, Inoreader, NewsBlur, etc.) */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Lensaplus — Feed RSS Berita"
          href="/feed.xml"
        />
        <meta name="theme-color" content="#0F172A" />
        <meta name="google" content="notranslate" />
        {/* PWA / Add-to-Home-Screen */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Lensaplus" />
        {/* Dedicated 180x180 with white background */}
        <link rel="apple-touch-icon" sizes="180x180" href="/lensaplus-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationJsonLd(), websiteJsonLd()]),
          }}
        />
        {/* Google CMP — Funding Choices (GDPR/EEA + CCPA consent messaging).
            Loads the consent framework BEFORE the AdSense tag so consent can
            gate ad personalization. The actual consent message is created in
            AdSense → Privacy & messaging; this only loads the framework, and
            it shows nothing to non-EEA visitors (e.g. Indonesia). */}
        <script
          async
          src={`https://fundingchoicesmessages.google.com/i/${fundingPubId}?ers=1`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function signalGooglefcPresent(){if(!window.frames['googlefcPresent']){if(document.body){const e=document.createElement('iframe');e.style='width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;';e.style.display='none';e.name='googlefcPresent';document.body.appendChild(e);}else{setTimeout(signalGooglefcPresent,0);}}}signalGooglefcPresent();})();",
          }}
        />
        {/* Google AdSense Verification Script in Head */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
          crossOrigin="anonymous"
          data-cfasync="false"
        />
        {/* Google AdSense Meta Tag Verification */}
        <meta name="google-adsense-account" content={adsenseClientId} />
        {/* Google Analytics 4 (gtag) — Measurement ID from Pengaturan → Google.
            Renders nothing until configured, so safe to mount unconditionally. */}
        <GoogleAnalytics />
      </head>
      <body className="flex min-h-screen flex-col font-sans bg-surface text-on-surface antialiased">
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-[200] focus:bg-primary focus:text-on-primary focus:px-4 focus:py-2 focus:text-sm"
          >
            Langsung ke konten
          </a>
          <Suspense fallback={null}>
            <TopLoader />
          </Suspense>
          <PublicNav />
          <PublicTicker />
          <main id="main-content" className="flex-1">{children}</main>
          <PublicFooter dewanPersNumber={dewanPersNumber} />
          <SideRailAds />
          <ServiceWorkerRegistration />
          <InstallPrompt />
          <InstallTeaser />
          <InstallTracker />
        </Providers>
      </body>
    </html>
  );
}
