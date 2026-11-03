import api from './client'

export const availabilityApi = {
  get: () => api.get('/availability').then((r) => r.data),
  /** rows: [{ weekday: 0-6 (Mon=0), hours }] */
  put: (rows) => api.put('/availability', rows).then((r) => r.data),
}
