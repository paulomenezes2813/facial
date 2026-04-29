import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tons retirados das telas de referência (azul/verde do credenciamento)
        brand: {
          50: '#eef4ff',
          100: '#dde9ff',
          500: '#5878ff',
          600: '#4760e6',
          700: '#3548b8',
        },
        success: {
          500: '#22c55e',
          600: '#16a34a',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
