import api from './client'

export const planApi = {
  get: () => api.get('/plan').then((r) => r.data),
  generate: (horizonDays = 14) => api.post('/plan/generate', { horizon_days: horizonDays }).then((r) => r.data),
  tick: (id, done) => api.patch(`/plan/${id}`, { done }).then((r) => r.data),
}
