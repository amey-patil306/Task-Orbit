import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subjectsApi } from '../api/subjects'

export function useSubjects() {
  return useQuery({ queryKey: ['subjects'], queryFn: subjectsApi.list, staleTime: 60_000 })
}

/** Map of subject id -> subject, handy for colouring tasks. */
export function useSubjectMap() {
  const { data = [] } = useSubjects()
  return Object.fromEntries(data.map((s) => [s.id, s]))
}

export function useSubjectMutations() {
  const queryClient = useQueryClient()
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ['subjects'] })
  // Deleting a subject un-assigns its tasks, so tasks change too.
  const onRemoved = () => {
    onSuccess()
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }
  return {
    create: useMutation({ mutationFn: subjectsApi.create, onSuccess }),
    update: useMutation({ mutationFn: ({ id, body }) => subjectsApi.update(id, body), onSuccess }),
    remove: useMutation({ mutationFn: subjectsApi.remove, onSuccess: onRemoved }),
  }
}
