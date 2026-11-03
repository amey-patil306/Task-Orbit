import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { classroomsApi } from '../api/classrooms'

// Joining/leaving a class or an extension decision changes tasks and everything computed from them.
const TASK_KEYS = ['tasks', 'workload', 'predict', 'plan', 'alerts']

export const useMyClassrooms = () => useQuery({ queryKey: ['classrooms'], queryFn: classroomsApi.mine })
export const useMyExtensions = () => useQuery({ queryKey: ['extensions'], queryFn: classroomsApi.myExtensions })
export const useCheckins = () => useQuery({ queryKey: ['checkins'], queryFn: classroomsApi.checkins })
export const useTaskInsight = (taskId, enabled = true) =>
  useQuery({ queryKey: ['task-insight', taskId], queryFn: () => classroomsApi.taskInsight(taskId), enabled: Boolean(taskId) && enabled })

function useInvalidating(mutationFn, keys) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  })
}

export const useJoinClass = () => useInvalidating(classroomsApi.join, ['classrooms', ...TASK_KEYS])
export const useLeaveClass = () => useInvalidating(classroomsApi.leave, ['classrooms', ...TASK_KEYS])
export const useRequestExtension = () =>
  useInvalidating(({ taskId, body }) => classroomsApi.requestExtension(taskId, body), ['extensions'])
export const useSaveCheckin = () => useInvalidating(classroomsApi.saveCheckin, ['checkins'])
