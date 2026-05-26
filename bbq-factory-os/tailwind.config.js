export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'cursive'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
      },
      colors: {
        bg: '#0a0a0a',
        surface: '#141414',
        surface2: '#1c1c1c',
        border: '#2a2a2a',
        orange: { DEFAULT: '#ff5c1a', dim: '#ff5c1a22', mid: '#ff5c1a55' },
        accent: { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' },
      }
    }
  },
  plugins: []
}
