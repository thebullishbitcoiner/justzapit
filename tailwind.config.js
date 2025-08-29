/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        yellow: {
          400: '#fbbf24',
        },
        orange: {
          400: '#fb923c',
        },
        blue: {
          400: '#60a5fa',
        },
        purple: {
          400: '#a78bfa',
        },
        gray: {
          300: '#d1d5db',
          400: '#9ca3af',
        }
      },
      fontSize: {
        '9xl': '8rem',
        '[20rem]': '20rem',
      }
    },
  },
  plugins: [],
}
