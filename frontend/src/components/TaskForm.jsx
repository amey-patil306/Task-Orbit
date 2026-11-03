import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { errorMessage, fieldErrors } from '../api/client'
import { TASK_STATUSES, TASK_TYPES } from '../lib/constants'
import { formatDateTime, fromIstInput, toIstInput } from '../lib/dates'
import { useTaskInsight } from '../hooks/useClassrooms'

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

function toBody(v, isEdit, locked) {
  if (locked) {
    // Teacher tasks: only the student's own planning fields can change.
    return {
      priority: Number(v.priority),
      estimated_hours: Number(v.estimated_hours),
      start_date: v.start_date || null,
      description: v.description.trim() || null,
      status: v.status,
    }
  }
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
/** Read-only details of a task set by a teacher, plus what classmates really spent on it. */
function TeacherTaskInfo({ task }) {
  const insight = useTaskInsight(task.id)
  const t = task.from_teacher
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm sm:col-span-2">
      <p className="font-semibold text-emerald-900">{task.title}</p>
      <p className="mt-0.5 text-emerald-800">{t.classroom_name} � set by {t.teacher_name}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700">
        <dt className="text-slate-500">Type</dt><dd className="capitalize">{task.type}</dd>
        <dt className="text-slate-500">Difficulty</dt><dd>{task.difficulty} / 5</dd>
        <dt className="text-slate-500">Due</dt><dd>{formatDateTime(task.due_date)}</dd>
        <dt className="text-slate-500">Teacher expects</dt><dd>{t.expected_hours} h</dd>
        {insight.data?.avg_actual_hours != null && (
          <>
            <dt className="text-slate-500">Classmates took</dt>
            <dd className="font-medium text-emerald-900">{insight.data.avg_actual_hours} h on average ({insight.data.completed} done)</dd>
          </>
        )}
      </dl>
    </div>
  )
}

export default function TaskForm({ id = 'task-form', task, subjects, onSubmit }) {
  const isEdit = Boolean(task)
  const locked = Boolean(task?.from_teacher)
  const {
    register, handleSubmit, reset, setError, watch,
    formState: { errors },
  } = useForm({ defaultValues: toFormValues(task) })

  useEffect(() => reset(toFormValues(task)), [task, reset])

  const submit = async (values) => {
    try {
      await onSubmit(toBody(values, isEdit, locked))
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

      {locked ? <TeacherTaskInfo task={task} /> : (
        <>
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

        </>
      )}

      <div>
        <label className="label" htmlFor="estimated_hours">{locked ? 'My estimate (hours)' : 'Estimated hours'}</label>
        <input id="estimated_hours" type="number" step="0.5" min="0.5" inputMode="decimal" className={cls('estimated_hours')}
          {...register('estimated_hours', {
            required: 'How long will it take?',
            validate: (v) => (Number(v) > 0 && Number(v) <= 500) || 'Enter between 0.5 and 500 hours',
          })} />
        {errors.estimated_hours && <p className="field-error">{errors.estimated_hours.message}</p>}
      </div>

      {!locked && (
        <>
      <div>
        <label className="label" htmlFor="difficulty">Difficulty</label>
        <select id="difficulty" className={cls('difficulty')} {...register('difficulty')}>
          {LEVELS.map((n) => <option key={n} value={n}>{n}{n === 1 ? ' – easy' : n === 5 ? ' – very hard' : ''}</option>)}
        </select>
      </div>

        </>
      )}

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
            validate: (v, all) => {
              const due = locked ? toIstInput(task.due_date) : all.due_date
              return !v || !due || v <= due.slice(0, 10) || 'Start must be on or before the due date'
            },
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
