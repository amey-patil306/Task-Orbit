import { useEffect, useState } from 'react'
import { errorMessage, fieldErrors } from '../api/client'
import { useRequestExtension } from '../hooks/useClassrooms'
import { formatDateTime, fromIstInput, toIstInput } from '../lib/dates'
import Modal from './Modal'
import { useToast } from './Toast'

/** Student asks the teacher for more time; the server attaches workload evidence automatically. */
export default function ExtensionDialog({ task, onClose }) {
  const request = useRequestExtension()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [due, setDue] = useState('')
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!task) return
    // Suggest two extra days at the same time of day.
    const d = new Date(new Date(task.due_date).getTime() + 2 * 86400000)
    setDue(toIstInput(d.toISOString()))
    setReason('')
    setErrors({})
    setSent(false)
  }, [task])

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (reason.trim().length < 5) errs.reason = 'Tell your teacher briefly why you need more time.'
    if (!due) errs.requested_due = 'Pick a new date.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      await request.mutateAsync({ taskId: task.id, body: { reason: reason.trim(), requested_due: fromIstInput(due) } })
      setSent(true)
      toast('Extension request sent', { description: `To ${task.from_teacher?.teacher_name}` })
    } catch (err) {
      const f = fieldErrors(err)
      setErrors(Object.keys(f).length ? f : { root: errorMessage(err) })
    }
  }

  return (
    <Modal open={Boolean(task)} title="Ask for more time" onClose={onClose} size="max-w-md"
      footer={sent
        ? <button type="button" className="btn-primary" onClick={onClose}>Done</button>
        : (
          <>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" form="extension-form" className="btn-primary" disabled={request.isPending}>
              {request.isPending ? 'Sending…' : 'Send request'}
            </button>
          </>
        )}>
      {sent ? (
        <div className="text-sm text-slate-700">
          <p className="font-medium text-green-700">Request sent to {task?.from_teacher?.teacher_name}.</p>
          <p className="mt-2">Your current workload was attached as evidence. You'll get an alert when they decide.
            Until then, plan for the current deadline.</p>
        </div>
      ) : (
        <form id="extension-form" onSubmit={submit} className="space-y-4" noValidate>
          {errors.root && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errors.root}</p>}
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-medium">{task?.title}</p>
            <p className="text-slate-500">{task?.from_teacher?.classroom_name} · due {formatDateTime(task?.due_date)}</p>
          </div>
          <div>
            <label className="label" htmlFor="requested_due">New due date (IST)</label>
            <input id="requested_due" type="datetime-local" className={`input ${errors.requested_due ? 'input-error' : ''}`}
              value={due} onChange={(e) => setDue(e.target.value)} />
            {errors.requested_due && <p className="field-error">{errors.requested_due}</p>}
          </div>
          <div>
            <label className="label" htmlFor="reason">Reason</label>
            <textarea id="reason" rows={3} maxLength={1000} className={`input ${errors.reason ? 'input-error' : ''}`}
              placeholder="e.g. CN unit test and two practicals fall in the same three days."
              value={reason} onChange={(e) => setReason(e.target.value)} />
            {errors.reason && <p className="field-error">{errors.reason}</p>}
          </div>
          <p className="text-xs text-slate-500">
            Task Orbit attaches your workload (hours needed vs free, overloaded days, clashing deadlines) so your
            teacher can decide fairly.
          </p>
        </form>
      )}
    </Modal>
  )
}
