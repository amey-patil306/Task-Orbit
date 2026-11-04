import { useId } from 'react'
import { errorMessage } from '../api/client'
import Icon from './Icons'

/** Two dots circling a planet: the app's loading indicator. */
export function OrbitLoader({ className = 'h-8 w-8' }) {
  return (
    <span className={`relative inline-block ${className}`} aria-hidden="true">
      <span className="absolute inset-[30%] rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500" />
      <span className="absolute inset-0 animate-orbit rounded-full border border-dashed border-indigo-200 [--orbit-speed:1.4s]">
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-indigo-500 shadow-[0_0_8px] shadow-indigo-400" />
        <span className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-fuchsia-400" />
      </span>
    </span>
  )
}

export function Spinner({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex animate-fade-in flex-col items-center justify-center gap-3 py-10 text-sm text-slate-500 ${className}`} role="status">
      <OrbitLoader />
      {label}
    </div>
  )
}

/** Grey placeholder blocks shaped like a list of cards, shown while a page's data loads. */
export function SkeletonList({ rows = 4, label = 'Loading…' }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card flex items-center gap-4" style={{ opacity: 1 - i * 0.15 }}>
          <span className="skeleton h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <span className="skeleton block h-3.5 w-2/5" />
            <span className="skeleton block h-3 w-3/5" />
          </div>
          <span className="skeleton hidden h-7 w-20 rounded-full sm:block" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'Could not load this' }) {
  return (
    <div className="animate-scale-in rounded-2xl border border-red-200 bg-gradient-to-b from-red-50 to-white p-6 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
        <Icon name="warning" className="h-5 w-5" />
      </span>
      <p className="mt-3 font-semibold text-red-800">{title}</p>
      <p className="mt-1 text-sm text-red-700">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="btn-secondary mt-4" onClick={onRetry}>
          <Icon name="refresh" className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  )
}

/** A small empty orbit: nothing circling yet. */
function EmptyOrbit() {
  const id = `empty-sun-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 120 80" className="mx-auto h-20 w-32" aria-hidden="true">
      <ellipse cx="60" cy="40" rx="52" ry="18" fill="none" stroke="#c7d2fe" strokeDasharray="4 5" />
      <ellipse cx="60" cy="40" rx="32" ry="11" fill="none" stroke="#e0e7ff" strokeDasharray="3 4" />
      <circle cx="60" cy="40" r="11" fill={`url(#${id})`} />
      <circle cx="110" cy="35" r="3" fill="#a5b4fc" className="animate-twinkle" />
      <circle cx="18" cy="48" r="2" fill="#f0abfc" className="animate-twinkle" style={{ animationDelay: '-1.5s' }} />
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#818cf8" /><stop offset="1" stopColor="#e879f9" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="animate-scale-in rounded-2xl border border-dashed border-slate-300 bg-surface/70 px-6 py-10 text-center">
      <div className="animate-float"><EmptyOrbit /></div>
      <p className="mt-3 font-semibold text-slate-800">{title}</p>
      {message && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/**
 * Renders the three states every page needs (loading, error + retry, empty + CTA),
 * then calls children(data) when there is data.
 */
export function QueryState({ query, isEmpty = (d) => Array.isArray(d) && d.length === 0, empty, loadingLabel, skeleton = true, children }) {
  if (query.isPending) return skeleton ? <SkeletonList label={loadingLabel} rows={3} /> : <Spinner label={loadingLabel} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (empty && isEmpty(query.data)) return empty
  return children(query.data)
}
