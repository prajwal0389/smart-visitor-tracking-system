/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#6366f1', dark: '#4f46e5' },
        success: '#22c55e',
        danger: '#ef4444',
        warning: '#f59e0b',
      }
    }
  },
  plugins: []
};
