/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agency: {
          blue: '#1E3A8A',
          lightBlue: '#3B82F6',
          grey: '#F3F4F6',
          darkGrey: '#4B5563',
          white: '#FFFFFF'
        }
      }
    },
  },
  plugins: [],
}
