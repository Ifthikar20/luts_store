import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Apple-style light system.
        // `ink` is the near-black primary text/ink color (kept name for compatibility).
        ink: {
          DEFAULT: "#1d1d1f",
          50: "#1d1d1f",
          100: "#1d1d1f",
          200: "#1d1d1f",
        },
        // Neutral surfaces / text scale.
        paper: "#ffffff",
        // Apple gray section band.
        cloud: "#f5f5f7",
        // Faint card surface variant.
        mist: "#fafafa",
        // Hairline border.
        hairline: "#d2d2d7",
        // Text scale — all-black per brand (Instant cinema gradient is the only
        // colored text). graphite = pure black; slate2 = near-black so it still
        // reads as black while keeping input placeholders distinguishable.
        graphite: "#000000",
        slate2: "#1d1d1f",
        // Apple blue accents.
        sky: {
          DEFAULT: "#0071e3",
          hover: "#0077ed",
          link: "#0066cc",
        },
        // Light secondary button fill.
        haze: "#e8e8ed",
        // Retain old accent names so nothing referencing them breaks,
        // but remap to the blue system so any stray usage stays on-brand.
        teal: { grade: "#0071e3" },
        orange: { grade: "#0071e3" },
        violet: { grade: "#0071e3" },
        magenta: { grade: "#0071e3" },
      },
      fontFamily: {
        // Site-wide Apple-style sans: Inter, then the system San Francisco stack
        // (real SF on Apple devices, Segoe UI / Roboto elsewhere). display/sans/
        // serif all resolve to the same family so the whole app is consistent.
        display: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        serif: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.03em",
        tighter2: "-0.022em",
      },
      backgroundImage: {
        // Subtle light pastel wash, used sparingly for faint accents.
        "wash-light":
          "radial-gradient(60% 60% at 30% 30%, rgba(0,113,227,0.06), transparent 70%), radial-gradient(60% 60% at 75% 70%, rgba(88,86,214,0.05), transparent 70%)",
        // Legacy accent-fill names remapped to the Apple blue system so any
        // residual `bg-grade-*` usage (badges, icon chips) stays on-brand and
        // light. These are now flat blue fills, not the old dark gradients.
        "grade-teal-orange": "linear-gradient(135deg, #0071e3, #0077ed)",
        "grade-violet-magenta": "linear-gradient(135deg, #0071e3, #0077ed)",
      },
      boxShadow: {
        soft: "0 8px 30px rgba(0,0,0,0.06)",
        lift: "0 16px 50px rgba(0,0,0,0.10)",
        nav: "0 1px 0 rgba(0,0,0,0.06)",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 30s linear infinite",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
