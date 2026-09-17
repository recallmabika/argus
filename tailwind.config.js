/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./backend/app/templates/**/*.html",
    "./backend/app/static/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      colors: {
        cyber: {
          900: '#000000',
          800: '#09090b',
          700: '#222227',
          600: '#2c2c33',
          accent: '#ffffff',
          danger: '#EF4444',
          warning: '#F59E0B',
          success: '#10B981',
          card: '#121215'
        }
      }
    },
  },
  plugins: [],
}
