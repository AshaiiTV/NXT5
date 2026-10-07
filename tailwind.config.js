/** @type {import('tailwindcss').Config} */
export default {
  // Keep build globs static and brace-free while the upstream braces advisory
  // has no fixed release. Never derive these patterns from user content or env.
  content: ['./index.html', './src/**/*.js', './src/**/*.jsx', './src/**/*.ts', './src/**/*.tsx'],
  theme: {
    extend: {
      // Shared reading scale, including responsive variants of these utilities.
      fontSize: {
        xs: ['var(--nxt5-font-small)', { lineHeight: '1.5' }],
        sm: ['var(--nxt5-font-body)', { lineHeight: '1.65' }],
      },
      spacing: {
        76: '19rem',
      },
      colors: {
        slate: {
          350: '#c0cada',
          650: '#566276',
        },
      },
    },
  },
  plugins: [],
};
