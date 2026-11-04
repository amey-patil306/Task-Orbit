import { usePageTitle } from '../../components/PageHeader'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { teacherApi } from '../../api/teacher'
import Icon from '../../components/Icons'
import Modal, { ConfirmDialog } from '../../components/Modal'
import { QueryState } from '../../components/States'
import AssignmentForm from '../../components/teacher/AssignmentForm'
import { useAssignment, useTeacherMutation } from '../../hooks/useTeacher'
import { useToast } from '../../components/Toast'
import { TASK_STATUSES, TASK_TYPES, labelOf } from '../../lib/constants'
import { formatDateTime, relativeDue } from '../../lib/dates'

const STATUS_STYLES = {
  todo: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-indigo-50 text-indigo-700',
  done: 'bg-green-50 text-green-700',
}

function Stat({ label, value, hint, tone = '' }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export default function AssignmentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useAssignment(Number(id))
  const update = useTeacherMutation((body) => teacherApi.updateAssignment(Number(id), body))
  const remove = useTeacherMutation(() => teacherApi.deleteAssignment(Number(id)))
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <QueryState query={query} loadingLabel="Loading assignment…" isEmpty={() => false}>
      {(a) => (
        <>
          <Link to={`/teacher/classes/${a.classroom.id}?tab=assignments`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <Icon name="back" className="h-4 w-4" /> {a.classroom.name}
          </Link>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{a.title}</h1>
              <PageTitle title={a.title} />
              <p className="mt-1 text-sm text-slate-500">
                {labelOf(TASK_TYPES, a.type)} · difficulty {a.difficulty} · due {formatDateTime(a.due_date)} ({relativeDue(a.due_date)})
              </p>
              {a.description && <p className="mt-2 max-w-2xl text-sm text-slate-700">{a.description}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost text-red-600" onClick={() => setDeleting(true)} aria-label="Delete assignment">
                <Icon name="trash" className="h-4 w-4" />
              </button>
              <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
                <Icon name="edit" className="h-4 w-4" /> Edit
              </button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Completed" value={`${a.done}/${a.students}`} hint={`${Math.round(a.completion_rate * 100)}% · ${a.in_progress} in progress`} />
            <Stat label="Not started" value={a.not_started} tone={a.not_started && relativeDue(a.due_date).includes('Due') ? 'text-amber-600' : ''} />
            <Stat label="Late" value={a.late} tone={a.late ? 'text-red-600' : ''} hint={a.extensions_approved ? `${a.extensions_approved} extension(s) approved` : null} />
            <Stat label="Hours: expected → actual" value={`${a.expected_hours} → ${a.avg_actual_hours ?? '?'}`}
              tone={a.hours_ratio >= 1.3 ? 'text-red-600' : ''}
              hint={a.hours_ratio ? `Students took ${a.hours_ratio}x your estimate` : 'Appears as students finish'} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-surface shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Their due date</th>
                  <th className="px-4 py-3 text-right">Their estimate</th>
                  <th className="px-4 py-3 text-right">Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {a.student_rows.map((r) => (
                  <tr key={r.student_id}>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                        {labelOf(TASK_STATUSES, r.status)}
                      </span>
                      {r.late && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">late</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDateTime(r.due_date)}
                      {r.due_date !== a.due_date && <span className="ml-1 text-xs text-emerald-700">(extended)</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.estimated_hours} h</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.actual_hours != null ? `${r.actual_hours} h` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Modal open={editing} title="Edit assignment" onClose={() => setEditing(false)} size="max-w-5xl"
            footer={<>
              <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" form="assignment-form" className="btn-primary" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </>}>
            {editing && (
              <>
                <p className="mb-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  Changes reach every student. Students with an approved extension keep their own due date, and students
                  who changed their own estimate keep it.
                </p>
                <AssignmentForm classId={a.classroom.id} assignment={a}
                  onSubmit={async (body) => { await update.mutateAsync(body); toast('Assignment updated', { description: 'Students have been notified of any changes.' }); setEditing(false) }} />
              </>
            )}
          </Modal>

          <ConfirmDialog open={deleting} title="Delete assignment?" busy={remove.isPending}
            message={`"${a.title}" will be removed from all ${a.students} students' task lists, including their logged hours.`}
            onConfirm={async () => {
              await remove.mutateAsync()
              toast('Assignment deleted', { tone: 'info' })
              navigate(`/teacher/classes/${a.classroom.id}?tab=assignments`, { replace: true })
            }}
            onClose={() => setDeleting(false)} />
        </>
      )}
    </QueryState>
  )
}

/** Renders nothing; sets the tab title from inside the data-loaded branch. */
function PageTitle({ title }) {
  usePageTitle(title)
  return null
}
