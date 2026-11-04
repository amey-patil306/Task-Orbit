import { useId } from 'react'

/** Task Orbit mark: a planet with a slowly turning orbit ring. */
export function OrbitMark({ className = 'h-8 w-8', tone = 'indigo' }) {
  const colours = tone === 'emerald' ? ['#10b981', '#14b8a6'] : ['#6366f1', '#a855f7']
  // Unique per instance: a duplicate id inside a hidden (display:none) copy would break the gradient.
  const id = `orbit-grad-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colours[0]} />
          <stop offset="1" stopColor={colours[1]} />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="5.5" fill={`url(#${id})`} />
      <g className="animate-orbit" style={{ transformOrigin: '16px 16px', '--orbit-speed': '14s' }}>
        <ellipse cx="16" cy="16" rx="14" ry="6" fill="none" stroke={`url(#${id})`} strokeWidth="2.2" transform="rotate(-30 16 16)" />
        <circle cx="28.1" cy="9" r="1.8" fill={colours[1]} />
      </g>
    </svg>
  )
}

export default function Logo({ tone, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <OrbitMark tone={tone} />
      <span className="text-lg font-extrabold tracking-tight">Task Orbit</span>
    </div>
  )
}
