/**
 * Tailwind configuration for Toddler Puzzles.
 *
 * Design tokens here are the SAME palette used in the Phaser scenes (see
 * `src/game/scenes/MainMenu.js` GAMES array, `Paywall.js`, etc.). Reusing
 * the names means a future UI component built in Vue + Tailwind reads the
 * same colour as the matching Phaser scene without converting hex values.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Background / surface
        cream: '#fff8e7',
        peach: {
          50: '#fff5e8',
          100: '#ffe8d4',
          200: '#ffe0c4',
          300: '#ffd5c8'
        },
        // Brand text
        royal: '#4a2c8a', // deep purple — headlines, primary
        warm: '#7a4400', // warm brown — body text, secondary
        warmInk: '#5a3a1a', // darker warm — when body text needs more weight
        // Accent / CTA
        sunshine: '#ffd23f',
        sunshineDark: '#c99e00',
        coral: '#ff7f50',
        coralDark: '#c94a2d',
        // Pack colours — same hex as MainMenu.GAMES so a Vue component
        // dressed as a "Toys" card reads identical to the Phaser one.
        pack: {
          toys: '#ff9f1c',
          toysDark: '#d97e00',
          heroes: '#9b5de5',
          heroesDark: '#7838c8',
          faces: '#ff5da2',
          facesDark: '#db3f82',
          fruits: '#5fc34a',
          fruitsDark: '#3d8c2f',
          numbers: '#3ba4ff',
          numbersDark: '#1769b8',
          letters: '#ffd23f',
          lettersDark: '#c99e00'
        }
      },
      fontFamily: {
        // Inherits from the <link> in index.html — Fredoka loaded from Google Fonts.
        fredoka: [
          'Fredoka',
          '"Arial Rounded MT Bold"',
          '"Helvetica Rounded"',
          'sans-serif'
        ]
      },
      boxShadow: {
        // "3-D lip" preset matching the chunky button/card style used across
        // every Phaser scene — soft drop shadow + subtle inset highlight.
        chunky: '0 6px 0 0 rgba(0,0,0,0.15), 0 12px 24px rgba(0,0,0,0.18)',
        chunkySm: '0 4px 0 0 rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.15)'
      },
      animation: {
        'pop-in': 'pop-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        shake: 'shake 0.4s ease-in-out',
        // Sun mascot + twinkling stars for decorative chrome (Paywall, etc.)
        twinkle: 'twinkle 2.4s ease-in-out infinite',
        'spin-slow': 'spin-slow 40s linear infinite',
        'drift-y': 'drift-y 5s ease-in-out infinite'
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-8px)' },
          '40%, 80%': { transform: 'translateX(8px)' }
        },
        // Sparkle pulse for decorative stars.
        twinkle: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.7)' },
          '50%': { opacity: '0.95', transform: 'scale(1.05)' }
        },
        // Slow rotation for sun rays.
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' }
        },
        // Gentle vertical bob for clouds/sun (small range, slow).
        'drift-y': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' }
        }
      }
    }
  },
  plugins: []
}
