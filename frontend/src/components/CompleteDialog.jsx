import { useEffect, useState } from 'react'
import { errorMessage } from '../api/client'
import Modal from './Modal'

/** Marking a task done asks how long it really took: actual_hours is the ML target. */
export default function CompleteDialog({ task, busy, onConfirm, onClose }) {
  const [hours, setHours] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    setHours(task ? String(task.estimated_hours) : '')
    setError(null)
  }, [task])

  const submit = async (e) => {
    e.preventDefault()
    const value = Number(hours)
    if (!(value > 0 && value <= 500)) {
      setError('Enter the hours you actually spent (more than 0).')
      return
    }
    try {
      await onConfirm(value)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal open={Boolean(task)} title="Mark as done" onClose={onClose} size="max-w-sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="complete-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Mark done'}
          </button>
        </>
      }>
      <form id="complete-form" onSubmit={submit} noValidate>
        <p className="text-sm text-slate-600">
          How many hours did <span className="font-medium text-slate-900">{task?.title}</span> really take?
          You estimated {task?.estimated_hours} h. Honest numbers make your forecasts better.
        </p>
        <label className="label mt-4" htmlFor="actual_hours">Actual hours</label>
        <input id="actual_hours" type="number" step="0.5" min="0.5" inputMode="decimal"
          className={`input ${error ? 'input-error' : ''}`} value={hours} onChange={(e) => setHours(e.target.value)} />
        {error && <p className="field-error">{error}</p>}
      </form>
    </Modal>
  )
}
