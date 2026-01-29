/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
      },
      screens: {
        "2xl": "1400px",
      },
    },
    screens: {
      'xs': '480px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        // Surface tokens
        "surface-canvas": "hsl(var(--surface-canvas))",
        "surface-card": "hsl(var(--surface-card))",
        "surface-subtle": "hsl(var(--surface-subtle))",
        // Ink tokens
        "ink-primary": "hsl(var(--ink-primary))",
        "ink-secondary": "hsl(var(--ink-secondary))",
        "ink-tertiary": "hsl(var(--ink-tertiary))",
        "ink-on-accent": "hsl(var(--ink-on-accent))",
        // Accent tokens
        "accent-main": "hsl(var(--color-accent-main))",
        "accent-hover": "hsl(var(--color-accent-hover))",
        "accent-subtle": "hsl(var(--color-accent-subtle))",
        // Signal tokens
        "signal-error": "hsl(var(--signal-error))",
        "signal-warning": "hsl(var(--signal-warning))",
        "signal-success": "hsl(var(--signal-success))",
        // Border tokens
        "border-grid": "hsl(var(--border-grid))",
        "border-element": "hsl(var(--border-element))",
        "border-accent": "hsl(var(--border-accent))",
        // shadcn compatibility
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        // Sharp containers per design system
        lg: "0px",
        md: "0px",
        sm: "0px",
        // Organic controls
        pill: "999px",
      },
      fontSize: {
        "display-xl": ["48px", { lineHeight: "1.0", letterSpacing: "-0.025em", fontWeight: "300" }],
        "h1": ["24px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "400" }],
        "h2": ["16px", { lineHeight: "1.4", letterSpacing: "-0.005em", fontWeight: "400" }],
        "body": ["14px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
        "label": ["11px", { lineHeight: "1.0", letterSpacing: "0.06em", fontWeight: "500" }],
        "data": ["13px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "400" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.5 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
