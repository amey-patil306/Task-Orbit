import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { EmptyState, QueryState } from '../components/States'
import { useAuth } from '../context/AuthContext'
import { useAvailability } from '../hooks/useAvailability'
import { useSubjectMap } from '../hooks/useSubjects'
import { useTasks } from '../hooks/useTasks'
import { TASK_TYPES, labelOf } from '../lib/constants'
import { daysUntil, relativeDue } from '../lib/dates'

function Stat({ label, value, hint, tone = 'text-slate-900' }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function Overview({ tasks }) {
  const subjects = useSubjectMap()
  const { data: availability = [] } = useAvailability()

  const open = tasks.filter((t) => t.status !== 'done')
  const overdue = open.filter((t) => daysUntil(t.due_date) < 0)
  const thisWeek = open.filter((t) => { const n = daysUntil(t.due_date); return n >= 0 && n < 7 })
  const hoursThisWeek = thisWeek.reduce((s, t) => s + t.estimated_hours, 0)
  const weeklyHours = availability.reduce((s, a) => s + a.hours, 0)

  // Simple ordering until the planner's priority score exists (section 9): priority, then due date.
  const next = [...open]
    .sort((a, b) => b.priority - a.priority || new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5)

  if (open.length === 0) {
    return (
      <EmptyState title="Nothing open right now"
        message="You're all caught up. Add upcoming assignments and exams to keep an eye on your workload."
        action={<Link to="/tasks" className="btn-primary">Add a task</Link>} />
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? 'text-red-600' : 'text-slate-900'}
          hint={overdue.length ? 'Finish or reschedule these first' : 'Nothing overdue'} />
        <Stat label="Due in the next 7 days" value={thisWeek.length} hint={`${hoursThisWeek} h estimated`} />
        <Stat label="Study time this week" value={`${weeklyHours} h`} hint={<Link to="/settings" className="text-indigo-600 hover:underline">Change availability</Link>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">What to do next</h2>
            <Link to="/tasks" className="text-sm text-indigo-600 hover:underline">All tasks</Link>
          </div>
          <ol className="divide-y divide-slate-100">
            {next.map((t) => {
              const n = daysUntil(t.due_date)
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subjects[t.subject_id]?.colour ?? '#CBD5E1' }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.title}</p>
                    <p className="text-xs text-slate-500">{labelOf(TASK_TYPES, t.type)} · {t.estimated_hours} h · priority {t.priority}</p>
                  </div>
                  <span className={`whitespace-nowrap text-sm ${n < 0 ? 'font-medium text-red-700' : n <= 2 ? 'text-amber-700' : 'text-slate-500'}`}>
                    {relativeDue(t.due_date)}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>

        <section className="card lg:col-span-2">
          <h2 className="font-semibold">Load forecast</h2>
          <p className="mt-2 text-sm text-slate-500">
            Today's load badge, the 7-day risk strip and the 14-day heatmap appear here once the workload
            engine and ML forecast are live.
          </p>
          <div className="mt-4 grid grid-cols-7 gap-1" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => <div key={i} className="aspect-square rounded bg-slate-100" />)}
          </div>
        </section>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const tasksQuery = useTasks()
  return (
    <>
      <PageHeader title={`${greeting()}, ${user?.name?.split(' ')[0] ?? ''}`} subtitle="Here's how your week looks" />
      <QueryState query={tasksQuery} loadingLabel="Loading your week…" isEmpty={() => false}>
        {(tasks) => <Overview tasks={tasks} />}
      </QueryState>
    </>
  )
}
