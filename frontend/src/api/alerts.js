import api from './client'

export const alertsApi = {
  list: (unreadOnly = false) => api.get('/alerts', { params: unreadOnly ? { unread: 'true' } : {} }).then((r) => r.data),
  markRead: (id) => api.patch(`/alerts/${id}/read`).then((r) => r.data),
}
