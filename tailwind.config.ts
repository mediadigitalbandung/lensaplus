import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        /* ── The Editorial Authority Palette ── */
        primary: {
          DEFAULT: "#002045",
          dark: "#001530",
          light: "#e8edf3",
          container: "#1a3a5c",
          50: "#f0f4f8",
        },
        secondary: {
          DEFAULT: "#b7102a",
          dark: "#8f0c20",
          light: "#fce8eb",
          container: "#d4364d",
        },
        tertiary: {
          DEFAULT: "#371800",
          light: "#f5ede8",
        },
        surface: {
          DEFAULT: "#f8f9fa",
          "container-lowest": "#ffffff",
          "container-low": "#f1f3f4",
          container: "#e8eaeb",
          "container-high": "#dcdfe0",
          "container-highest": "#e1e3e4",
          secondary: "#f1f3f4",
          tertiary: "#e8eaeb",
          dark: "#002045",
        },
        "on-surface": {
          DEFAULT: "#191c1d",
          variant: "#44474e",
        },
        "on-primary": "#ffffff",
        outline: {
          DEFAULT: "#74777f",
          variant: "#c4c6d0",
        },
        "inverse-surface": "#2e3132",
        "inverse-on-surface": "#eff1f1",
        txt: {
          primary: "#191c1d",
          secondary: "#44474e",
          muted: "#5d6066",
          inverse: "#ffffff",
        },
        border: {
          DEFAULT: "#c4c6d020",
          light: "#c4c6d010",
        },
        /* Legacy aliases for gradual migration */
        goto: {
          green: "#002045",
          dark: "#001530",
          light: "#e8edf3",
          50: "#f0f4f8",
        },
      },
      fontFamily: {
        serif: ["var(--font-newsreader)", "Georgia", "Times New Roman", "serif"],
        sans: ["var(--font-work-sans)", "system-ui", "sans-serif"],
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
