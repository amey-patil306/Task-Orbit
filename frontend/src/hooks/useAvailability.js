import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { availabilityApi } from '../api/availability'

export function useAvailability() {
  return useQuery({ queryKey: ['availability'], queryFn: availabilityApi.get })
}

export function useSaveAvailability() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: availabilityApi.put,
    onSuccess: (rows) => {
      queryClient.setQueryData(['availability'], rows)
      // Available hours feed the load ratio, the forecast and the plan.
      ;['workload', 'predict', 'plan', 'alerts'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
    },
  })
}
