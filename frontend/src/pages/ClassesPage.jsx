import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { errorMessage, fieldErrors } from '../api/client'
import Icon from '../components/Icons'
import { ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/Toast'
import PageHeader from '../components/PageHeader'
import { EmptyState, QueryState } from '../components/States'
import { useJoinClass, useLeaveClass, useMyClassrooms, useMyExtensions } from '../hooks/useClassrooms'
import { formatDateTime } from '../lib/dates'

const STATUS = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

function JoinForm() {
  const join = useJoinClass()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [joined, setJoined] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setJoined(null)
    if (code.trim().length < 4) {
      setError('Enter the 6-character code from your teacher.')
      return
    }
    try {
      const c = await join.mutateAsync(code.trim().toUpperCase())
      setJoined(c)
      setCode('')
      toast(`Joined ${c.name}`, { description: 'Its upcoming work is now in your tasks.' })
    } catch (err) {
      // e.g. "No class with that code. Check the code with your teacher."
      const hint = fieldErrors(err).code
      const message = errorMessage(err)
      setError(hint && !hint.startsWith('already') ? `${message}. ${hint[0].toUpperCase()}${hint.slice(1)}.` : message)
    }
  }

  return (
    <form onSubmit={submit} className="card" noValidate>
      <h2 className="font-semibold">Join a class</h2>
      <p className="mt-1 text-sm text-slate-500">Your teacher shares a code. Their assignments will appear in your tasks automatically.</p>
      <div className="mt-4 flex gap-2">
        <input className={`input max-w-[12rem] font-mono uppercase tracking-widest ${error ? 'input-error' : ''}`}
          placeholder="DBMS4A" maxLength={8} value={code} aria-label="Class code"
          onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <button type="submit" className="btn-primary" disabled={join.isPending}>{join.isPending ? 'Joining…' : 'Join'}</button>
      </div>
      {error && <p className="field-error">{error}</p>}
      {joined && <p className="mt-2 text-sm text-green-700">Joined {joined.name}. Its upcoming work is now in your tasks.</p>}
    </form>
  )
}

function ClassList() {
  const classes = useMyClassrooms()
  const leave = useLeaveClass()
  const toast = useToast()
  const [leaving, setLeaving] = useState(null)

  return (
    <>
      <QueryState query={classes} loadingLabel="Loading your classes…"
        empty={<EmptyState title="You haven't joined any classes yet" message="Ask your teachers for their class codes." />}>
        {(list) => (
          <ul className="stagger grid gap-3 sm:grid-cols-2">
            {list.map((c) => (
              <li key={c.id} className="card card-hover flex items-start gap-3">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.colour, boxShadow: `0 0 0 4px ${c.colour}22` }} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-slate-500">{c.teacher_name} · {c.students_count} students · {c.assignments_count} assignments</p>
                </div>
                <button type="button" className="btn-ghost text-xs text-slate-500" onClick={() => setLeaving(c)}>Leave</button>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      <ConfirmDialog open={Boolean(leaving)} title="Leave class?" confirmLabel="Leave" busy={leave.isPending}
        message={`You'll stop getting work from ${leaving?.name}. Unfinished tasks from this class will be removed.`}
        onConfirm={async () => { await leave.mutateAsync(leaving.id); toast(`Left ${leaving.name}`, { tone: 'info' }); setLeaving(null) }}
        onClose={() => setLeaving(null)} />
    </>
  )
}

function MyExtensions() {
  const requests = useMyExtensions()
  return (
    <QueryState query={requests}
      empty={<p className="text-sm text-slate-500">No requests yet. Use the <Icon name="clock" className="inline h-4 w-4" /> button on a teacher task to ask for more time.</p>}>
      {(list) => (
        <ul className="divide-y divide-slate-100">
          {list.map((r) => (
            <li key={r.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.assignment_title}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS[r.status]}`}>{r.status}</span>
              </div>
              <p className="text-slate-500">{r.classroom_name} · asked for {formatDateTime(r.requested_due)}</p>
              {r.teacher_note && <p className="mt-1 rounded bg-slate-50 p-2 text-slate-700">Teacher: {r.teacher_note}</p>}
            </li>
          ))}
        </ul>
      )}
    </QueryState>
  )
}

export default function ClassesPage() {
  const welcome = useLocation().state?.welcome
  return (
    <>
      <PageHeader title="My classes" subtitle="Classes you've joined and your extension requests" />
      {welcome && (
        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
          <p className="font-medium">Welcome to Task Orbit!</p>
          <p className="mt-1">Join your classes with the codes from your teachers, then set your study hours in Settings.</p>
        </div>
      )}
      <div className="stagger space-y-6">
        <JoinForm />
        <ClassList />
        <section className="card">
          <h2 className="mb-2 font-semibold">My extension requests</h2>
          <MyExtensions />
        </section>
      </div>
    </>
  )
}
