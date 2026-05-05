import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        muru: {
          olive: '#5d6b3a',
          ivory: '#f5f0e0',
          text: '#2c2c2c',
          accent: '#d4c4a8',
        },
      },
      fontFamily: {
        montserrat: ['Montserrat', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
