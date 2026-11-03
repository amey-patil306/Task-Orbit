import api from './client'

export const tasksApi = {
  /** filters: { status, type, subject_id, from, to } - empty values are dropped */
  list: (filters = {}) => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null))
    return api.get('/tasks', { params }).then((r) => r.data)
  },
  create: (body) => api.post('/tasks', body).then((r) => r.data),
  update: (id, body) => api.put(`/tasks/${id}`, body).then((r) => r.data),
  complete: (id, actualHours) => api.patch(`/tasks/${id}/complete`, { actual_hours: actualHours }).then((r) => r.data),
  remove: (id) => api.delete(`/tasks/${id}`),
}
