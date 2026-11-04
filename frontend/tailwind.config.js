import defaultColors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'

/*
 * Themeable palette (dark mode without touching every component):
 * each shade of the colours we use is a CSS variable. Light mode uses Tailwind's normal values;
 * `.dark` swaps them: neutrals flip (light backgrounds become dark, dark text becomes light),
 * pale tints become deep tints, mid shades (400-600, used for buttons and dots) stay the same.
 * `white` stays real white (text on buttons); card backgrounds use the `surface` colour instead.
 */
const FAMILIES = ['slate', 'indigo', 'violet', 'fuchsia', 'emerald', 'teal', 'cyan', 'red', 'amber', 'green', 'sky', 'rose', 'lime', 'orange']
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const mix = (a, b, t) => rgb(a).map((v, i) => Math.round(v * t + rgb(b)[i] * (1 - t)))
const triple = (arr) => arr.join(' ')

const SURFACE_DARK = '#0e1524'
const DARK_SLATE = {
  50: '#070b14', 100: '#141c2c', 200: '#1f2a3d', 300: '#334155', 400: '#64748b', 500: '#94a3b8',
  600: '#cbd5e1', 700: '#e2e8f0', 800: '#f1f5f9', 900: '#f8fafc', 950: '#ffffff',
}

function darkShade(family, shade) {
  const c = defaultColors[family]
  if (family === 'slate') return triple(rgb(DARK_SLATE[shade]))
  switch (shade) {
    case '50': return triple(mix(c['900'], SURFACE_DARK, 0.28))
    case '100': return triple(mix(c['900'], SURFACE_DARK, 0.5))
    case '200': return triple(mix(c['800'], SURFACE_DARK, 0.7))
    case '300': return triple(rgb(c['700']))
    case '700': return triple(rgb(c['300']))
    case '800': return triple(rgb(c['200']))
    case '900': return triple(rgb(c['100']))
    case '950': return triple(rgb(c['50']))
    default: return triple(rgb(c[shade]))
  }
}

const themedColors = Object.fromEntries(FAMILIES.map((f) => [
  f, Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--c-${f}-${s}) / <alpha-value>)`])),
]))

const themeVars = plugin(({ addBase }) => {
  const light = { '--c-surface': '255 255 255' }
  const dark = { '--c-surface': triple(rgb(SURFACE_DARK)), colorScheme: 'dark' }
  for (const f of FAMILIES) {
    for (const s of SHADES) {
      light[`--c-${f}-${s}`] = triple(rgb(defaultColors[f][s]))
      dark[`--c-${f}-${s}`] = darkShade(f, s)
    }
  }
  addBase({ ':root': light, '.dark': dark })
})

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ...themedColors,
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        ink: '#0f172a', // always dark (tooltips, toasts), in both themes
        // One colour language for load everywhere (section 11).
        load: {
          low: '#16a34a',
          medium: '#f59e0b',
          high: '#dc2626',
          critical: '#7f1d1d',
        },
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.96) translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        pop: { '0%': { opacity: '0', transform: 'scale(.6)' }, '70%': { transform: 'scale(1.06)' }, '100%': { opacity: '1', transform: 'none' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        orbit: { to: { transform: 'rotate(360deg)' } },
        'orbit-rev': { to: { transform: 'rotate(-360deg)' } },
        shake: { '10%, 90%': { transform: 'translateX(-1px)' }, '20%, 80%': { transform: 'translateX(3px)' },
          '30%, 50%, 70%': { transform: 'translateX(-6px)' }, '40%, 60%': { transform: 'translateX(6px)' } },
        twinkle: { '0%, 100%': { opacity: '.25' }, '50%': { opacity: '1' } },
        glow: { '0%, 100%': { opacity: '.55', transform: 'scale(1)' }, '50%': { opacity: '.9', transform: 'scale(1.08)' } },
        'gradient-x': { '0%, 100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.2,.7,.2,1) backwards',
        'fade-in': 'fade-in .3s ease-out backwards',
        'scale-in': 'scale-in .25s cubic-bezier(.2,.7,.2,1) backwards',
        'slide-up': 'slide-up .3s cubic-bezier(.2,.7,.2,1) backwards',
        pop: 'pop .4s cubic-bezier(.2,.7,.2,1) backwards',
        shimmer: 'shimmer 1.6s linear infinite',
        float: 'float 5s ease-in-out infinite',
        orbit: 'orbit var(--orbit-speed, 30s) linear infinite',
        'orbit-rev': 'orbit-rev var(--orbit-speed, 30s) linear infinite',
        shake: 'shake .5s cubic-bezier(.36,.07,.19,.97) both',
        twinkle: 'twinkle var(--twinkle, 3s) ease-in-out infinite',
        glow: 'glow 4s ease-in-out infinite',
        'gradient-x': 'gradient-x 8s ease infinite',
      },
    },
  },
  plugins: [themeVars],
}
