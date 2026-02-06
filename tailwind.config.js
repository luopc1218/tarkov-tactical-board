/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tact: {
          bg: '#0d1713',
          panel: 'rgba(12, 20, 16, 0.82)',
          line: 'rgba(129, 182, 146, 0.35)',
          text: '#e8efe9',
          muted: 'rgba(225, 238, 229, 0.78)',
          accent: '#9fe2bf',
          accentStrong: '#2f7b56',
        },
      },
      boxShadow: {
        float: '0 18px 48px rgba(0, 0, 0, 0.32)',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Avenir Next', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
