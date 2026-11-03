import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { teacherApi } from '../../api/teacher'
import Icon from '../../components/Icons'
import Modal, { ConfirmDialog } from '../../components/Modal'
import { EmptyState, QueryState } from '../../components/States'
import AssignmentForm from '../../components/teacher/AssignmentForm'
import ClassHeatmap from '../../components/teacher/ClassHeatmap'
import { useClassAnalytics, useTeacherMutation } from '../../hooks/useTeacher'
import { RISK_STYLES, TASK_TYPES, labelOf } from '../../lib/constants'
import { formatDate, formatDay, relativeDue } from '../../lib/dates'
import { ClassFormModal, JoinCode } from './TeacherClassesPage'

const TABS = [['overview', 'Overview'], ['assignments', 'Assignments'], ['students', 'Students']]

/* ---------------------------------------------------------------- overview */

function SubjectShare({ rows }) {
  if (!rows.length) return <p className="text-sm text-slate-500">No upcoming work in the next 2 weeks.</p>
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.subject}>
          <div className="flex justify-between text-sm">
            <span className="font-medium">
              {r.subject}{r.is_mine && <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] text-indigo-800">yours</span>}
            </span>
            <span className="tabular-nums text-slate-500">{r.avg_hours_per_student} h / student · {Math.round(r.share * 100)}%</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${r.share * 100}%`, backgroundColor: r.colour }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function EstimateChart({ assignments }) {
  const data = assignments.filter((a) => a.avg_actual_hours != null).reverse()
    .map((a) => ({ name: a.title.length > 16 ? `${a.title.slice(0, 15)}…` : a.title, Expected: a.expected_hours, Actual: a.avg_actual_hours }))
  if (!data.length) return <p className="text-sm text-slate-500">Shows up once students finish assignments and log their hours.</p>
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11 }} unit="h" />
          <Tooltip formatter={(v) => `${v} h`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Expected" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Actual" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function StressChart({ trend }) {
  if (trend.length < 2) return <p className="text-sm text-slate-500">Needs at least two weeks of student check-ins.</p>
  const data = trend.map((t) => ({ week: formatDay(t.week_start), Stress: t.avg_stress, responses: t.responses }))
  return (
    <div className="h-48">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v, n, p) => [`${v}/5 (${p.payload.responses} responses)`, 'Avg stress']} />
          <Line dataKey="Stress" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function Overview({ data }) {
  const risky = data.roster.filter((r) => r.risk === 'high')
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <h2 className="font-semibold">Class workload, next 4 weeks</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">Includes work from every subject the students take. Hover a day for details.</p>
          <ClassHeatmap days={data.heatmap} />
        </section>
        <section className="card lg:col-span-2">
          <h2 className="font-semibold">Who's giving the work? (next 2 weeks)</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">Each subject's share of your students' total load.</p>
          <SubjectShare rows={data.subject_share} />
        </section>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <h2 className="font-semibold">Expected vs actual hours</h2>
          <p className="mb-3 mt-1 text-sm text-slate-500">Average hours students really spent, from what they logged on completion.</p>
          <EstimateChart assignments={data.assignments} />
        </section>
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="font-semibold">Early warning</h2>
            {risky.length === 0
              ? <p className="mt-2 text-sm text-slate-500">No students at high risk right now.</p>
              : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {risky.slice(0, 5).map((r) => (
                    <li key={r.id} className="py-2 text-sm">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-slate-500">{r.reasons.join(' · ')}</p>
                    </li>
                  ))}
                </ul>
              )}
          </section>
          <section className="card">
            <h2 className="mb-2 font-semibold">Average stress (weekly check-in)</h2>
            <StressChart trend={data.stress_trend} />
          </section>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- assignments */

function AssignmentsTab({ classId, assignments, onNew }) {
  if (!assignments.length) {
    return <EmptyState title="No assignments yet" message="Post work here; every student in the class gets it in their task list."
      action={<button type="button" className="btn-primary" onClick={onNew}>New assignment</button>} />
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Assignment</th>
            <th className="px-4 py-3">Due</th>
            <th className="px-4 py-3">Done</th>
            <th className="px-4 py-3 text-right">Late</th>
            <th className="px-4 py-3 text-right">Expected → actual</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assignments.map((a) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link to={`/teacher/assignments/${a.id}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">{a.title}</Link>
                <p className="text-xs text-slate-500">{labelOf(TASK_TYPES, a.type)} · difficulty {a.difficulty}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {formatDate(a.due_date)}
                <span className="block text-xs text-slate-500">{relativeDue(a.due_date)}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${a.completion_rate * 100}%` }} />
                  </div>
                  <span className="tabular-nums text-slate-600">{a.done}/{a.students}</span>
                </div>
              </td>
              <td className={`px-4 py-3 text-right tabular-nums ${a.late ? 'font-medium text-red-700' : 'text-slate-400'}`}>{a.late}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {a.expected_hours} h
                {a.avg_actual_hours != null && (
                  <span className={a.hours_ratio >= 1.3 ? 'font-medium text-red-700' : 'text-slate-600'}> → {a.avg_actual_hours} h</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------------------------------------------------------- students */

function StudentsTab({ classId, roster }) {
  const remove = useTeacherMutation(({ sid }) => teacherApi.removeStudent(classId, sid))
  const [removing, setRemoving] = useState(null)
  if (!roster.length) return <EmptyState title="No students yet" message="Share the class code so students can join." />
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Why</th>
              <th className="px-4 py-3 text-center">Stress</th>
              <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {roster.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${RISK_STYLES[r.risk].badge}`}>
                    {RISK_STYLES[r.risk].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.reasons.length ? r.reasons.join(' · ') : <span className="text-slate-400">On track</span>}</td>
                <td className={`px-4 py-3 text-center tabular-nums ${r.latest_stress >= 4 ? 'font-medium text-red-700' : ''}`}>
                  {r.latest_stress ? `${r.latest_stress}/5` : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" className="btn-ghost text-xs text-slate-500" onClick={() => setRemoving(r)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Risk is a rule-based early-warning score (overdue work, overloaded days, late history, stress check-ins).
        It will be replaced by the ML risk model once trained.
      </p>
      <ConfirmDialog open={Boolean(removing)} title="Remove student?" confirmLabel="Remove" busy={remove.isPending}
        message={`${removing?.name} will leave this class and their unfinished tasks from it will be removed.`}
        onConfirm={async () => { await remove.mutateAsync({ sid: removing.id }); setRemoving(null) }}
        onClose={() => setRemoving(null)} />
    </>
  )
}

