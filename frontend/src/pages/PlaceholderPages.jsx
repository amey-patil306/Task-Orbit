import ComingSoon from '../components/ComingSoon'

export function CalendarPage() {
  return (
    <ComingSoon title="Calendar" subtitle="Month and week views of your deadlines"
      features={['FullCalendar month and week views', 'Tasks coloured by subject', 'Red border on days with deadline collisions']}
      needs={['GET /api/workload/conflicts']} />
  )
}

export function WorkloadPage() {
  return (
    <ComingSoon title="Workload" subtitle="How heavy each day is"
      features={['4-week heatmap coloured by load ratio', 'Required vs available hours per day', 'Rule label vs ML label per day']}
      needs={['GET /api/workload', 'POST /api/predict']} />
  )
}

export function PlannerPage() {
  return (
    <ComingSoon title="Planner" subtitle="A study schedule that fits your week"
      features={['Study sessions grouped by day', 'Regenerate plan button', 'Tick sessions done', 'Unscheduled tasks with suggestions']}
      needs={['POST /api/plan/generate', 'GET /api/plan', 'PATCH /api/plan/<id>']} />
  )
}

export function AlertsPage() {
  return (
    <ComingSoon title="Alerts" subtitle="Overload, collision and deadline warnings"
      features={['Alerts coloured by severity', 'Mark as read', 'Unread filter']}
      needs={['GET /api/alerts', 'PATCH /api/alerts/<id>/read']} />
  )
}
