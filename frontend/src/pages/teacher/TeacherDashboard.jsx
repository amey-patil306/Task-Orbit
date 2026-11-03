import { Link, useLocation } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import { EmptyState, QueryState } from '../../components/States'
import ClassHeatmap from '../../components/teacher/ClassHeatmap'
import InsightList from '../../components/teacher/InsightList'
import { useAuth } from '../../context/AuthContext'
import { useTeacherOverview } from '../../hooks/useTeacher'
import { formatDay, relativeDue } from '../../lib/dates'

function Stat({ label, value, tone = 'text-slate-900', to }) {
  const body = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </>
  )
  return to ? <Link to={to} className="card block hover:border-indigo-300">{body}</Link> : <div className="card">{body}</div>
}

function ClassCard({ c }) {
  return (
    <Link to={`/teacher/classes/${c.id}`} className="card block transition hover:border-indigo-300 hover:shadow">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.colour }} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{c.name}</p>
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
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.round(a.completion_rate * 100)}%` }} />
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
        actions={<Link to="/teacher/classes" className="btn-primary">Manage classes</Link>} />
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
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Students at high risk" value={atRisk} tone={atRisk ? 'text-red-600' : 'text-slate-900'} />
                <Stat label="Busiest day (next 2 weeks)"
                  value={busiest && busiest.pct_overloaded > 0 ? formatDay(busiest.date) : '—'}
                  tone="text-slate-900 text-2xl" />
                <Stat label="Extension requests" value={d.pending_extensions} to="/teacher/extensions"
                  tone={d.pending_extensions ? 'text-amber-600' : 'text-slate-900'} />
              </div>

              <section className="card">
                <h2 className="mb-3 font-semibold">Insights &amp; suggestions</h2>
                <InsightList insights={d.insights} limit={6} />
              </section>

              <section>
                <h2 className="mb-3 font-semibold">Your classes</h2>
                <div className="grid gap-4 md:grid-cols-2">
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
