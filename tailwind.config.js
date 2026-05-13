/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg:      '#020409',
          surface: '#080d1a',
          card:    '#0b1220',
          accent:  '#00f5ff',
          green:   '#00ff88',
          purple:  '#7b2fff',
          red:     '#ff2244',
          yellow:  '#ffd60a',
          muted:   '#3a5070',
          text:    '#cce8ff',
        },
      },
      fontFamily: {
        oxanium: ['Oxanium', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
        syne:    ['Syne', 'sans-serif'],
      },
      animation: {
        'matrix':     'matrixFall 20s linear infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slide-up':   'slideUp 0.4s ease forwards',
        'fade-in':    'fadeIn 0.5s ease forwards',
        'spin-slow':  'spin 4s linear infinite',
      },
      keyframes: {
        matrixFall: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 8px rgba(0,245,255,0.3)' },
          '50%':     { boxShadow: '0 0 24px rgba(0,245,255,0.7)' },
        },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
}
