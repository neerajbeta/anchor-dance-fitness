import type { Config } from "tailwindcss";

/**
 * A CSS-variable colour that still supports Tailwind's opacity modifiers.
 * `bg-accent` → var(--accent); `bg-accent/10` → the same colour at 10%, mixed
 * with transparent (works for both light and dark values of the variable).
 */
function themeVar(name: string): string {
  const color = ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined || opacityValue === "1"
      ? `var(${name})`
      : `color-mix(in srgb, var(${name}) calc(${opacityValue} * 100%), transparent)`;
  // Tailwind accepts colour functions at runtime; its Config type only lists strings.
  return color as unknown as string;
}

const config: Config = {
  // `dark:` styles apply under html.dark — except on and inside the light cards
  // dark mode uses (see "LIGHT CARDS" in globals.css), which keep their
  // light-mode colours so badges and chips stay readable on the cream surface.
  darkMode: [
    "variant",
    "&:is(.dark *):not(:is(.surface-card, .surface-raised, .bg-surface, .bg-surface\\/90), :is(.surface-card, .surface-raised, .bg-surface, .bg-surface\\/90) *)",
  ],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand — derived from the Anchor Fitness logo (orange → red gradient)
        brand: {
          50: "#FEF3EC",
          100: "#FDE2D1",
          200: "#FBC3A3",
          300: "#F89E6E",
          400: "#F5793F",
          500: "#EF5B2B", // primary
          600: "#E0402A",
          700: "#BC3320",
          800: "#96291B",
          900: "#7A241A",
        },
        // Warm ink used for nav, sidebar, headings (replaces the wireframe navy)
        ink: {
          DEFAULT: "#211A16",
          soft: "#2E2620",
          softer: "#3D332B",
        },
        cream: {
          DEFAULT: "#FBF8F4",
          deep: "#F4EEE6",
        },
        line: "#ECE4DA",
        muted: "#93887D",
        slate: "#5C534B",
        // Semantic (warm-tuned)
        ok: "#2E9E6B",
        warn: "#E0972B",
        danger: "#DC4A3D",
        info: "#3B82C4",
        grape: "#8B5CF6",

        // ── Dance & Fitness themed tokens (CSS-variable backed, light + dark) ──
        // Wrapped in themeVar() so opacity modifiers (bg-accent/10, border-hairline/50…)
        // work — a bare "var(--x)" silently generates no CSS for them.
        canvas: themeVar("--canvas"),
        surface: {
          DEFAULT: themeVar("--surface"),
          glass: themeVar("--surface-glass"),
          raised: themeVar("--surface-elevated"),
          muted: themeVar("--surface-muted"),
        },
        hairline: {
          DEFAULT: themeVar("--border"),
          strong: themeVar("--border-strong"),
        },
        copy: {
          DEFAULT: themeVar("--text-primary"),
          dim: themeVar("--text-secondary"),
        },
        chrome: {
          DEFAULT: themeVar("--chrome"),
          deep: themeVar("--chrome-deep"),
        },
        accent: {
          DEFAULT: themeVar("--accent"),
          dark: themeVar("--accent-dark"),
          warm: themeVar("--accent-warm"),
          mid: themeVar("--accent-mid"),
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "Segoe UI", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Poppins", "Inter", "sans-serif"],
        oswald: ["var(--font-oswald)", "Oswald", "Impact", "sans-serif"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        card: "0 2px 14px rgba(33,26,22,0.08)",
        pop: "0 18px 50px rgba(33,26,22,0.20)",
        glow: "0 8px 26px rgba(239,91,43,0.30)",
        "glow-accent": "0 12px 40px rgba(235,57,54,0.28)",
        soft: "var(--shadow-md)",
        "soft-sm": "var(--shadow-sm)",
        "soft-lg": "var(--shadow-lg)",
      },
      backgroundImage: {
        brand: "linear-gradient(135deg, #F7942E 0%, #EF5B2B 52%, #E63E2B 100%)",
        "brand-soft": "linear-gradient(135deg, #FEF3EC 0%, #FDE2D1 100%)",
        ink: "linear-gradient(150deg, #2E2620 0%, #211A16 100%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "scale-in": "scale-in 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
