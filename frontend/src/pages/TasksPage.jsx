import { useState } from 'react'
import { errorMessage } from '../api/client'
import CompleteDialog from '../components/CompleteDialog'
import ExtensionDialog from '../components/ExtensionDialog'
import Icon from '../components/Icons'
import Modal, { ConfirmDialog } from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { EmptyState, QueryState } from '../components/States'
import TaskForm from '../components/TaskForm'
import TaskTable from '../components/TaskTable'
import { celebrate, useToast } from '../components/Toast'
import { useSubjects } from '../hooks/useSubjects'
import { useTaskMutations, useTasks } from '../hooks/useTasks'
import { TASK_STATUSES, TASK_TYPES } from '../lib/constants'
import { formatDay } from '../lib/dates'

const NO_FILTERS = { status: '', type: '', subject_id: '' }

/** After a create/edit the API returns a fresh 7-day workload summary; surface it. */
function SummaryNotice({ summary, onClose }) {
  if (!summary) return null
  const overloaded = summary.days.filter((d) => d.rule_label === 'high')
  const good = overloaded.length === 0
  return (
    <div role="status" className={`mb-4 flex items-start justify-between gap-3 rounded-xl border p-4 text-sm ${
      good ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
      <p>
        {good
          ? 'Saved. Your next 7 days still fit in your available study time.'
          : `Saved. Heads up: ${overloaded.length} of the next 7 days ${overloaded.length === 1 ? 'is' : 'are'} overloaded (${overloaded
              .map((d) => formatDay(d.date)).join(', ')}).`}
      </p>
      <button type="button" className="btn-ghost -m-1" onClick={onClose} aria-label="Dismiss"><Icon name="x" className="h-4 w-4" /></button>
    </div>
  )
}

export default function TasksPage() {
  const [filters, setFilters] = useState(NO_FILTERS)
  const [editing, setEditing] = useState(null) // null = closed, {} = new, task = edit
  const [completing, setCompleting] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [extending, setExtending] = useState(null)
  const [summary, setSummary] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const tasksQuery = useTasks(filters)
  const subjectsQuery = useSubjects()
  const subjects = subjectsQuery.data ?? []
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]))
  const { create, update, complete, remove } = useTaskMutations()
  const toast = useToast()

  const isNew = editing && !editing.id
  const hasFilters = Object.values(filters).some(Boolean)
  const setFilter = (name) => (e) => setFilters((f) => ({ ...f, [name]: e.target.value }))

  const saveTask = async (body) => {
    const result = isNew ? await create.mutateAsync(body) : await update.mutateAsync({ id: editing.id, body })
    setSummary(result.workload_summary)
    setEditing(null)
    toast(isNew ? 'Task added' : 'Changes saved', { description: body.title ?? editing.title })
  }

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(deleting.id)
      toast('Task deleted', { tone: 'info', description: deleting.title })
      setDeleting(null)
      setDeleteError(null)
    } catch (err) {
      setDeleteError(errorMessage(err))
    }
  }

  const addButton = (
    <button type="button" className="btn-primary" onClick={() => setEditing({})}>
      <Icon name="plus" className="h-4 w-4" /> Add task
    </button>
  )

  return (
    <>
      <PageHeader title="Tasks" subtitle="Work from your teachers plus your own tasks" actions={addButton} />
      <SummaryNotice summary={summary} onClose={() => setSummary(null)} />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <select aria-label="Filter by status" className="input sm:w-40" value={filters.status} onChange={setFilter('status')}>
          <option value="">All statuses</option>
          {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select aria-label="Filter by type" className="input sm:w-40" value={filters.type} onChange={setFilter('type')}>
          <option value="">All types</option>
          {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select aria-label="Filter by subject" className="input sm:w-48" value={filters.subject_id} onChange={setFilter('subject_id')}>
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {hasFilters && (
          <button type="button" className="btn-ghost text-sm" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>
        )}
      </div>

      <QueryState query={tasksQuery} loadingLabel="Loading tasks…"
        empty={hasFilters
          ? <EmptyState title="No tasks match these filters" action={<button type="button" className="btn-secondary" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>} />
          : <EmptyState title="No tasks yet" message="Add your upcoming assignments, practicals and exams to see your workload." action={addButton} />}>
        {(tasks) => (
          <TaskTable tasks={tasks} subjects={subjectMap}
            onEdit={setEditing} onComplete={setCompleting} onExtend={setExtending} onDelete={(t) => { setDeleteError(null); setDeleting(t) }} />
        )}
      </QueryState>

      <Modal open={Boolean(editing)} title={isNew ? 'Add task' : 'Edit task'} onClose={() => setEditing(null)} size="max-w-2xl"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" form="task-form" className="btn-primary" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? 'Saving…' : isNew ? 'Add task' : 'Save changes'}
            </button>
          </>
        }>
        {editing && <TaskForm task={isNew ? null : editing} subjects={subjects} onSubmit={saveTask} />}
      </Modal>

      <CompleteDialog task={completing} busy={complete.isPending} onClose={() => setCompleting(null)}
        onConfirm={async (hours) => {
          await complete.mutateAsync({ id: completing.id, actualHours: hours })
          celebrate()
          toast('Nice work! One less thing in orbit.', { description: `${completing.title} · ${hours} h logged` })
          setCompleting(null)
        }} />

      <ExtensionDialog task={extending} onClose={() => setExtending(null)} />

      <ConfirmDialog open={Boolean(deleting)} title="Delete task?" busy={remove.isPending}
        message={deleteError ?? `"${deleting?.title}" and its planned study sessions will be removed. This cannot be undone.`}
        onConfirm={confirmDelete} onClose={() => setDeleting(null)} />
    </>
  )
}
