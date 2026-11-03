/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // One colour language for load everywhere (section 11).
        load: {
          low: '#16a34a',
          medium: '#f59e0b',
          high: '#dc2626',
          critical: '#7f1d1d',
        },
      },
    },
  },
  plugins: [],
}
