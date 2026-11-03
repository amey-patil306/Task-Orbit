import { errorMessage } from '../api/client'
import Icon from './Icons'

export function Spinner({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 py-10 text-sm text-slate-500 ${className}`} role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'Could not load this' }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="font-medium text-red-800">{title}</p>
      <p className="mt-1 text-sm text-red-700">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="btn-secondary mt-4" onClick={onRetry}>
          <Icon name="refresh" className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {message && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/**
 * Renders the three states every page needs (loading, error + retry, empty + CTA),
 * then calls children(data) when there is data.
 */
export function QueryState({ query, isEmpty = (d) => Array.isArray(d) && d.length === 0, empty, loadingLabel, children }) {
  if (query.isPending) return <Spinner label={loadingLabel} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (empty && isEmpty(query.data)) return empty
  return children(query.data)
}
