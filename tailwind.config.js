
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
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
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "Liberation Mono", "Courier New", 'monospace'],
      }
    },
  },
  plugins: [],
}
