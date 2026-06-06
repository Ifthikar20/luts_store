import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Near-black cinematic base
        ink: {
          DEFAULT: "#0a0a0b",
          50: "#16161a",
          100: "#121216",
          200: "#0f0f12",
        },
        teal: {
          grade: "#16d8c6",
        },
        orange: {
          grade: "#ff8a3d",
        },
        violet: {
          grade: "#8b5cf6",
        },
        magenta: {
          grade: "#ec4899",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grade-teal-orange":
          "linear-gradient(120deg, #16d8c6 0%, #2dd4bf 30%, #ff8a3d 100%)",
        "grade-violet-magenta":
          "linear-gradient(120deg, #8b5cf6 0%, #d946ef 50%, #ec4899 100%)",
        "noise":
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        blob: {
          "0%,100%": { transform: "translate(0px,0px) scale(1)" },
          "33%": { transform: "translate(30px,-40px) scale(1.1)" },
          "66%": { transform: "translate(-20px,20px) scale(0.95)" },
        },
        "gradient-pan": {
          "0%,100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        marquee: "marquee 30s linear infinite",
        blob: "blob 18s ease-in-out infinite",
        "gradient-pan": "gradient-pan 8s ease infinite",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
