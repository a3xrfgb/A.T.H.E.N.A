import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        /** Linear sweep — still used by settings toggles (dark mode track). */
        "settings-selection-gradient": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        /** First-launch modal — one-shot entrance. */
        "first-launch-overlay": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "first-launch-panel": {
          "0%": { opacity: "0", transform: "translate(-50%, -48%) scale(0.97)" },
          "100%": { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "first-launch-shimmer": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        "first-launch-glow": {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.08)" },
        },
        /** Onboarding step cross-fade */
        "onboarding-step": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        /** Splash: logo + text stagger */
        "onboarding-splash-logo": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "onboarding-splash-fade": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        /** Create project modal — glass panel (parent handles centering) */
        "create-project-glass": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "settings-selection-gradient":
          "settings-selection-gradient 9s ease-in-out infinite",
        "first-launch-overlay": "first-launch-overlay 0.45s ease-out forwards",
        "first-launch-panel":
          "first-launch-panel 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.08s both",
        "first-launch-shimmer": "first-launch-shimmer 2.8s ease-in-out infinite",
        "first-launch-glow": "first-launch-glow 4s ease-in-out infinite",
        "onboarding-step": "onboarding-step 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "onboarding-splash-logo":
          "onboarding-splash-logo 0.85s cubic-bezier(0.22, 1, 0.36, 1) both",
        "onboarding-splash-title":
          "onboarding-splash-fade 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both",
        "onboarding-splash-subtitle":
          "onboarding-splash-fade 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.95s both",
        "onboarding-splash-cta":
          "onboarding-splash-fade 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "create-project-glass":
          "create-project-glass 0.28s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
      colors: {
        background: "#0d0d0f",
        sidebar: "#111114",
        surface: "#18181c",
        accent: "#7c6af7",
        muted: "#6b6b80",
      },
      borderRadius: {
        DEFAULT: "8px",
        card: "12px",
      },
      fontFamily: {
        /** `--font-ui-primary` set in JS when language is English (see `applyAppFontStyle`). */
        sans: [
          "var(--font-ui-primary, Inter)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        /** About credit & fixed UI spots; loaded in index.html */
        roboto: ["Roboto", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
