import api from './client'

export const subjectsApi = {
  list: () => api.get('/subjects').then((r) => r.data),
  create: (body) => api.post('/subjects', body).then((r) => r.data),
  update: (id, body) => api.put(`/subjects/${id}`, body).then((r) => r.data),
  remove: (id) => api.delete(`/subjects/${id}`),
}
