import { useEffect, useState } from 'react'
import useCountUp from '../hooks/useCountUp'
import { loadLevel } from '../lib/constants'

// Same green / amber / red / dark red language as the heatmap, in hex for SVG strokes.
const STROKE = { low: '#4ade80', medium: '#fbbf24', high: '#f87171', critical: '#fca5a5' }

/**
 * Circular gauge for a load ratio (1.0 = all free time used). Fills on mount.
 * Over 100% the ring is full and a second, thinner ring shows the overflow.
 */
export default function LoadRing({ ratio, size = 132 }) {
  const level = loadLevel(ratio)
  const pct = ratio == null ? 200 : Math.round(ratio * 100)
  const shown = useCountUp(Math.min(pct, 999))
  const [drawn, setDrawn] = useState(0)
  useEffect(() => { const id = requestAnimationFrame(() => setDrawn(Math.min(pct, 200))); return () => cancelAnimationFrame(id) }, [pct])

  const r = 44
  const c = 2 * Math.PI * r
  const main = Math.min(drawn, 100) / 100
  const over = Math.max(0, Math.min(drawn - 100, 100)) / 100

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(255 255 255 / .18)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={STROKE[level]} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - main)}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)' }} />
        {over > 0 && (
          <circle cx="50" cy="50" r={r - 9} fill="none" stroke={STROKE[level]} strokeOpacity=".7" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * (r - 9)} strokeDashoffset={2 * Math.PI * (r - 9) * (1 - over)}
            style={{ transition: 'stroke-dashoffset 1.1s .5s cubic-bezier(.2,.7,.2,1)' }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums">{ratio == null ? '∞' : `${shown}%`}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">of free time</span>
      </div>
    </div>
  )
}
