export const revalidate = 60;

import { Metadata } from "next";
import { getPublishedReels } from "@/lib/video-story";
import ReelGallery from "@/components/video/ReelGallery";

export const metadata: Metadata = {
  title: "Video Story",
  description:
    "Kumpulan Video Story (Reels) Kartawarta — cuplikan berita dalam format video vertikal.",
  alternates: { canonical: "/video" },
};

export default async function VideoPage() {
  const reels = await getPublishedReels(100);

  return (
    <div className="bg-surface min-h-screen">
      <div className="container-main py-6 sm:py-8 lg:py-10">
        <h1 className="flex items-center gap-3 font-serif text-headline-sm font-bold text-txt-primary sm:text-headline-md lg:text-headline-lg">
          <span className="block h-7 w-[3px] rounded-full bg-primary" />
          Video Story
        </h1>
        <p className="mt-1 text-sm text-txt-secondary">
          Reels Kartawarta — ketuk salah satu untuk memutar videonya.
        </p>

        <div className="mt-6">
          <ReelGallery items={reels} />
        </div>
      </div>
    </div>
  );
}
