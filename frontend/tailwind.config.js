/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#102A43',
          navyDark: '#0A1C2E',
          navyLight: '#1B3A5A',
          teal: '#0D9488',
          tealDark: '#0F766E',
          tealLight: '#14B8A6',
          bg: '#F8FAFC',
          text: '#0F172A',
          muted: '#64748B',
          border: '#E2E8F0',
          mask: '#16A34A',
          nomask: '#DC2626',
          uncertain: '#F59E0B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
