export const TASK_TYPES = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'practical', label: 'Practical' },
  { value: 'exam', label: 'Exam' },
  { value: 'project', label: 'Project' },
  { value: 'other', label: 'Other' },
]

export const TASK_STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

export const labelOf = (list, value) => list.find((x) => x.value === value)?.label ?? value

/** Colour for a task: its class colour if a teacher set it, otherwise the student's subject colour. */
export const taskColour = (task, subjects = {}) =>
  task.from_teacher?.colour ?? subjects[task.subject_id]?.colour ?? '#CBD5E1'

/** Label for a task's subject: class subject for teacher tasks, otherwise the student's subject. */
export const taskSubject = (task, subjects = {}) =>
  task.from_teacher?.subject_name ?? subjects[task.subject_id]?.name ?? null

/** Share of a class overloaded -> same green/amber/red language as personal load. */
export function classLevel(pct) {
  if (pct >= 0.5) return 'critical'
  if (pct >= 0.3) return 'high'
  if (pct >= 0.1) return 'medium'
  return 'low'
}

export const RISK_STYLES = {
  low: { label: 'Low risk', badge: 'bg-green-100 text-green-800' },
  medium: { label: 'Medium risk', badge: 'bg-amber-100 text-amber-800' },
  high: { label: 'High risk', badge: 'bg-red-100 text-red-800' },
}

export const SEVERITY_STYLES = {
  critical: { bar: 'border-l-red-700', badge: 'bg-red-100 text-red-800', label: 'Critical' },
  warning: { bar: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-800', label: 'Warning' },
  info: { bar: 'border-l-sky-500', badge: 'bg-sky-100 text-sky-800', label: 'Info' },
}

export const SUBJECT_COLOURS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#64748B']

/**
 * Load colour language (section 11): green < 0.7, amber 0.7-1.0, red > 1.0, dark red > 1.3.
 * A null ratio means work is due on a day with zero study hours.
 */
export function loadLevel(ratio) {
  if (ratio == null) return 'critical'
  if (ratio > 1.3) return 'critical'
  if (ratio > 1.0) return 'high'
  if (ratio >= 0.7) return 'medium'
  return 'low'
}

export const LOAD_STYLES = {
  low: { label: 'Light', badge: 'bg-green-100 text-green-800 ring-green-600/20', cell: 'bg-load-low' },
  medium: { label: 'Busy', badge: 'bg-amber-100 text-amber-800 ring-amber-600/20', cell: 'bg-load-medium' },
  high: { label: 'Overloaded', badge: 'bg-red-100 text-red-800 ring-red-600/20', cell: 'bg-load-high' },
  critical: { label: 'Severely overloaded', badge: 'bg-red-900 text-white ring-red-900/20', cell: 'bg-load-critical' },
}
