import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        foreground: 'var(--foreground)',
        'foreground-muted': 'var(--foreground-muted)',
        bg: { DEFAULT: 'var(--bg)', surface: 'var(--surface)', elevated: 'var(--surface-strong)' },
        papaya: { DEFAULT: '#FF6D3F', coral: '#FF8A65', peach: '#FFAB91' },
        tropical: '#00B894',
        hot: '#E94560',
        muted: '#8A8A9A',
      },
      fontFamily: {
        display: ['DM Sans', 'system-ui', 'Segoe UI', 'sans-serif'],
        body: ['DM Sans', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      transitionTimingFunction: {
        ui: 'cubic-bezier(0.23, 1, 0.32, 1)',
        exit: 'cubic-bezier(0.55, 0, 1, 0.45)',
      },
    },
  },
  plugins: [],
};
export default config;
