
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          // Using CSS variables with fallback to RGB allowing opacity modifiers like bg-brand-dark/50
          dark: 'rgb(var(--color-bg-dark) / <alpha-value>)',
          card: 'rgb(var(--color-bg-card) / <alpha-value>)',
          accent: 'rgb(var(--color-accent) / <alpha-value>)', 
          push: 'rgb(var(--color-push) / <alpha-value>)',
          danger: 'rgb(var(--color-danger) / <alpha-value>)',
          'btn-default': 'rgb(var(--color-btn-default) / <alpha-value>)',
          'btn-shadow': 'rgb(var(--color-btn-shadow) / <alpha-value>)',
          'btn-text': 'rgb(var(--color-btn-text) / <alpha-value>)',
          'display-bg': 'rgb(var(--color-display-bg) / <alpha-value>)',
          'display-text': 'rgb(var(--color-display-text) / <alpha-value>)',
          'text-main': 'rgb(var(--color-text-main) / <alpha-value>)',
          'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "Liberation Mono", "Courier New", 'monospace'],
      }
    },
  },
  plugins: [],
}
