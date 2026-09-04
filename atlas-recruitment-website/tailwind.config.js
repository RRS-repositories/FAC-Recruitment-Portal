/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // Matches the breakpoints the original design actually switches at.
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0c1a3a',
          mid: '#122349',
          deep: '#08132b',
        },
        slate: {
          brand: '#1c2f58',
        },
        gold: {
          // Brand gold. Reads well on navy (7.8:1) but only 2.0:1 on cream, so
          // it is used for text on dark surfaces and for borders/fills only.
          DEFAULT: '#d4a84b',
          light: '#e8c97a',
          // Same hue, darkened for accent *text* on cream/white (4.7:1 / 5.1:1).
          deep: '#8a6a12',
          muted: '#8a7a55',
        },
        cream: '#f7f5f1',
        ink: '#26303f',
        muted: '#66707f',
        hairline: 'rgba(12,26,58,0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      fontSize: {
        'display-xl': ['clamp(2.4rem, 5vw, 3.8rem)', { lineHeight: '1.1', letterSpacing: '-0.015em' }],
        'display-lg': ['clamp(2.1rem, 4vw, 3.2rem)', { lineHeight: '1.12', letterSpacing: '-0.015em' }],
        'display-md': ['clamp(1.8rem, 3.2vw, 2.5rem)', { lineHeight: '1.18', letterSpacing: '-0.015em' }],
      },
      maxWidth: {
        wrap: '1160px',
        prose: '760px',
        measure: '600px',
      },
      borderRadius: {
        brand: '8px',
        card: '14px',
      },
      boxShadow: {
        card: '0 24px 50px rgba(12,26,58,0.18)',
        hero: '0 30px 60px rgba(0,0,0,0.35)',
        lift: '0 16px 36px rgba(12,26,58,0.12)',
        tag: '0 8px 24px rgba(0,0,0,0.15)',
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'fade-in-down': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        marquee: 'marquee 42s linear infinite',
        'fade-in-down': 'fade-in-down 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.3s ease both',
      },
    },
  },
  plugins: [],
};
