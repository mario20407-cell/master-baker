/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Dorado — identidad principal Master Baker (del logo: trigo + nodo)
        brand: {
          50:  '#FBF6EC',
          100: '#F3E4C4',
          200: '#E5CB94',
          400: '#C29C53',
          600: '#A8813E',
          800: '#7A5E2C',
          900: '#4F3C1C',
        },
        // Azul marino — texto "MASTER BAKER" y acentos secundarios
        navy: {
          50:  '#EEF1F3',
          100: '#D4DBE1',
          200: '#A9B8C4',
          400: '#3E5A70',
          600: '#263D4F',
          800: '#1B2C39',
          900: '#101A22',
        },
        success: { light: '#EAF3DE', DEFAULT: '#3B6D11', dark: '#27500A' },
        danger:  { light: '#FCEBEB', DEFAULT: '#A32D2D', dark: '#791F1F' },
        warn:    { light: '#FBF6EC', DEFAULT: '#A8813E', dark: '#7A5E2C' },
        info:    { light: '#E6F1FB', DEFAULT: '#185FA5', dark: '#0C447C' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: { card: '12px' },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
}
