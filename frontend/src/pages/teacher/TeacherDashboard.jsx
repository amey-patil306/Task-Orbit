import { Link, useLocation } from 'react-router-dom'
import Icon from '../../components/Icons'
import useCountUp from '../../hooks/useCountUp'
import PageHeader from '../../components/PageHeader'
import { EmptyState, QueryState } from '../../components/States'
import ClassHeatmap from '../../components/teacher/ClassHeatmap'
import InsightList from '../../components/teacher/InsightList'
import { useAuth } from '../../context/AuthContext'
import { useTeacherOverview } from '../../hooks/useTeacher'
import { formatDay, relativeDue } from '../../lib/dates'

const STAT_TONES = {
  red: 'from-rose-500 to-red-500 shadow-red-500/30',
  amber: 'from-amber-400 to-orange-500 shadow-orange-500/30',
  emerald: 'from-emerald-500 to-teal-500 shadow-emerald-500/30',
  slate: 'from-slate-400 to-slate-500 shadow-slate-500/20',
}

/** Stat tile; numbers count up when the page opens. */
function Stat({ label, value, icon, tone = 'emerald', to }) {
  const numeric = typeof value === 'number'
  const shown = useCountUp(numeric ? value : 0)
  const body = (
    <div className="flex items-center gap-4">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${STAT_TONES[tone]}`}>
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className={`mt-0.5 truncate font-extrabold tabular-nums tracking-tight ${numeric ? 'text-3xl' : 'text-xl'}`}>{numeric ? shown : value}</p>
      </div>
    </div>
  )
  return to
    ? <Link to={to} className="card card-hover block">{body}</Link>
    : <div className="card">{body}</div>
}

function ClassCard({ c }) {
  return (
    <Link to={`/teacher/classes/${c.id}`} className="card card-hover group block">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.colour, boxShadow: `0 0 0 4px ${c.colour}22` }} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold transition-colors group-hover:text-emerald-700">{c.name}</p>
          <p className="text-sm text-slate-500">{c.students_count} students · code <span className="font-mono">{c.join_code}</span></p>
        </div>
        {c.at_risk > 0 && (
          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">{c.at_risk} at risk</span>
        )}
      </div>
      <p className="mb-1.5 mt-4 text-xs font-medium text-slate-500">Students overloaded, next 14 days</p>
      <ClassHeatmap days={c.heatmap} compact />
      {c.upcoming.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          {c.upcoming.map((a) => (
            <li key={a.id} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate">{a.title}</span>
                <span className="shrink-0 text-xs text-slate-500">{relativeDue(a.due_date)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" title={`${a.done} of ${a.students} done`}>
                <div className="h-full origin-left animate-[grow_.9s_cubic-bezier(.2,.7,.2,1)_backwards] rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${Math.round(a.completion_rate * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Link>
  )
}

export default function TeacherDashboard() {
  const { user } = useAuth()
  const overview = useTeacherOverview()
  const welcome = useLocation().state?.welcome

  return (
    <>
      <PageHeader title={`Welcome, ${user?.name ?? ''}`} subtitle="Your classes' workload at a glance"
        actions={<Link to="/teacher/classes" className="btn-primary from-emerald-600 to-teal-600 shadow-emerald-500/30 hover:from-emerald-500 hover:to-teal-500">Manage classes</Link>} />
      {welcome && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">Welcome to Task Orbit!</p>
          <p className="mt-1">Create a class, share its code with students, then post assignments. The Deadline Advisor
            will show how each due date fits with the work other subjects have already given.</p>
        </div>
      )}
      <QueryState query={overview} loadingLabel="Loading your classes…"
        isEmpty={(d) => d.classes.length === 0}
        empty={<EmptyState title="No classes yet" message="Create your first class and share the code with your students."
          action={<Link to="/teacher/classes" className="btn-primary">Create a class</Link>} />}>
        {(d) => {
          // Classes often share students (e.g. DBMS and OS for SE-A), so show the largest class count, not a sum.
          const atRisk = Math.max(0, ...d.classes.map((c) => c.at_risk))
          const busiest = d.classes.flatMap((c) => c.heatmap).reduce((a, b) => (b.pct_overloaded > (a?.pct_overloaded ?? -1) ? b : a), null)
          return (
            <div className="stagger space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Students at high risk" value={atRisk} icon="warning" tone={atRisk ? 'red' : 'slate'} />
                <Stat label="Busiest day (next 2 weeks)" icon="calendar" tone="emerald"
                  value={busiest && busiest.pct_overloaded > 0 ? formatDay(busiest.date) : '—'} />
                <Stat label="Extension requests" value={d.pending_extensions} icon="inbox" to="/teacher/extensions"
                  tone={d.pending_extensions ? 'amber' : 'slate'} />
              </div>

              <section className="card">
                <h2 className="mb-3 flex items-center gap-2 font-bold"><Icon name="spark" className="h-5 w-5 text-emerald-600" />Insights &amp; suggestions</h2>
                <InsightList insights={d.insights} limit={6} />
              </section>

              <section>
                <h2 className="mb-3 font-bold">Your classes</h2>
                <div className="stagger grid gap-4 md:grid-cols-2">
                  {d.classes.map((c) => <ClassCard key={c.id} c={c} />)}
                </div>
              </section>
            </div>
          )
        }}
      </QueryState>
    </>
  )
}
