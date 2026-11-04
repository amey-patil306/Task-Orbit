import { useTheme } from '../lib/theme'
import Icon from './Icons'

const OPTIONS = [
  { value: 'light', icon: 'sun', label: 'Light theme' },
  { value: 'dark', icon: 'moon', label: 'Dark theme' },
  { value: 'system', icon: 'monitor', label: 'Use system theme' },
]

/** Three-way switch: light / dark / follow the system. A sliding pill marks the choice. */
export default function ThemeToggle({ className = '' }) {
  const [choice, setChoice] = useTheme()
  const index = OPTIONS.findIndex((o) => o.value === choice)
  return (
    <div role="radiogroup" aria-label="Colour theme"
      className={`relative inline-grid grid-cols-3 rounded-full border border-slate-200 bg-slate-100/80 p-0.5 ${className}`}>
      <span aria-hidden="true" className="absolute inset-y-0.5 left-0.5 w-[calc((100%-4px)/3)] rounded-full bg-surface shadow-sm ring-1 ring-slate-200 transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${index * 100}%)` }} />
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={choice === o.value} aria-label={o.label} title={o.label}
          onClick={() => setChoice(o.value)}
          className={`relative z-10 flex h-7 w-8 items-center justify-center rounded-full transition-colors ${
            choice === o.value ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}>
          <Icon name={o.icon} className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}
