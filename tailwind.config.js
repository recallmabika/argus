/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./backend/app/templates/**/*.html",
    "./backend/app/static/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          900: '#070B14',
          800: '#0D1527',
          700: '#162038',
          600: '#233357',
          accent: '#3B82F6',
          danger: '#EF4444',
          warning: '#F59E0B',
          success: '#10B981',
          card: '#0F1A30'
        }
      }
    },
  },
  plugins: [],
}
