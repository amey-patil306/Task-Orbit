import api from './client'

export const workloadApi = {
  /** Daily load rows between two YYYY-MM-DD dates (inclusive). */
  get: (from, to) => api.get('/workload', { params: { from, to } }).then((r) => r.data),
  conflicts: () => api.get('/workload/conflicts').then((r) => r.data),
  predict: () => api.post('/predict').then((r) => r.data),
}
