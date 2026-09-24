/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Self-hosted (@fontsource-variable/inter, imported in main.jsx), so the
      // font is served from our own origin: no request to Google Fonts, no new
      // sub-processor, and CSP font-src 'self' already covers it. Before this
      // the site had no font at all and rendered in whatever each visitor's
      // system supplied — Segoe, SF, DejaVu — so it looked different everywhere.
      // slate-500 is the app's secondary-text colour (≈480 uses). Tailwind's
      // #64748b gives 4.24:1 on the slate-950 page, under the 4.5:1 WCAG AA
      // needs for body text. #74839a gives 5.24:1 on slate-950 and 4.64:1 on
      // slate-900 cards, so every existing use passes without touching them.
      // text-slate-600/700 (2.66 and 1.95) were moved to slate-500 for the same
      // reason; design-tokens.test.js keeps them from coming back as text.
      colors: {
        slate: { 500: '#74839a' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', ...defaultTheme.fontFamily.sans],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
