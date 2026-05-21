/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        hazira: {
          red: '#CC1010',
          dark: '#8B0000',
          light: '#FDEAEA',
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
