import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'

// After any task mutation, these all go stale (section 11).
const TASK_DEPENDENT_KEYS = ['tasks', 'workload', 'predict', 'plan', 'alerts']

export function useTasks(filters = {}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => tasksApi.list(filters),
  })
}

export function useTaskMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => TASK_DEPENDENT_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
  const opts = { onSuccess: invalidate }

  return {
    create: useMutation({ mutationFn: tasksApi.create, ...opts }),
    update: useMutation({ mutationFn: ({ id, body }) => tasksApi.update(id, body), ...opts }),
    complete: useMutation({ mutationFn: ({ id, actualHours }) => tasksApi.complete(id, actualHours), ...opts }),
    remove: useMutation({ mutationFn: tasksApi.remove, ...opts }),
  }
}
