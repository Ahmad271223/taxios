import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d9dde5",
          300: "#b9c0cd",
          400: "#929cae",
          500: "#717c92",
          600: "#5a6478",
          700: "#4a5161",
          800: "#2c313c",
          900: "#1a1d26",
          950: "#0e1016",
        },
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(14, 16, 22, 0.25)",
        card: "0 1px 2px rgba(14,16,22,.04), 0 8px 24px -12px rgba(14,16,22,.18)",
        glow: "0 0 0 1px rgba(245,158,11,.25), 0 12px 40px -8px rgba(245,158,11,.45)",
        float: "0 24px 60px -20px rgba(14,16,22,.45)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        pulseSoft: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: ".55" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        floaty: "floaty 4s ease-in-out infinite",
        pulseSoft: "pulseSoft 2s ease-in-out infinite",
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(60% 50% at 80% 0%, rgba(245,158,11,.28) 0%, rgba(245,158,11,0) 60%), radial-gradient(50% 50% at 0% 100%, rgba(56,189,248,.12) 0%, rgba(56,189,248,0) 55%)",
      },
    },
  },
  plugins: [],
};

export default config;
