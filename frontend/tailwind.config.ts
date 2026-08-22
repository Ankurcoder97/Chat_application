import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          50: '#F0F7F4',
          100: '#D9EDE5',
          200: '#B3DBCB',
          300: '#7DC2A8',
          400: '#4A9B6F',
          DEFAULT: '#4A9B6F',
          500: '#357A55',
          600: '#275C3F',
          700: '#1A3E2A',
        },
        surface: {
          base: 'var(--bg-base)',
          muted: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          chat: 'var(--bg-chat)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'bubble-sent': '18px 18px 4px 18px',
        'bubble-recv': '18px 18px 18px 4px',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0,0,0,0.05)',
        elevated: '0 4px 12px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
