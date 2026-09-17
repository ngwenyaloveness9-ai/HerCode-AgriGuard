/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: '#123524',
        agri: '#2E7D32',
        leaf: '#4CAF50',
        fresh: '#66BB6A',
        earth: '#795548',
        soil: '#A1887F',
        water: '#0288D1',
        sky: '#4FC3F7',
        solar: '#FBC02D',
        warn: '#F57C00',
        critical: '#D32F2F',
        canvas: '#F5F8F3',
        card: '#FFFFFF',
        ink: '#17231B',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Sora"', '"Inter Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display-xl': ['clamp(2.75rem, 6vw, 4.5rem)', { lineHeight: '1.04', letterSpacing: '-0.03em' }],
        'display-lg': ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['clamp(1.5rem, 2.4vw, 2rem)', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
      },
      borderRadius: { card: '1rem', pill: '999px' },
      boxShadow: {
        card: '0 1px 2px rgba(18,53,36,0.04), 0 8px 24px -12px rgba(18,53,36,0.18)',
        lifted: '0 2px 4px rgba(18,53,36,0.06), 0 20px 40px -20px rgba(18,53,36,0.28)',
      },
      backgroundImage: {
        'canopy': 'linear-gradient(135deg, #123524 0%, #2E7D32 100%)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.9)', opacity: '0' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.2s cubic-bezier(0.4,0,0.6,1) infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
