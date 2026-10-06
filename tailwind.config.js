/** @type {import('tailwindcss').Config} */
export default {
  // Keep build globs static and brace-free while the upstream braces advisory
  // has no fixed release. Never derive these patterns from user content or env.
  content: ['./index.html', './src/**/*.js', './src/**/*.jsx', './src/**/*.ts', './src/**/*.tsx'],
  theme: {
    extend: {
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
