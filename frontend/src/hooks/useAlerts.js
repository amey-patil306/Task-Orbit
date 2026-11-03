import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { alertsApi } from '../api/alerts'

export function useAlerts(unreadOnly = false) {
  return useQuery({ queryKey: ['alerts', { unreadOnly }], queryFn: () => alertsApi.list(unreadOnly) })
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: alertsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}
