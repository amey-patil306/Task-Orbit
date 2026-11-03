import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teacherApi } from '../api/teacher'

// Every teacher query key starts with 'teacher', so one invalidation refreshes all of them.
export const useTeacherOverview = () => useQuery({ queryKey: ['teacher', 'overview'], queryFn: teacherApi.overview })
export const useTeacherClassrooms = () => useQuery({ queryKey: ['teacher', 'classrooms'], queryFn: teacherApi.classrooms })
export const useClassroom = (id) => useQuery({ queryKey: ['teacher', 'classroom', id], queryFn: () => teacherApi.classroom(id) })
export const useClassAnalytics = (id) => useQuery({ queryKey: ['teacher', 'analytics', id], queryFn: () => teacherApi.analytics(id) })
export const useAssignment = (id) => useQuery({ queryKey: ['teacher', 'assignment', id], queryFn: () => teacherApi.assignment(id) })
export const useExtensionInbox = (status) =>
  useQuery({ queryKey: ['teacher', 'extensions', status ?? 'all'], queryFn: () => teacherApi.extensions(status) })

/** Any teacher write refreshes all teacher data (it's small, so this keeps things simple). */
export function useTeacherMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teacher'] }),
  })
}
