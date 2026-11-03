import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { errorMessage, fieldErrors } from '../api/client'
import { TASK_STATUSES, TASK_TYPES } from '../lib/constants'
import { fromIstInput, toIstInput } from '../lib/dates'

const LEVELS = [1, 2, 3, 4, 5]

function toFormValues(task) {
  return {
    title: task?.title ?? '',
    type: task?.type ?? 'assignment',
    subject_id: task?.subject_id ?? '',
    difficulty: task?.difficulty ?? 3,
    priority: task?.priority ?? 3,
    estimated_hours: task?.estimated_hours ?? '',
    due_date: toIstInput(task?.due_date),
    start_date: task?.start_date ?? '',
    status: task?.status ?? 'todo',
    description: task?.description ?? '',
  }
}

function toBody(v, isEdit) {
  const body = {
    title: v.title.trim(),
    type: v.type,
    subject_id: v.subject_id === '' ? null : Number(v.subject_id),
    difficulty: Number(v.difficulty),
    priority: Number(v.priority),
    estimated_hours: Number(v.estimated_hours),
    due_date: fromIstInput(v.due_date),
    start_date: v.start_date || null,
    description: v.description.trim() || null,
  }
  if (isEdit) body.status = v.status
  return body
}

/**
 * Add/edit task form. `onSubmit(body)` must return a promise; server validation
 * errors are mapped back onto the matching fields.
 */
export default function TaskForm({ id = 'task-form', task, subjects, onSubmit }) {
  const isEdit = Boolean(task)
  const {
    register, handleSubmit, reset, setError, watch,
    formState: { errors },
  } = useForm({ defaultValues: toFormValues(task) })

  useEffect(() => reset(toFormValues(task)), [task, reset])

  const submit = async (values) => {
    try {
      await onSubmit(toBody(values, isEdit))
    } catch (err) {
      const fields = fieldErrors(err)
      const known = Object.keys(toFormValues())
      let mapped = false
      for (const [name, message] of Object.entries(fields)) {
        if (known.includes(name)) {
          setError(name, { message })
          mapped = true
        }
      }
      if (!mapped) setError('root', { message: errorMessage(err) })
    }
  }

  const startDate = watch('start_date')
  const cls = (name) => `input ${errors[name] ? 'input-error' : ''}`

  return (
    <form id={id} onSubmit={handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2" noValidate>
      {errors.root && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{errors.root.message}</p>}

      <div className="sm:col-span-2">
        <label className="label" htmlFor="title">Title</label>
        <input id="title" className={cls('title')} placeholder="e.g. DBMS assignment 3"
          {...register('title', { required: 'Give the task a title', maxLength: { value: 200, message: 'Keep it under 200 characters' } })} />
        {errors.title && <p className="field-error">{errors.title.message}</p>}
      </div>

      <div>
        <label className="label" htmlFor="type">Type</label>
        <select id="type" className={cls('type')} {...register('type')}>
          {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="subject_id">Subject</label>
        <select id="subject_id" className={cls('subject_id')} {...register('subject_id')}>
          <option value="">No subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {errors.subject_id && <p className="field-error">{errors.subject_id.message}</p>}
      </div>

      <div>
        <label className="label" htmlFor="due_date">Due (IST)</label>
        <input id="due_date" type="datetime-local" className={cls('due_date')}
          {...register('due_date', { required: 'Pick a due date and time' })} />
        {errors.due_date && <p className="field-error">{errors.due_date.message}</p>}
      </div>

      <div>
        <label className="label" htmlFor="estimated_hours">Estimated hours</label>
        <input id="estimated_hours" type="number" step="0.5" min="0.5" inputMode="decimal" className={cls('estimated_hours')}
          {...register('estimated_hours', {
            required: 'How long will it take?',
            validate: (v) => (Number(v) > 0 && Number(v) <= 500) || 'Enter between 0.5 and 500 hours',
          })} />
        {errors.estimated_hours && <p className="field-error">{errors.estimated_hours.message}</p>}
      </div>

      <div>
        <label className="label" htmlFor="difficulty">Difficulty</label>
        <select id="difficulty" className={cls('difficulty')} {...register('difficulty')}>
          {LEVELS.map((n) => <option key={n} value={n}>{n}{n === 1 ? ' – easy' : n === 5 ? ' – very hard' : ''}</option>)}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="priority">Priority</label>
        <select id="priority" className={cls('priority')} {...register('priority')}>
          {LEVELS.map((n) => <option key={n} value={n}>{n}{n === 1 ? ' – low' : n === 5 ? ' – urgent' : ''}</option>)}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="start_date">Start date <span className="font-normal text-slate-400">(optional)</span></label>
        <input id="start_date" type="date" className={cls('start_date')}
          {...register('start_date', {
            validate: (v, all) => !v || !all.due_date || v <= all.due_date.slice(0, 10) || 'Start must be on or before the due date',
          })} />
        {errors.start_date && <p className="field-error">{errors.start_date.message}</p>}
        {!errors.start_date && !startDate && <p className="mt-1 text-xs text-slate-500">Leave empty to start today.</p>}
      </div>

      {isEdit && (
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" className={cls('status')} {...register('status')}>
            {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      )}

      <div className="sm:col-span-2">
        <label className="label" htmlFor="description">Notes <span className="font-normal text-slate-400">(optional)</span></label>
        <textarea id="description" rows={3} className={cls('description')} {...register('description')} />
      </div>
    </form>
  )
}
