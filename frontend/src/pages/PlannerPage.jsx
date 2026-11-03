import { Link } from 'react-router-dom'
import { errorMessage } from '../api/client'
import Icon from '../components/Icons'
import PageHeader from '../components/PageHeader'
import { EmptyState, QueryState } from '../components/States'
import { useGeneratePlan, usePlan, useTickSession } from '../hooks/usePlan'
import { useSubjectMap } from '../hooks/useSubjects'
import { formatDay, istToday } from '../lib/dates'

function groupByDay(sessions) {
  const groups = {}
  for (const s of sessions) (groups[s.planned_date] ??= []).push(s)
  return Object.entries(groups)
}

function SessionList({ sessions }) {
  const tick = useTickSession()
  const subjects = useSubjectMap()
  const today = istToday()

  return (
    <div className="space-y-4">
      {groupByDay(sessions).map(([day, items]) => {
        const total = items.reduce((sum, s) => sum + s.planned_hours, 0)
        const isPast = day < today
        return (
          <section key={day} className="card">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">
                {day === today ? 'Today' : formatDay(day)}
                {isPast && <span className="ml-2 text-xs font-normal text-red-600">missed?</span>}
              </h2>
              <span className="text-sm text-slate-500">{Math.round(total * 10) / 10} h</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-2.5">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={s.done} disabled={tick.isPending}
                      onChange={(e) => tick.mutate({ id: s.id, done: e.target.checked })} />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subjects[s.subject_id]?.colour ?? '#CBD5E1' }} />
                    <span className={`flex-1 text-sm ${s.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{s.task_title}</span>
                    <span className="text-sm tabular-nums text-slate-500">{s.planned_hours} h</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function Unscheduled({ result }) {
  if (!result) return null
  if (result.unscheduled.length === 0) {
    return (
      <div className="card border-green-200 bg-green-50 text-sm text-green-800">
        Everything fits in your available time. 🎉
      </div>
    )
  }
  return (
    <div className="card border-red-200">
      <h2 className="font-semibold text-red-800">Doesn't fit ({result.unscheduled.length})</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {result.unscheduled.map((u) => (
          <li key={u.task_id} className="flex justify-between gap-2">
            <span className="truncate">{u.title}</span>
            <span className="shrink-0 tabular-nums text-red-700">{u.hours_left} h left</span>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 text-sm font-semibold">Suggestions</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
        {result.suggestions.map((tip) => <li key={tip}>{tip}</li>)}
      </ul>
    </div>
  )
}

export default function PlannerPage() {
  const plan = usePlan()
  const generate = useGeneratePlan()

  const regenerate = (
    <button type="button" className="btn-primary" disabled={generate.isPending} onClick={() => generate.mutate(14)}>
      <Icon name="refresh" className={`h-4 w-4 ${generate.isPending ? 'animate-spin' : ''}`} />
      {generate.isPending ? 'Planning…' : plan.data?.length ? 'Regenerate plan' : 'Generate plan'}
    </button>
  )

  return (
    <>
      <PageHeader title="Planner" subtitle="Study sessions for the next 2 weeks that fit your free time" actions={regenerate} />
      {generate.isError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage(generate.error)}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QueryState query={plan} loadingLabel="Loading your plan…"
            empty={
              <EmptyState title="No study plan yet"
                message="Task Orbit will split your tasks into daily study sessions that fit your free time."
                action={<div className="flex justify-center gap-2">{regenerate}<Link to="/tasks" className="btn-secondary">Add tasks</Link></div>} />
            }>
            {(sessions) => <SessionList sessions={sessions} />}
          </QueryState>
        </div>
        <aside className="space-y-4">
          <Unscheduled result={generate.data} />
          <div className="card text-sm text-slate-600">
            <h2 className="font-semibold text-slate-900">How the plan is made</h2>
            <p className="mt-2">Tasks are placed in deadline order, on the earliest days with free time, at most 3 h of one task per day.</p>
            <p className="mt-2">When deadlines tie, a priority score (priority, difficulty, urgency, exam or not) decides who goes first.</p>
            <p className="mt-2">Ticked sessions count as done when you regenerate.</p>
          </div>
        </aside>
      </div>
    </>
  )
}
