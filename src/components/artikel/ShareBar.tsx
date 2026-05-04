"use client";

import { useState } from "react";
import { Share2, Link2, Check } from "lucide-react";

interface ShareBarProps {
  articleUrl: string;
  articleTitle: string;
}

interface SharePlatform {
  name: string;
  letter: string;
  url: string;
  bg: string;
  hoverBg: string;
}

export default function ShareBar({ articleUrl, articleTitle }: ShareBarProps) {
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
        <div className="flex items-center gap-2 text-txt-secondary">
          <Share2 size={14} />
          <span className="text-xs font-semibold uppercase tracking-wider">Bagikan</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {platforms.map((platform) => (
            <a
              key={platform.name}
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-white transition-all active:scale-95 ${platform.bg} ${platform.hoverBg}`}
              title={`Bagikan ke ${platform.name}`}
              aria-label={`Bagikan ke ${platform.name}`}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                {platform.letter}
              </span>
              <span className="hidden sm:inline">{platform.name}</span>
            </a>
          ))}

          {/* Copy Link Button */}
          <button
            onClick={handleCopyLink}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-white transition-all active:scale-95 ${
              copied ? "bg-primary" : "bg-gray-500 hover:bg-gray-600"
            }`}
            title="Salin Link"
            aria-label="Salin tautan artikel"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
              {copied ? <Check size={10} /> : <Link2 size={10} />}
            </span>
            <span className="hidden sm:inline">
              {copied ? "Tersalin!" : "Salin Link"}
            </span>
          </button>
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