/* ---------------------------------------------------------------- page */

export default function ClassDetailPage() {
  const { id } = useParams()
  const classId = Number(id)
  const navigate = useNavigate()
  const analytics = useClassAnalytics(classId)
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'overview'
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const create = useTeacherMutation((body) => teacherApi.createAssignment(classId, body))
  const removeClass = useTeacherMutation(() => teacherApi.deleteClassroom(classId))

  return (
    <QueryState query={analytics} loadingLabel="Analysing the class…" isEmpty={() => false}>
      {(data) => {
        const c = data.classroom
        return (
          <>
            <Link to="/teacher/classes" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
              <Icon name="back" className="h-4 w-4" /> Classes
            </Link>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-2 h-3.5 w-3.5 rounded-full" style={{ backgroundColor: c.colour }} />
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span>{c.students_count} students</span>
                    <span className="flex items-center gap-2">Join code <JoinCode code={c.join_code} /></span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost text-red-600" onClick={() => setDeleting(true)} aria-label="Delete class" title="Delete class">
                  <Icon name="trash" className="h-4 w-4" />
                </button>
                <button type="button" className="btn-secondary" onClick={() => setEditing(true)}><Icon name="edit" className="h-4 w-4" />Edit</button>
                <button type="button" className="btn-primary" onClick={() => setNewOpen(true)}><Icon name="plus" className="h-4 w-4" />New assignment</button>
              </div>
            </div>

            <div className="mb-6 flex gap-1 border-b border-slate-200" role="tablist">
              {TABS.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key}
                  onClick={() => setParams(key === 'overview' ? {} : { tab: key }, { replace: true })}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === key
                    ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  {label}
                  {key === 'students' && data.roster.some((r) => r.risk === 'high') && (
                    <span className="ml-1.5 rounded-full bg-red-100 px-1.5 text-xs text-red-800">
                      {data.roster.filter((r) => r.risk === 'high').length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {tab === 'overview' && <Overview data={data} />}
            {tab === 'assignments' && <AssignmentsTab classId={classId} assignments={data.assignments} onNew={() => setNewOpen(true)} />}
            {tab === 'students' && <StudentsTab classId={classId} roster={data.roster} />}

            <Modal open={newOpen} title={`New assignment for ${c.name}`} onClose={() => setNewOpen(false)} size="max-w-5xl"
              footer={<>
                <button type="button" className="btn-secondary" onClick={() => setNewOpen(false)}>Cancel</button>
                <button type="submit" form="assignment-form" className="btn-primary" disabled={create.isPending}>
                  {create.isPending ? 'Posting…' : `Post to ${c.students_count} students`}
                </button>
              </>}>
              {newOpen && <AssignmentForm classId={classId} onSubmit={async (body) => {
                await create.mutateAsync(body)
                setNewOpen(false)
                setParams({ tab: 'assignments' }, { replace: true })
              }} />}
            </Modal>

            {editing && <ClassFormModal open classroom={c} onClose={() => setEditing(false)} />}
            <ConfirmDialog open={deleting} title="Delete class?" busy={removeClass.isPending}
              message={`"${c.name}" and all its assignments will be deleted, including students' copies. This cannot be undone.`}
              onConfirm={async () => { await removeClass.mutateAsync(); navigate('/teacher/classes', { replace: true }) }}
              onClose={() => setDeleting(false)} />
          </>
        )
      }}
    </QueryState>
  )
}
