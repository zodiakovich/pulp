import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#09090B', surface: '#111118', elevated: '#1A1A2E' },
        papaya: { DEFAULT: '#FF6D3F', coral: '#FF8A65', peach: '#FFAB91' },
        tropical: '#00B894',
        hot: '#E94560',
        muted: '#8A8A9A',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
