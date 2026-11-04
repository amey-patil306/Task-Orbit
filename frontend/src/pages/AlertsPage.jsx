import { useState } from 'react'
import AlertList from '../components/AlertList'
import PageHeader from '../components/PageHeader'
import { EmptyState, QueryState } from '../components/States'
import { useAlerts } from '../hooks/useAlerts'

export default function AlertsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const alerts = useAlerts(unreadOnly)

  return (
    <>
      <PageHeader title="Alerts" subtitle="Overloaded days, deadline clashes and upcoming deadlines" />
      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-surface p-1 text-sm">
        {[[false, 'All'], [true, 'Unread']].map(([value, label]) => (
          <button key={label} type="button" onClick={() => setUnreadOnly(value)}
            className={`rounded-md px-3 py-1.5 font-medium ${unreadOnly === value ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {label}
          </button>
        ))}
      </div>
      <QueryState query={alerts} loadingLabel="Checking for alerts…"
        empty={<EmptyState title={unreadOnly ? 'No unread alerts' : 'No alerts'}
          message="You'll see warnings here when a day is overloaded or deadlines clash." />}>
        {(list) => <AlertList alerts={list} />}
      </QueryState>
    </>
  )
}
