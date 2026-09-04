/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand, taken from the supplied prototype so the build matches the
        // design that was signed off rather than inventing a second palette.
        ink: { DEFAULT: '#12102b', soft: '#1e1b4b' },
        plum: '#2e1065',
        violet: {
          DEFAULT: '#6d28d9',
          hi: '#7c3aed',
          soft: '#a78bfa',
          // Darkened for accent TEXT on light surfaces: #6d28d9 on white is
          // 6.5:1 and fine, but on the lavender fills it drops below 4.5:1.
          deep: '#5b21b6',
        },
        lav: { DEFAULT: '#ede9fe', soft: '#f5f3ff' },
        canvas: '#f6f5fb',
        body: '#1f2937',
        muted: '#6b7280',
        line: '#e5e7eb',
        // Semantic, kept separate from the brand accent so status never reads
        // as "branded".
        ok: '#059669',
        warn: '#b45309',
        danger: '#dc2626',
        info: '#2563eb',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['clamp(2.25rem, 6vw, 3.5rem)', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(1.75rem, 4vw, 2.25rem)', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
        'display-md': ['clamp(1.35rem, 2.6vw, 1.75rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
      },
      maxWidth: { shell: '1120px', form: '660px', wide: '1060px' },
      borderRadius: { card: '16px', panel: '14px', control: '10px' },
      boxShadow: {
        card: '0 10px 40px -12px rgba(46,16,101,0.18), 0 0 0 1px rgba(46,16,101,0.05)',
        stat: '0 18px 40px -18px rgba(46,16,101,0.35), 0 0 0 1px rgba(46,16,101,0.06)',
        cta: '0 8px 20px -6px rgba(109,40,217,0.55)',
        lift: '0 16px 36px -14px rgba(46,16,101,0.28)',
      },
      backgroundImage: {
        brand: 'linear-gradient(135deg, #1e1b4b 0%, #2e1065 45%, #6d28d9 100%)',
        cta: 'linear-gradient(135deg, #6d28d9, #7c3aed)',
      },
      transitionTimingFunction: { brand: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(109,40,217,0.45)' },
          '100%': { boxShadow: '0 0 0 12px rgba(109,40,217,0)' },
        },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      animation: {
        'pop-in': 'pop-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.25s ease both',
        'slide-in': 'slide-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
