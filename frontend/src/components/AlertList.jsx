import { useMarkAlertRead } from '../hooks/useAlerts'
import { formatDay } from '../lib/dates'
import Icon from './Icons'

const SEVERITY = {
  critical: { bar: 'border-l-red-700', badge: 'bg-red-100 text-red-800', label: 'Critical' },
  warning: { bar: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-800', label: 'Warning' },
  info: { bar: 'border-l-sky-500', badge: 'bg-sky-100 text-sky-800', label: 'Info' },
}

const KIND_LABEL = { overload: 'Overload', collision: 'Deadline clash', deadline: 'Deadline' }

export default function AlertList({ alerts, compact = false }) {
  const markRead = useMarkAlertRead()

  return (
    <ul className="stagger space-y-2">
      {alerts.map((a) => {
        const s = SEVERITY[a.severity]
        return (
          <li key={a.id}
            className={`flex items-start gap-3 rounded-lg border border-l-4 border-slate-200 bg-surface p-3 ${s.bar} ${a.is_read ? 'opacity-60' : ''}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-medium ${s.badge}`}>{s.label}</span>
                <span className="font-medium text-slate-700">{KIND_LABEL[a.kind]}</span>
                <span className="text-slate-400">{formatDay(a.for_date)}</span>
              </div>
              <p className={`mt-1 text-sm text-slate-700 ${compact ? 'line-clamp-2' : ''}`}>{a.message}</p>
            </div>
            {!a.is_read && (
              <button type="button" className="btn-ghost shrink-0 text-xs" disabled={markRead.isPending}
                onClick={() => markRead.mutate(a.id)} aria-label="Mark as read" title="Mark as read">
                <Icon name="check" className="h-4 w-4" />{!compact && 'Mark read'}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
