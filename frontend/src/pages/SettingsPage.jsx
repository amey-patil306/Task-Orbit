import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { errorMessage } from '../api/client'
import Icon from '../components/Icons'
import { ConfirmDialog } from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { EmptyState, QueryState } from '../components/States'
import { useAvailability, useSaveAvailability } from '../hooks/useAvailability'
import { useSubjectMutations, useSubjects } from '../hooks/useSubjects'
import { SUBJECT_COLOURS } from '../lib/constants'
import { WEEKDAYS } from '../lib/dates'

function AvailabilityForm({ rows }) {
  const save = useSaveAvailability()
  const [hours, setHours] = useState(() => rows.map((r) => String(r.hours)))
  const [saved, setSaved] = useState(false)

  useEffect(() => setHours(rows.map((r) => String(r.hours))), [rows])

  const invalid = hours.map((h) => h === '' || Number.isNaN(Number(h)) || Number(h) < 0 || Number(h) > 24)
  const total = hours.reduce((sum, h) => sum + (Number(h) || 0), 0)

  const submit = async (e) => {
    e.preventDefault()
    if (invalid.some(Boolean)) return
    setSaved(false)
    await save.mutateAsync(hours.map((h, weekday) => ({ weekday, hours: Number(h) })))
    setSaved(true)
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {WEEKDAYS.map((day, i) => (
          <div key={day}>
            <label className="label" htmlFor={`day-${i}`}>{day.slice(0, 3)}</label>
            <input id={`day-${i}`} type="number" min="0" max="24" step="0.5" inputMode="decimal"
              className={`input ${invalid[i] ? 'input-error' : ''}`} value={hours[i]}
              onChange={(e) => {
                setSaved(false)
                setHours((h) => h.map((v, j) => (j === i ? e.target.value : v)))
              }} />
          </div>
        ))}
      </div>
      {invalid.some(Boolean) && <p className="field-error mt-2">Each day needs between 0 and 24 hours.</p>}
      {save.isError && <p className="field-error mt-2">{errorMessage(save.error)}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save availability'}
        </button>
        <span className="text-sm text-slate-500">{total} hours a week</span>
        {saved && <span className="text-sm text-green-700">Saved</span>}
      </div>
    </form>
  )
}

function ColourPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
      {SUBJECT_COLOURS.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c}
          onClick={() => onChange(c)} style={{ backgroundColor: c }}
          className={`h-7 w-7 rounded-full transition ${value === c ? 'ring-2 ring-slate-900 ring-offset-2' : 'hover:scale-110'}`} />
      ))}
    </div>
  )
}

function SubjectRow({ subject, onDelete }) {
  const { update } = useSubjectMutations()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(subject.name)
  const [colour, setColour] = useState(subject.colour)

  const save = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    await update.mutateAsync({ id: subject.id, body: { name: name.trim(), colour } })
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="py-3">
        <form onSubmit={save} className="space-y-3">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Subject name" maxLength={100} />
          <ColourPicker value={colour} onChange={setColour} />
          {update.isError && <p className="field-error">{errorMessage(update.error)}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={update.isPending || !name.trim()}>Save</button>
            <button type="button" className="btn-secondary" onClick={() => { setEditing(false); setName(subject.name); setColour(subject.colour) }}>Cancel</button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: subject.colour }} />
      <span className="flex-1 font-medium">{subject.name}</span>
      <button type="button" className="btn-ghost" onClick={() => setEditing(true)} aria-label={`Edit ${subject.name}`}><Icon name="edit" className="h-4 w-4" /></button>
      <button type="button" className="btn-ghost text-red-600" onClick={() => onDelete(subject)} aria-label={`Delete ${subject.name}`}><Icon name="trash" className="h-4 w-4" /></button>
    </li>
  )
}

function SubjectsSection() {
  const subjectsQuery = useSubjects()
  const { create, remove } = useSubjectMutations()
  const [name, setName] = useState('')
  const [colour, setColour] = useState(SUBJECT_COLOURS[0])
  const [deleting, setDeleting] = useState(null)

  const add = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    await create.mutateAsync({ name: name.trim(), colour })
    setName('')
    const used = (subjectsQuery.data?.length ?? 0) + 1
    setColour(SUBJECT_COLOURS[used % SUBJECT_COLOURS.length])
  }

  return (
    <>
      <form onSubmit={add} className="space-y-3 border-b border-slate-100 pb-4">
        <div className="flex gap-2">
          <input className="input" placeholder="New subject, e.g. DBMS" value={name} maxLength={100}
            onChange={(e) => setName(e.target.value)} aria-label="New subject name" />
          <button type="submit" className="btn-primary shrink-0" disabled={create.isPending || !name.trim()}>
            <Icon name="plus" className="h-4 w-4" /> Add
          </button>
        </div>
        <ColourPicker value={colour} onChange={setColour} />
        {create.isError && <p className="field-error">{errorMessage(create.error)}</p>}
      </form>

      <QueryState query={subjectsQuery}
        empty={<div className="pt-4"><EmptyState title="No subjects yet" message="Add your subjects above to colour-code tasks." /></div>}>
        {(subjects) => (
          <ul className="divide-y divide-slate-100">
            {subjects.map((s) => <SubjectRow key={s.id} subject={s} onDelete={setDeleting} />)}
          </ul>
        )}
      </QueryState>

      <ConfirmDialog open={Boolean(deleting)} title="Delete subject?" busy={remove.isPending}
        message={`"${deleting?.name}" will be removed. Its tasks are kept but will have no subject.`}
        onConfirm={async () => { await remove.mutateAsync(deleting.id); setDeleting(null) }}
        onClose={() => setDeleting(null)} />
    </>
  )
}

export default function SettingsPage() {
  const availabilityQuery = useAvailability()
  const welcome = useLocation().state?.welcome

  return (
    <>
      <PageHeader title="Settings" subtitle="Your study time and subjects" />
      {welcome && (
        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
          <p className="font-medium">Welcome to Task Orbit!</p>
          <p className="mt-1">Start by telling us how many hours you can study each day and adding your subjects. Then add your tasks.</p>
        </div>
      )}
      <div className="space-y-6">
        <section className="card">
          <h2 className="font-semibold">Weekly availability</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">Hours you can realistically study on each day. Used to measure your load.</p>
          <QueryState query={availabilityQuery} loadingLabel="Loading availability…">
            {(rows) => <AvailabilityForm rows={rows} />}
          </QueryState>
        </section>
        <section className="card">
          <h2 className="font-semibold">Subjects</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">Used to colour and group your tasks.</p>
          <SubjectsSection />
        </section>
      </div>
    </>
  )
}
