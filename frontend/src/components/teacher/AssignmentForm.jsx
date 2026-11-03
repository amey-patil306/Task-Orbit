import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { errorMessage, fieldErrors } from '../../api/client'
import { teacherApi } from '../../api/teacher'
import { TASK_TYPES } from '../../lib/constants'
import { formatDay, fromIstInput, toIstInput } from '../../lib/dates'

const VERDICT = {
  good: { title: 'Good date', cls: 'border-green-200 bg-green-50 text-green-900' },
  risky: { title: 'Risky date', cls: 'border-amber-200 bg-amber-50 text-amber-900' },
  bad: { title: 'Heavy date for this class', cls: 'border-red-200 bg-red-50 text-red-900' },
}

function toValues(a) {
  return {
    title: a?.title ?? '',
    type: a?.type ?? 'assignment',
    difficulty: a?.difficulty ?? 3,
    expected_hours: a?.expected_hours ?? '',
    due_date: toIstInput(a?.due_date),
    start_date: a?.start_date ?? '',
    description: a?.description ?? '',
  }
}

/** Debounced call to the Smart Deadline Advisor whenever hours / dates change. */
function useAdvice(classId, hours, due, start, excludeId) {
  const [state, setState] = useState({ loading: false, data: null, error: null })
  useEffect(() => {
    if (!(Number(hours) > 0) || !due) {
      setState({ loading: false, data: null, error: null })
      return undefined
    }
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    const timer = setTimeout(async () => {
      try {
        const data = await teacherApi.deadlineCheck(classId, {
          expected_hours: Number(hours), due_date: fromIstInput(due), start_date: start || null,
          exclude_assignment_id: excludeId ?? null,
        })
        if (!cancelled) setState({ loading: false, data, error: null })
      } catch (error) {
        if (!cancelled) setState({ loading: false, data: null, error })
      }
    }, 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [classId, hours, due, start, excludeId])
  return state
}

function DeadlineAdvisor({ advice, onPick }) {
  if (advice.error) return <p className="text-sm text-red-600">{errorMessage(advice.error)}</p>
  if (!advice.data) {
    return <p className="text-sm text-slate-500">{advice.loading ? 'Checking the class workload…' : 'Enter expected hours and a due date to check the class workload.'}</p>
  }
  const { proposed, alternatives, students, message } = advice.data
  if (!proposed) return <p className="text-sm text-slate-500">{message}</p>
  const v = VERDICT[proposed.verdict]
  return (
    <div className={`space-y-3 transition-opacity ${advice.loading ? 'opacity-60' : ''}`}>
      <div className={`rounded-lg border p-3 ${v.cls}`}>
        <p className="font-semibold">{v.title}: {formatDay(proposed.date)}</p>
        <p className="mt-1 text-sm">
          {Math.round(proposed.pct_overloaded * 100)}% of {students} students would be overloaded while working on this.
        </p>
        {proposed.clashes.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {proposed.clashes.map((c) => (
              <li key={c.assignment_id}>⚠ Also due that day: <b>{c.title}</b> ({c.classroom}, {c.students} students)</li>
            ))}
          </ul>
        )}
      </div>
      {alternatives.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Better dates</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {alternatives.map((a) => (
              <button key={a.date} type="button" onClick={() => onPick(a.date)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-indigo-400 hover:bg-indigo-50">
                <span className="block font-medium">{formatDay(a.date)}</span>
                <span className="block text-xs text-slate-500">
                  {Math.round(a.pct_overloaded * 100)}% overloaded{a.clashes.length ? ` · ${a.clashes.length} clash` : ' · no clashes'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Create / edit an assignment with the live Smart Deadline Advisor beside it.
 * `onSubmit(body)` returns a promise; server field errors are shown on the fields.
 */
export default function AssignmentForm({ id = 'assignment-form', classId, assignment, onSubmit }) {
  const { register, handleSubmit, watch, setValue, setError, reset, formState: { errors } } = useForm({
    defaultValues: toValues(assignment),
  })
  useEffect(() => reset(toValues(assignment)), [assignment, reset])

  const [hours, due, start] = watch(['expected_hours', 'due_date', 'start_date'])
  const advice = useAdvice(classId, hours, due, start, assignment?.id)

  const pickDate = (ymd) => setValue('due_date', `${ymd}T${(due || 'T23:00').split('T')[1] || '23:00'}`, { shouldDirty: true })

  const submit = async (v) => {
    try {
      await onSubmit({
        title: v.title.trim(),
        type: v.type,
        difficulty: Number(v.difficulty),
        expected_hours: Number(v.expected_hours),
        due_date: fromIstInput(v.due_date),
        start_date: v.start_date || null,
        description: v.description.trim() || null,
      })
    } catch (err) {
      const fields = fieldErrors(err)
      let mapped = false
      for (const [name, message] of Object.entries(fields)) {
        if (name in toValues()) { setError(name, { message }); mapped = true }
      }
      if (!mapped) setError('root', { message: errorMessage(err) })
    }
  }
  const cls = (n) => `input ${errors[n] ? 'input-error' : ''}`

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form id={id} onSubmit={handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2 lg:col-span-3" noValidate>
        {errors.root && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{errors.root.message}</p>}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="a-title">Title</label>
          <input id="a-title" className={cls('title')} placeholder="e.g. Normalization assignment"
            {...register('title', { required: 'Give it a title' })} />
          {errors.title && <p className="field-error">{errors.title.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="a-type">Type</label>
          <select id="a-type" className={cls('type')} {...register('type')}>
            {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="a-difficulty">Difficulty</label>
          <select id="a-difficulty" className={cls('difficulty')} {...register('difficulty')}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}{n === 1 ? ' – easy' : n === 5 ? ' – very hard' : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="a-hours">Expected hours of work</label>
          <input id="a-hours" type="number" step="0.5" min="0.5" inputMode="decimal" className={cls('expected_hours')}
            {...register('expected_hours', { validate: (v) => (Number(v) > 0 && Number(v) <= 200) || 'Between 0.5 and 200 hours' })} />
          {errors.expected_hours && <p className="field-error">{errors.expected_hours.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="a-due">Due (IST)</label>
          <input id="a-due" type="datetime-local" className={cls('due_date')}
            {...register('due_date', { required: 'Pick a due date' })} />
          {errors.due_date && <p className="field-error">{errors.due_date.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="a-start">Students can start <span className="font-normal text-slate-400">(optional)</span></label>
          <input id="a-start" type="date" className={cls('start_date')} {...register('start_date')} />
          {errors.start_date && <p className="field-error">{errors.start_date.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="a-desc">Instructions <span className="font-normal text-slate-400">(optional)</span></label>
          <textarea id="a-desc" rows={3} className={cls('description')} {...register('description')} />
        </div>
      </form>

      <aside className="lg:col-span-2">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-900">
            <span aria-hidden="true">✦</span> Smart Deadline Advisor
          </p>
          <DeadlineAdvisor advice={advice} onPick={pickDate} />
        </div>
      </aside>
    </div>
  )
}
