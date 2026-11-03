import { Link } from 'react-router-dom'
import AlertList from '../components/AlertList'
import Heatmap from '../components/Heatmap'
import LoadBadge from '../components/LoadBadge'
import PageHeader from '../components/PageHeader'
import RiskStrip from '../components/RiskStrip'
import { EmptyState, ErrorState, QueryState, Spinner } from '../components/States'
import { useAuth } from '../context/AuthContext'
import { useAlerts } from '../hooks/useAlerts'
import { useSubjectMap } from '../hooks/useSubjects'
import { useTasks } from '../hooks/useTasks'
import { usePredict, useWorkload } from '../hooks/useWorkload'
import { TASK_TYPES, labelOf } from '../lib/constants'
import { daysUntil, relativeDue } from '../lib/dates'

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** Small wrapper so each dashboard card handles its own loading/error. */
function Section({ title, link, query, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {link && <Link to={link.to} className="text-sm text-indigo-600 hover:underline">{link.label}</Link>}
      </div>
      {query?.isPending ? <Spinner className="py-6" />
        : query?.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
        : children}
    </section>
  )
}

/** "Am I in trouble this week?" - answered by today's badge + the week's verdict. */
function TodayCard({ workload, forecast }) {
  const today = workload[0]
  const highDays = forecast?.days.filter((d) => d.risk === 'high').length ?? 0
  const verdict = highDays === 0
    ? { text: 'You are on track this week.', cls: 'text-green-700' }
    : { text: `${highDays} high-risk day${highDays === 1 ? '' : 's'} this week. Check the planner.`, cls: 'text-red-700' }

  return (
    <section className="card flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <p className="text-sm text-slate-500">Today's load</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="text-3xl font-semibold tabular-nums">{today.hours_required} h</span>
          <span className="text-sm text-slate-500">of {today.hours_available} h free</span>
          <LoadBadge ratio={today.load_ratio} />
        </div>
        <p className={`mt-2 text-sm font-medium ${verdict.cls}`}>{verdict.text}</p>
      </div>
      <Link to="/planner" className="btn-primary self-start sm:self-center">Open study plan</Link>
    </section>
  )
}

function NextTasks({ tasks }) {
  const subjects = useSubjectMap()
  // Same idea as the planner's score: priority first, then the nearest deadline.
  const next = tasks.filter((t) => t.status !== 'done')
    .sort((a, b) => b.priority - a.priority || new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5)

  if (next.length === 0) {
    return <EmptyState title="Nothing open" message="Add your upcoming work to get started."
      action={<Link to="/tasks" className="btn-primary">Add a task</Link>} />
  }
  return (
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
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const tasks = useTasks()
  const workload = useWorkload(14)
  const predict = usePredict()
  const alerts = useAlerts(true)

  const noTasks = tasks.data?.length === 0

  return (
    <>
      <PageHeader title={`${greeting()}, ${user?.name?.split(' ')[0] ?? ''}`} subtitle="Here's how your next two weeks look" />

      {noTasks ? (
        <EmptyState title="Welcome! Let's add your first task"
          message="Add assignments, practicals, exams and projects. Task Orbit will show your daily load, warn you before you're overloaded and build a study plan."
          action={<div className="flex justify-center gap-2">
            <Link to="/tasks" className="btn-primary">Add a task</Link>
            <Link to="/settings" className="btn-secondary">Set study hours</Link>
          </div>} />
      ) : (
        <div className="space-y-6">
          <QueryState query={workload} loadingLabel="Calculating today's load…">
            {(rows) => <TodayCard workload={rows} forecast={predict.data} />}
          </QueryState>

          <Section title="Next 7 days risk" link={{ to: '/workload', label: 'Details' }} query={predict}>
            {predict.data && <RiskStrip forecast={predict.data} />}
          </Section>

          <div className="grid gap-6 lg:grid-cols-5">
            <Section title="What to do next" link={{ to: '/tasks', label: 'All tasks' }} query={tasks} className="lg:col-span-3">
              {tasks.data && <NextTasks tasks={tasks.data} />}
            </Section>
            <Section title="14-day heatmap" link={{ to: '/workload', label: '4 weeks' }} query={workload} className="lg:col-span-2">
              {workload.data && <Heatmap rows={workload.data} />}
            </Section>
          </div>

          <Section title="Unread alerts" link={{ to: '/alerts', label: 'All alerts' }} query={alerts}>
            {alerts.data?.length
              ? <AlertList alerts={alerts.data.slice(0, 4)} compact />
              : <p className="text-sm text-slate-500">No unread alerts. 👍</p>}
          </Section>
        </div>
      )}
    </>
  )
}
