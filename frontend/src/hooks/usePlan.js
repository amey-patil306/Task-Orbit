import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { planApi } from '../api/plan'

export function usePlan() {
  return useQuery({ queryKey: ['plan'], queryFn: planApi.get })
}

export function useGeneratePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: planApi.generate,
    onSuccess: (data) => queryClient.setQueryData(['plan'], data.sessions),
  })
}

export function useTickSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, done }) => planApi.tick(id, done),
    onSuccess: (updated) =>
      queryClient.setQueryData(['plan'], (old = []) => old.map((s) => (s.id === updated.id ? updated : s))),
  })
}
