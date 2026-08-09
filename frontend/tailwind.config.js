/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Azul — identidad principal Master Baker (paleta aprobada 2026-08)
        brand: {
          50:  '#E0EAFA',
          100: '#F3E4C4',
          200: '#E5CB94',
          400: '#0474C4',
          600: '#06457F',
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
          950: '#0A1017',
        },
        success: { light: '#EAF3DE', DEFAULT: '#3B6D11', dark: '#27500A' },
        danger:  { light: '#FCEBEB', DEFAULT: '#A32D2D', dark: '#791F1F' },
        warn:    { light: '#FBF6EC', DEFAULT: '#A8813E', dark: '#7A5E2C' },
        info:    { light: '#E6F1FB', DEFAULT: '#185FA5', dark: '#0C447C' },

        // ── Tokens semanticos — usar estos en componentes, no la paleta cruda ──
        // Definidos como CSS custom properties en index.css (:root / .dark)
        // para que cambien de valor automaticamente segun el tema.
        'brand-primary':       'var(--color-brand-primary)',
        'brand-primary-hover': 'var(--color-brand-primary-hover)',
        'brand-secondary':     'var(--color-brand-secondary)',
        'brand-ink':           'var(--color-brand-ink)',
        'brand-accent':        'var(--color-brand-accent)', // acento puro — logo, KPI destacado

        'text-default': 'var(--color-text-default)',
        'text-subtle':  'var(--color-text-subtle)',
        'text-muted':   'var(--color-text-muted)',

        surface:       'var(--color-surface)',
        'surface-muted': 'var(--color-surface-muted)',
        'border-default': 'var(--color-border-default)',

        status: {
          success: { DEFAULT: 'var(--color-status-success)', fg: 'var(--color-status-success-fg)' },
          warning: { DEFAULT: 'var(--color-status-warning)', fg: 'var(--color-status-warning-fg)' },
          danger:  { DEFAULT: 'var(--color-status-danger)',  fg: 'var(--color-status-danger-fg)' },
          info:    { DEFAULT: 'var(--color-status-info)',    fg: 'var(--color-status-info-fg)' },
        },
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
