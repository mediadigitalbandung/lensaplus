"use client";

import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  textClassName?: string;
  className?: string;
  href?: string;
  variant?: "light" | "dark";
}

export default function Logo({
  size = "md",
  showText = true,
  textClassName = "",
  className = "",
  href = "/",
  variant = "light",
}: LogoProps) {
  // Size mapping for the black circle icon
  const iconSizeMap = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-11 h-11",
    xl: "w-14 h-14",
  };

  // Text size mapping
  const textSizeMap = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl sm:text-4xl",
    xl: "text-4xl sm:text-5xl",
  };

  // SVG emblem sizes
  const svgSizeMap = {
    sm: 18,
    md: 22,
    lg: 26,
    xl: 34,
  };

  const currentIconSize = iconSizeMap[size] || iconSizeMap.md;
  const currentTextSize = textSizeMap[size] || textSizeMap.md;
  const svgSize = svgSizeMap[size] || 22;

  const content = (
    <div className={`inline-flex items-center gap-3 select-none group ${className}`}>
      {/* Black Circle Icon Mark */}
      <div
        className={`${currentIconSize} rounded-full bg-black shadow-md flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg shrink-0 border border-stone-800/40`}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform duration-300 group-hover:rotate-45"
        >
          {/* Outer camera lens ring */}
          <circle cx="16" cy="16" r="12" stroke="white" strokeWidth="2.2" strokeOpacity="0.9" />
          {/* Inner lens aperture element */}
          <circle cx="16" cy="16" r="6" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.8" />
          {/* Center Plus/Lensa Core */}
          <path
            d="M16 11V21M11 16H21"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Brand Text */}
      {showText && (
        <span
          className={`font-serif font-extrabold tracking-tight transition-colors ${currentTextSize} ${
            variant === "dark"
              ? "text-white group-hover:text-stone-200"
              : "text-stone-900 group-hover:text-black"
          } ${textClassName}`}
        >
          Lensaplus
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block focus:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}
