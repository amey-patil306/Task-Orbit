import { LOAD_STYLES, loadLevel } from '../lib/constants'

/** Pill showing a load ratio in the shared green/amber/red language. */
export default function LoadBadge({ ratio, showRatio = true, className = '' }) {
  const level = loadLevel(ratio)
  const style = LOAD_STYLES[level]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.badge} ${className}`}>
      {style.label}
      {showRatio && <span className="opacity-75">{ratio == null ? '∞' : `${Math.round(ratio * 100)}%`}</span>}
    </span>
  )
}
