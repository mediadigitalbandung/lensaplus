import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        /* ── The Vibrant Corporate Palette (Lensaplus) ── */
        primary: {
          DEFAULT: "#0F172A", // Deep Slate Navy
          dark: "#020617",
          light: "#F1F5F9",
          container: "#1E293B",
          50: "#F8FAFC", // Clean Light Gray
        },
        secondary: {
          DEFAULT: "#0EA5E9", // Electric Teal
          dark: "#0284C7",
          light: "#E0F2FE", // Soft Teal / Ice Blue
          container: "#0369A1",
        },
        tertiary: {
          DEFAULT: "#F97316", // Energetic Coral / Orange
          light: "#FFEDD5",
        },
        surface: {
          DEFAULT: "#F8FAFC", // Clean Light Gray
          "container-lowest": "#ffffff",
          "container-low": "#F1F5F9",
          container: "#E2E8F0",
          "container-high": "#CBD5E1",
          "container-highest": "#94A3B8",
          secondary: "#F1F5F9",
          tertiary: "#E2E8F0",
          dark: "#0F172A",
        },
        "on-surface": {
          DEFAULT: "#0F172A",
          variant: "#475569",
        },
        "on-primary": "#ffffff",
        outline: {
          DEFAULT: "#64748B",
          variant: "#E2E8F0",
        },
        "inverse-surface": "#1E293B",
        "inverse-on-surface": "#F8FAFC",
        txt: {
          primary: "#0F172A", // Deep Slate Navy text on Light Gray BG
          secondary: "#334155",
          muted: "#475569",
          inverse: "#ffffff",
        },
        border: {
          DEFAULT: "#E2E8F030",
          light: "#E2E8F015",
        },
        /* Legacy aliases mapped to Deep Slate Navy / Electric Teal */
        goto: {
          green: "#0F172A",
          dark: "#020617",
          light: "#F1F5F9",
          50: "#F8FAFC",
        },
      },
      fontFamily: {
        serif: ["var(--font-plus-jakarta-sans)", "system-ui", "sans-serif"], // Map to Plus Jakarta Sans for headings
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],            // Map to Inter for body
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
        DEFAULT: "0.75rem",
        sm: "0.375rem",
        xs: "0.25rem",
        md: "0.375rem",
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
