import { TASK_STATUSES, TASK_TYPES, labelOf, taskColour, taskSubject } from '../lib/constants'
import { daysUntil, formatDateTime, relativeDue } from '../lib/dates'
import Icon from './Icons'

const STATUS_STYLES = {
  todo: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-indigo-50 text-indigo-700',
  done: 'bg-green-50 text-green-700',
}

function Dot({ task, subjects }) {
  return (
    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: taskColour(task, subjects) }} title={taskSubject(task, subjects) ?? 'No subject'} />
  )
}

function TeacherBadge({ task }) {
  if (!task.from_teacher) return null
  const extended = task.due_date !== task.from_teacher.original_due_date
  return (
    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800"
      title={`Set by ${task.from_teacher.teacher_name}`}>
      Teacher{extended && ' · extended'}
    </span>
  )
}

function DueText({ task }) {
  if (task.status === 'done') return <span className="text-slate-400">{formatDateTime(task.due_date)}</span>
  const n = daysUntil(task.due_date)
  const tone = n < 0 ? 'text-red-700 font-medium' : n <= 2 ? 'text-amber-700' : 'text-slate-600'
  return <span title={formatDateTime(task.due_date)} className={tone}>{relativeDue(task.due_date)}</span>
}

function Actions({ task, onComplete, onEdit, onDelete, onExtend }) {
  return (
    <div className="flex justify-end gap-1">
      {task.status !== 'done' && (
        <button type="button" className="btn-ghost text-green-700 hover:bg-green-50 hover:text-green-800" onClick={() => onComplete(task)}
          aria-label={`Mark ${task.title} done`} title="Mark done">
          <Icon name="check" className="h-4 w-4" />
        </button>
      )}
      <button type="button" className="btn-ghost hover:bg-indigo-50 hover:text-indigo-700" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`} title="Edit">
        <Icon name="edit" className="h-4 w-4" />
      </button>
      {task.from_teacher ? (
        task.status !== 'done' && (
          <button type="button" className="btn-ghost text-amber-700 hover:bg-amber-50" onClick={() => onExtend(task)}
            aria-label={`Ask for more time on ${task.title}`} title="Ask for more time">
            <Icon name="clock" className="h-4 w-4" />
          </button>
        )
      ) : (
        <button type="button" className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => onDelete(task)}
          aria-label={`Delete ${task.title}`} title="Delete">
          <Icon name="trash" className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export default function TaskTable({ tasks, subjects, ...handlers }) {
  return (
    <>
      {/* Phones: cards */}
      <ul className="stagger space-y-3 md:hidden">
        {tasks.map((t) => (
          <li key={t.id} className={`card ${t.status === 'done' ? 'opacity-70' : ''}`}>
            <div className="flex items-start gap-2">
              <span className="mt-1.5"><Dot task={t} subjects={subjects} /></span>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${t.status === 'done' ? 'line-through' : ''}`}>{t.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <TeacherBadge task={t} />
                  {labelOf(TASK_TYPES, t.type)} · {t.estimated_hours} h · P{t.priority}
                  {taskSubject(t, subjects) && ` · ${taskSubject(t, subjects)}`}
                </p>
                <p className="mt-1 text-sm"><DueText task={t} /></p>
              </div>
              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status]}`}>
                {labelOf(TASK_STATUSES, t.status)}
              </span>
            </div>
            <div className="mt-2 border-t border-slate-100 pt-2"><Actions task={t} {...handlers} /></div>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-surface shadow-sm md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3 text-right">Est. h</th>
              <th className="px-4 py-3 text-center">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="stagger divide-y divide-slate-100">
            {tasks.map((t) => (
              <tr key={t.id} className={`transition-colors hover:bg-slate-50/80 ${t.status === 'done' ? 'text-slate-400' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Dot task={t} subjects={subjects} />
                    <div className="min-w-0">
                      <p className={`truncate font-medium ${t.status === 'done' ? 'line-through' : 'text-slate-900'}`}>{t.title}</p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <TeacherBadge task={t} />{taskSubject(t, subjects)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{labelOf(TASK_TYPES, t.type)}</td>
                <td className="whitespace-nowrap px-4 py-3"><DueText task={t} /></td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {t.estimated_hours}
                  {t.actual_hours != null && <span className="block text-xs text-slate-400">actual {t.actual_hours}</span>}
                </td>
                <td className="px-4 py-3 text-center tabular-nums">{t.priority}</td>
                <td className="px-4 py-3">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status]}`}>
                    {labelOf(TASK_STATUSES, t.status)}
                  </span>
                </td>
                <td className="px-4 py-3"><Actions task={t} {...handlers} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
