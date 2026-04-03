import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "rgb(var(--bg-primary) / <alpha-value>)",
          secondary: "rgb(var(--bg-secondary) / <alpha-value>)",
          card: "rgb(var(--bg-card) / <alpha-value>)",
        },
        accent: {
          gold: "#C9A84C",
        },
        text: {
          primary: "rgb(var(--text-primary) / <alpha-value>)",
          secondary: "rgb(var(--text-secondary) / <alpha-value>)",
        },
        state: {
          success: "#2ECC8A",
          error: "#E05555",
          warning: "#E0A030",
        },
        border: {
          DEFAULT: "rgb(var(--border-default) / 0.14)",
          hover: "rgb(var(--border-hover) / 0.24)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out both",
        "fade-in-1": "fade-in-up 0.5s 0.1s ease-out both",
        "fade-in-2": "fade-in-up 0.5s 0.2s ease-out both",
        "fade-in-3": "fade-in-up 0.5s 0.35s ease-out both",
        "fade-in-4": "fade-in-up 0.5s 0.5s ease-out both",
        "fade-in-5": "fade-in-up 0.5s 0.65s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
