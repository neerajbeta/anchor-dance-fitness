import type { Config } from "tailwindcss";

const config: Config = {
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
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "Segoe UI", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Poppins", "Inter", "sans-serif"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        card: "0 2px 14px rgba(33,26,22,0.08)",
        pop: "0 18px 50px rgba(33,26,22,0.20)",
        glow: "0 8px 26px rgba(239,91,43,0.30)",
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
