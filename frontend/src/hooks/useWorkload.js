import { useQuery } from '@tanstack/react-query'
import { workloadApi } from '../api/workload'
import { addDays, istToday } from '../lib/dates'

/** Daily load for `days` days starting today (IST). */
export function useWorkload(days = 14) {
  const from = istToday()
  const to = addDays(from, days - 1)
  return useQuery({ queryKey: ['workload', from, to], queryFn: () => workloadApi.get(from, to) })
}

export function useConflicts() {
  return useQuery({ queryKey: ['workload', 'conflicts'], queryFn: workloadApi.conflicts })
}

/** 7-day overload forecast (ML when available, otherwise rules). */
export function usePredict() {
  return useQuery({ queryKey: ['predict'], queryFn: workloadApi.predict })
}
