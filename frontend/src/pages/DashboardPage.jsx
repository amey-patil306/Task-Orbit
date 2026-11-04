import { Link } from 'react-router-dom'
import AlertList from '../components/AlertList'
import Heatmap from '../components/Heatmap'
import Icon from '../components/Icons'
import LoadRing from '../components/LoadRing'
import PageHeader from '../components/PageHeader'
import RiskStrip from '../components/RiskStrip'
import StressCheckin from '../components/StressCheckin'
import { EmptyState, ErrorState, QueryState } from '../components/States'
import { useAuth } from '../context/AuthContext'
import { useAlerts } from '../hooks/useAlerts'
import { useSubjectMap } from '../hooks/useSubjects'
import { useTasks } from '../hooks/useTasks'
import useCountUp from '../hooks/useCountUp'
import { usePredict, useWorkload } from '../hooks/useWorkload'
import { LOAD_STYLES, TASK_TYPES, labelOf, loadLevel, taskColour, taskSubject } from '../lib/constants'
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
        <h2 className="font-bold">{title}</h2>
        {link && <Link to={link.to} className="group flex items-center gap-1 text-sm font-medium text-indigo-600">{link.label}<Icon name="arrowRight" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></Link>}
      </div>
      {query?.isPending ? <div className="space-y-2 py-2"><span className="skeleton block h-4 w-3/4" /><span className="skeleton block h-4 w-1/2" /><span className="skeleton block h-4 w-2/3" /></div>
        : query?.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
        : children}
    </section>
  )
}

/** "Am I in trouble this week?" - answered by today's gauge + the week's verdict. */
function TodayCard({ workload, forecast }) {
  const today = workload[0]
  const hours = useCountUp(today.hours_required, { decimals: 1 })
  const highDays = forecast?.days.filter((d) => d.risk === 'high').length ?? 0
  const level = LOAD_STYLES[loadLevel(today.load_ratio)]
  const verdict = highDays === 0
    ? 'You are on track this week.'
    : `${highDays} high-risk day${highDays === 1 ? '' : 's'} this week. Check the planner.`

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 bg-[length:200%_200%] p-5 text-white shadow-xl shadow-indigo-500/25 animate-gradient-x sm:p-7">
      {/* Decorative orbit rings */}
      <svg viewBox="0 0 400 400" className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 opacity-25" aria-hidden="true">
        <g className="animate-orbit" style={{ transformOrigin: '200px 200px', '--orbit-speed': '60s' }}>
          <circle cx="200" cy="200" r="120" fill="none" stroke="white" strokeDasharray="4 8" />
          <circle cx="320" cy="200" r="6" fill="white" />
        </g>
        <g className="animate-orbit-rev" style={{ transformOrigin: '200px 200px', '--orbit-speed': '90s' }}>
          <circle cx="200" cy="200" r="180" fill="none" stroke="white" strokeDasharray="2 10" />
          <circle cx="200" cy="20" r="4" fill="white" />
        </g>
      </svg>

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <LoadRing ratio={today.load_ratio} />
        <div className="flex-1">
          <p className="text-sm font-medium text-white/75">Today's load</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight">
            {hours} h <span className="text-base font-medium text-white/70">of {today.hours_available} h free</span>
          </p>
          <span className="mt-2 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-white/25 backdrop-blur">
            {level.label}
          </span>
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-white/90">
            <Icon name={highDays ? 'warning' : 'check'} className="h-4 w-4" />{verdict}
          </p>
        </div>
        <Link to="/planner" className="btn group self-start bg-white text-[#4338ca] shadow-lg shadow-black/20 hover:bg-[#eef2ff] sm:self-center">
          Open study plan <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
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
    <ol className="stagger -mx-2 divide-y divide-slate-100">
      {next.map((t) => {
        const n = daysUntil(t.due_date)
        return (
          <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-slate-50">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: taskColour(t, subjects), boxShadow: `0 0 0 4px ${taskColour(t, subjects)}22` }} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.title}</p>
              <p className="text-xs text-slate-500">{taskSubject(t, subjects) ?? labelOf(TASK_TYPES, t.type)} · {t.estimated_hours} h · priority {t.priority}</p>
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
          message="Join your classes to get your teachers' assignments, or add your own tasks. Task Orbit will show your daily load, warn you before you're overloaded and build a study plan."
          action={<div className="flex justify-center gap-2">
            <Link to="/classes" className="btn-primary">Join a class</Link>
            <Link to="/tasks" className="btn-secondary">Add a task</Link>
            <Link to="/settings" className="btn-secondary">Set study hours</Link>
          </div>} />
      ) : (
        <div className="stagger space-y-6">
          <QueryState query={workload} loadingLabel="Calculating today's load…">
            {(rows) => <TodayCard workload={rows} forecast={predict.data} />}
          </QueryState>

          <StressCheckin />

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
