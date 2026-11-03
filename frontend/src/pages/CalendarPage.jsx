import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { QueryState } from '../components/States'
import { useSubjectMap } from '../hooks/useSubjects'
import { useTasks } from '../hooks/useTasks'
import { useConflicts } from '../hooks/useWorkload'
import { taskColour } from '../lib/constants'
import { toIstInput } from '../lib/dates'

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function CalendarPage() {
  const tasks = useTasks()
  const conflicts = useConflicts()
  const subjects = useSubjectMap()
  const navigate = useNavigate()
  const isPhone = typeof window !== 'undefined' && window.innerWidth < 640

  const conflictDays = useMemo(() => new Set((conflicts.data ?? []).map((c) => c.date)), [conflicts.data])

  return (
    <>
      <PageHeader title="Calendar" subtitle="Deadlines by subject · red border = deadlines clash that day" />
      <QueryState query={tasks} loadingLabel="Loading calendar…" isEmpty={() => false}>
        {(list) => {
          // Due dates are shown as IST wall-clock times (students are in India).
          const events = list.map((t) => ({
            id: String(t.id),
            title: t.title,
            start: toIstInput(t.due_date),
            backgroundColor: t.status === 'done' ? '#cbd5e1' : taskColour(t, subjects),
            borderColor: 'transparent',
            textColor: '#fff',
            classNames: t.status === 'done' ? ['line-through'] : [],
          }))
          return (
            <div className="card overflow-hidden p-2 sm:p-4">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin]}
                initialView="dayGridMonth"
                headerToolbar={isPhone
                  ? { left: 'prev,next', center: 'title', right: 'today' }
                  : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
                buttonText={{ today: 'Today', month: 'Month', week: 'Week' }}
                firstDay={1}
                height="auto"
                dayMaxEvents={3}
                eventDisplay="block"
                eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
                events={events}
                dayCellClassNames={(arg) => (conflictDays.has(ymd(arg.date)) ? ['fc-conflict-day'] : [])}
                eventClick={() => navigate('/tasks')}
              />
            </div>
          )
        }}
      </QueryState>
    </>
  )
}
