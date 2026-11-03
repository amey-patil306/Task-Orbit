import api from './client'

/** Student side of classes, extension requests and weekly check-ins. */
export const classroomsApi = {
  mine: () => api.get('/classrooms').then((r) => r.data),
  join: (code) => api.post('/classrooms/join', { code }).then((r) => r.data),
  leave: (id) => api.delete(`/classrooms/${id}/leave`),

  taskInsight: (taskId) => api.get(`/tasks/${taskId}/insight`).then((r) => r.data),
  requestExtension: (taskId, body) => api.post(`/tasks/${taskId}/extension`, body).then((r) => r.data),
  myExtensions: () => api.get('/extensions').then((r) => r.data),

  checkins: () => api.get('/checkins').then((r) => r.data),
  saveCheckin: (body) => api.post('/checkins', body).then((r) => r.data),
}
