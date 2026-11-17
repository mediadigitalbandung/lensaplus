"use client";

import { useState } from "react";
import { Link2, Check, Image } from "lucide-react";

interface ShareBarProps {
  articleUrl: string;
  articleTitle: string;
  /** Article slug — used to build the Story Card download link. Optional for backward compatibility. */
  slug?: string;
}

interface SharePlatform {
  name: string;
  letter: string;
  url: string;
  bg: string;
  hoverBg: string;
}

export default function ShareBar({ articleUrl, articleTitle, slug }: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  const platforms: SharePlatform[] = [
    {
      name: "WhatsApp",
      letter: "W",
      url: `https://wa.me/?text=${encodeURIComponent(articleTitle + " " + articleUrl)}`,
      bg: "bg-green-500",
      hoverBg: "hover:bg-green-600",
    },
    {
      name: "Twitter",
      letter: "X",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(articleTitle)}&url=${encodeURIComponent(articleUrl)}`,
      bg: "bg-black",
      hoverBg: "hover:bg-gray-800",
    },
    {
      name: "Facebook",
      letter: "F",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`,
      bg: "bg-blue-600",
      hoverBg: "hover:bg-blue-700",
    },
    {
      name: "Telegram",
      letter: "T",
      url: `https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(articleTitle)}`,
      bg: "bg-blue-400",
      hoverBg: "hover:bg-blue-500",
    },
    {
      name: "LinkedIn",
      letter: "in",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`,
      bg: "bg-blue-700",
      hoverBg: "hover:bg-blue-800",
    },
  ];

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(articleUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = articleUrl;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-3 rounded-sm bg-surface-secondary p-3 sm:p-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-txt-secondary">Bagikan</span>
        <div className="flex flex-wrap gap-2">
          {platforms.map((platform) => (
            <a
              key={platform.name}
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold text-white transition-all active:scale-95 ${platform.bg} ${platform.hoverBg}`}
              title={`Bagikan ke ${platform.name}`}
              aria-label={`Bagikan ke ${platform.name}`}
            >
              <span className="text-[11px] font-bold">{platform.letter}</span>
              <span className="hidden sm:inline">{platform.name}</span>
            </a>
          ))}

          {/* Copy Link Button */}
          <button
            onClick={handleCopyLink}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold text-white transition-all active:scale-95 ${
              copied ? "bg-primary" : "bg-stone-600 hover:bg-stone-700"
            }`}
            title="Salin Link"
            aria-label="Salin tautan artikel"
          >
            {copied ? <Check size={13} /> : <Link2 size={13} />}
            <span className="hidden sm:inline">
              {copied ? "Tersalin!" : "Salin Link"}
            </span>
          </button>

          {/* Story Card Button — opens portrait JPEG for WA Status / IG Story */}
          {slug && (
            <a
              href={`/api/og/story?slug=${encodeURIComponent(slug)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-primary-dark active:scale-95"
              title="Unduh Story Card untuk WA Status / IG Story"
              aria-label="Unduh Story Card untuk WA Status / IG Story"
            >
              <Image size={13} />
              <span className="hidden sm:inline">Story Card</span>
            </a>
          )}
        </div>
      </div>

      {/* Toast notification */}
      {copied && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white shadow-lg whitespace-nowrap">
            <Check size={14} />
            Link berhasil disalin!
          </div>
        </div>
      )}
    </div>
  );
}
