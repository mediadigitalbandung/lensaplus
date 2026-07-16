import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        /* ── The Vibrant & Premium Amethyst Palette (Lensaplus Redesign) ── */
        primary: {
          DEFAULT: "#2E1065", // Midnight Amethyst
          dark: "#1E0A45",
          light: "#F5F3FF", // Soft Lavender
          container: "#4C1D95",
          50: "#FAF5FF",
        },
        secondary: {
          DEFAULT: "#10B981", // Vibrant Emerald
          dark: "#059669",
          light: "#E6F4EA", // Soft Mint
          container: "#065F46",
        },
        tertiary: {
          DEFAULT: "#F43F5E", // Coral Rose
          light: "#FFE4E6",
        },
        surface: {
          DEFAULT: "#FAF9F6", // Warm Alabaster / Soft Ivory
          "container-lowest": "#ffffff",
          "container-low": "#F5F4F0",
          container: "#EAE8E2",
          "container-high": "#DCDAD4",
          "container-highest": "#A8A6A0",
          secondary: "#F5F4F0",
          tertiary: "#EAE8E2",
          dark: "#1C1917", // Deep Stone
        },
        "on-surface": {
          DEFAULT: "#1C1917",
          variant: "#57534E",
        },
        "on-primary": "#ffffff",
        outline: {
          DEFAULT: "#78716C",
          variant: "#EAE8E2",
        },
        "inverse-surface": "#292524",
        "inverse-on-surface": "#FAF9F6",
        txt: {
          primary: "#1C1917", // Warm Slate / Stone text on Alabaster BG
          secondary: "#44403C",
          muted: "#78716C",
          inverse: "#ffffff",
        },
        border: {
          DEFAULT: "#EAE8E260",
          light: "#EAE8E230",
        },
        /* Legacy aliases mapped to Midnight Amethyst */
        goto: {
          green: "#2E1065",
          dark: "#1E0A45",
          light: "#F5F3FF",
          50: "#FAF5FF",
        },
      },
      fontFamily: {
        serif: ["var(--font-plus-jakarta-sans)", "system-ui", "sans-serif"], // Geometric headings
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],            // Clean body
      },
      fontSize: {
        "display-lg": ["3.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "800" }],
        "display-md": ["2.75rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "800" }],
        "display-sm": ["2.25rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-lg": ["2rem", { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-md": ["1.75rem", { lineHeight: "1.3", letterSpacing: "-0.005em", fontWeight: "700" }],
        "headline-sm": ["1.5rem", { lineHeight: "1.35", fontWeight: "600" }],
        "title-lg": ["1.375rem", { lineHeight: "1.4", fontWeight: "600" }],
        "title-md": ["1.125rem", { lineHeight: "1.5", fontWeight: "600" }],
        "title-sm": ["0.875rem", { lineHeight: "1.5", fontWeight: "600" }],
        "body-lg": ["1.0625rem", { lineHeight: "1.75", fontWeight: "400" }],
        "body-md": ["0.9375rem", { lineHeight: "1.7", fontWeight: "400" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.6", fontWeight: "400" }],
        "label-lg": ["0.875rem", { lineHeight: "1.5", fontWeight: "500", letterSpacing: "0.01em" }],
        "label-md": ["0.75rem", { lineHeight: "1.5", fontWeight: "500", letterSpacing: "0.05em" }],
        "label-sm": ["0.6875rem", { lineHeight: "1.5", fontWeight: "500", letterSpacing: "0.05em" }],
      },
      borderRadius: {
        DEFAULT: "1rem",
        sm: "0.5rem",
        xs: "0.25rem",
        md: "0.75rem",
        lg: "1.25rem",
        xl: "1.5rem",
        "2xl": "2rem",
        full: "9999px",
      },
      boxShadow: {
        ambient: "0 4px 40px rgba(25, 28, 29, 0.06)",
        "ambient-lg": "0 8px 60px rgba(25, 28, 29, 0.08)",
        nav: "0 1px 20px rgba(25, 28, 29, 0.04)",
        card: "0 1px 3px rgba(25, 28, 29, 0.04)",
        "card-hover": "0 4px 20px rgba(25, 28, 29, 0.06)",
        ghost: "inset 0 0 0 1px rgba(196, 198, 208, 0.2)",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "fade-up": "fadeUp 0.5s ease-out",
        "scroll-x": "scrollX 35s linear infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scrollX: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(-100%)" },
        },
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #002045, #1a3a5c)",
        "gradient-hero": "linear-gradient(135deg, #002045 0%, #1a3a5c 50%, #002045 100%)",
      },
      backdropBlur: {
        glass: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
