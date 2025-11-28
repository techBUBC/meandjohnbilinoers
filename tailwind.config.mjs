/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0ebff",
          200: "#c7d7ff",
          300: "#a7bfff",
          400: "#7f9bff",
          500: "#5675ff",
          600: "#3d57e6",
          700: "#3044b4",
          800: "#26358a",
          900: "#1f2a6c"
        }
      }
    }
  },
  plugins: [],
};
