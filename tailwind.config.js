/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
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
