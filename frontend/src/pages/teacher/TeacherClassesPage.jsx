import { useState } from 'react'
import { Link } from 'react-router-dom'
import { teacherApi } from '../../api/teacher'
import { errorMessage } from '../../api/client'
import Icon from '../../components/Icons'
import Modal from '../../components/Modal'
import PageHeader from '../../components/PageHeader'
import { EmptyState, QueryState } from '../../components/States'
import { useTeacherClassrooms, useTeacherMutation } from '../../hooks/useTeacher'
import { SUBJECT_COLOURS } from '../../lib/constants'

export function ClassFormModal({ open, classroom, onClose, onSaved }) {
  const create = useTeacherMutation(teacherApi.createClassroom)
  const update = useTeacherMutation(({ id, body }) => teacherApi.updateClassroom(id, body))
  const [subject, setSubject] = useState(classroom?.subject_name ?? '')
  const [name, setName] = useState(classroom?.name ?? '')
  const [colour, setColour] = useState(classroom?.colour ?? SUBJECT_COLOURS[0])
  const [error, setError] = useState(null)
  const busy = create.isPending || update.isPending

  const submit = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !name.trim()) {
      setError('Enter the subject and the class name.')
      return
    }
    try {
      const body = { subject_name: subject.trim(), name: name.trim(), colour }
      const saved = classroom ? await update.mutateAsync({ id: classroom.id, body }) : await create.mutateAsync(body)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal open={open} title={classroom ? 'Edit class' : 'New class'} onClose={onClose} size="max-w-md"
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="class-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : classroom ? 'Save' : 'Create class'}</button>
      </>}>
      <form id="class-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div>
          <label className="label" htmlFor="c-subject">Subject</label>
          <input id="c-subject" className="input" placeholder="e.g. DBMS" maxLength={100} value={subject}
            onChange={(e) => {
              const v = e.target.value
              if (!classroom && (!name || name.startsWith(subject))) setName(v ? `${v} - ` : '')
              setSubject(v)
            }} />
        </div>
        <div>
          <label className="label" htmlFor="c-name">Class name</label>
          <input id="c-name" className="input" placeholder="e.g. DBMS - SE ECE A" maxLength={120} value={name}
            onChange={(e) => setName(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Include year and division so students pick the right one.</p>
        </div>
        <div>
          <span className="label">Colour</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
            {SUBJECT_COLOURS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={colour === c} aria-label={c}
                onClick={() => setColour(c)} style={{ backgroundColor: c }}
                className={`h-7 w-7 rounded-full ${colour === c ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`} />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  )
}

export function JoinCode({ code }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked: the code is visible anyway */ }
  }
  return (
    <button type="button" onClick={copy} title="Copy class code"
      className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 font-mono text-sm tracking-widest hover:border-indigo-400">
      {code} <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4 text-slate-400" />
    </button>
  )
}

export default function TeacherClassesPage() {
  const classes = useTeacherClassrooms()
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(null)
  const newButton = (
    <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
      <Icon name="plus" className="h-4 w-4" /> New class
    </button>
  )

  return (
    <>
      <PageHeader title="Classes" subtitle="Share a class code; students who join get your assignments automatically" actions={newButton} />
      {created && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <span>Created <b>{created.name}</b>. Share this code with your students:</span>
          <JoinCode code={created.join_code} />
        </div>
      )}
      <QueryState query={classes} loadingLabel="Loading classes…"
        empty={<EmptyState title="No classes yet" message="Create a class for each subject and division you teach." action={newButton} />}>
        {(list) => (
          <ul className="grid gap-4 sm:grid-cols-2">
            {list.map((c) => (
              <li key={c.id}>
                <Link to={`/teacher/classes/${c.id}`} className="card block transition hover:border-indigo-300 hover:shadow">
                  <div className="flex items-start gap-3">
                    <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.colour }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-sm text-slate-500">{c.students_count} students · {c.assignments_count} assignments</p>
                    </div>
                    <span className="font-mono text-sm tracking-widest text-slate-500">{c.join_code}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      {creating && <ClassFormModal open onClose={() => setCreating(false)} onSaved={setCreated} />}
    </>
  )
}
