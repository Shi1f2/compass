/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    /* ── Border colour default ─────────────────────────────────────────────── */
    borderColor: ({ theme }) => ({
      ...theme('colors'),
      DEFAULT: 'var(--color-border)',
    }),

    /* ── Corner radius ─────────────────────────────────────────────────────── */
    borderRadius: {
      none: '0',
      sm:   '8px',
      DEFAULT: '12px',
      md:   '14px',
      lg:   '16px',
      xl:   '20px',
      '2xl':'24px',
      '3xl':'28px',
      full: '9999px',
    },

    /* ── Type scale ────────────────────────────────────────────────────────── */
    fontSize: {
      xxs:  ['11px',  { lineHeight: '16px' }],
      xs:   ['12px',  { lineHeight: '18px' }],
      sm:   ['13px',  { lineHeight: '20px' }],
      base: ['14.5px',{ lineHeight: '23px' }],
      lg:   ['16px',  { lineHeight: '25px' }],
    },

    /* ── Shadows ───────────────────────────────────────────────────────────── */
    boxShadow: {
      card:  'var(--shadow-card)',
      lift:  'var(--shadow-lift)',
      float: 'var(--shadow-float)',
      none:  'none',
    },

    extend: {
      /* ── Palette ─────────────────────────────────────────────────────────── */
      colors: {
        page:          'var(--color-page)',
        surface:       'var(--color-surface)',
        sunk:          'var(--color-sunk)',
        ink:           'var(--color-ink)',
        inkMuted:      'var(--color-ink-muted)',
        border:        'var(--color-border)',
        accent:        'var(--color-accent)',
        accentHover:   'var(--color-accent-hover)',
        accentSoft:    'var(--color-accent-soft)',
        violet:        'var(--color-violet)',
        violetSoft:    'var(--color-violet-soft)',
        yellow:        'var(--color-yellow)',
        yellowSoft:    'var(--color-yellow-soft)',
        correct:       'var(--color-correct)',
        correctSoft:   'var(--color-correct-soft)',
        incorrect:     'var(--color-incorrect)',
        incorrectSoft: 'var(--color-incorrect-soft)',
        waiting:       'var(--color-waiting)',
        locked:        'var(--color-locked)',
      },

      /* ── Font family ─────────────────────────────────────────────────────── */
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'ui-rounded',
          'Nunito Sans',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
