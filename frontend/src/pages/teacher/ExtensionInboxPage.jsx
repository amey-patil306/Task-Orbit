import { useState } from 'react'
import { errorMessage } from '../../api/client'
import { teacherApi } from '../../api/teacher'
import PageHeader from '../../components/PageHeader'
import { EmptyState, QueryState } from '../../components/States'
import { useExtensionInbox, useTeacherMutation } from '../../hooks/useTeacher'
import { formatDateTime, formatDay } from '../../lib/dates'

const STATUS = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

/** The workload snapshot the server attached when the student asked. */
function Evidence({ e }) {
  if (!e) return null
  const short = e.hours_required_until_due > e.hours_available_until_due
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Workload evidence (on {formatDay(e.computed_on)})</p>
      <ul className="space-y-1 text-slate-700">
        <li>
          Needs <b className={short ? 'text-red-700' : ''}>{e.hours_required_until_due} h</b> of work in the {e.days_until_due} day(s)
          before the deadline, with <b>{e.hours_available_until_due} h</b> of study time.
        </li>
        {e.overloaded_days.length > 0 && (
          <li>Overloaded on {e.overloaded_days.length} day(s): {e.overloaded_days.map((d) => formatDay(d.date)).join(', ')}</li>
        )}
        {e.other_deadlines_on_due_day.length > 0 && (
          <li>Other deadlines the same day: {e.other_deadlines_on_due_day.join(', ')}</li>
        )}
        <li>{e.open_tasks} open tasks in total · asking for {e.requested_extra_days} extra day(s)</li>
      </ul>
    </div>
  )
}

function RequestCard({ r }) {
  const decide = useTeacherMutation(({ status, note }) => teacherApi.decideExtension(r.id, { status, teacher_note: note || null }))
  const [note, setNote] = useState('')

  return (
    <li className="card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{r.student_name}</p>
          <p className="text-sm text-slate-500">{r.assignment_title} · {r.classroom_name}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS[r.status]}`}>{r.status}</span>
      </div>
      <p className="mt-3 text-sm text-slate-700">“{r.reason}”</p>
      <p className="mt-2 text-sm">
        <span className="text-slate-500">Due</span> {formatDateTime(r.current_due)}
        <span className="mx-2 text-slate-400">→</span>
        <span className="text-slate-500">asks for</span> <b>{formatDateTime(r.requested_due)}</b>
      </p>
      <div className="mt-3"><Evidence e={r.evidence} /></div>

      {r.status === 'pending' ? (
        <div className="mt-4 space-y-2">
          <input className="input" placeholder="Note to the student (optional)" maxLength={1000}
            value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note to the student" />
          {decide.isError && <p className="field-error">{errorMessage(decide.error)}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={decide.isPending}
              onClick={() => decide.mutate({ status: 'approved', note })}>Approve</button>
            <button type="button" className="btn-secondary" disabled={decide.isPending}
              onClick={() => decide.mutate({ status: 'rejected', note })}>Reject</button>
          </div>
        </div>
      ) : (
        r.teacher_note && <p className="mt-3 text-sm text-slate-600">Your note: {r.teacher_note}</p>
      )}
    </li>
  )
}

export default function ExtensionInboxPage() {
  const [status, setStatus] = useState('pending')
  const inbox = useExtensionInbox(status || undefined)

  return (
    <>
      <PageHeader title="Extension requests" subtitle="Each request comes with the student's real workload, so you can decide fairly" />
      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
        {[['pending', 'Pending'], ['', 'All']].map(([value, label]) => (
          <button key={label} type="button" onClick={() => setStatus(value)}
            className={`rounded-md px-3 py-1.5 font-medium ${status === value ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {label}
          </button>
        ))}
      </div>
      <QueryState query={inbox} loadingLabel="Loading requests…"
        empty={<EmptyState title={status ? 'No pending requests' : 'No requests yet'}
          message="Students can ask for more time on your assignments; requests show up here." />}>
        {(list) => <ul className="grid gap-4 lg:grid-cols-2">{list.map((r) => <RequestCard key={r.id} r={r} />)}</ul>}
      </QueryState>
    </>
  )
}
