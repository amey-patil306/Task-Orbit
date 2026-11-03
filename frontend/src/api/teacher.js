import api from './client'

const get = (url, params) => api.get(`/teacher${url}`, { params }).then((r) => r.data)
const send = (method, url, body) => api[method](`/teacher${url}`, body).then((r) => r.data)

export const teacherApi = {
  overview: () => get('/overview'),
  insights: () => get('/insights'),

  classrooms: () => get('/classrooms'),
  createClassroom: (body) => send('post', '/classrooms', body),
  updateClassroom: (id, body) => send('put', `/classrooms/${id}`, body),
  deleteClassroom: (id) => api.delete(`/teacher/classrooms/${id}`),
  classroom: (id) => get(`/classrooms/${id}`),
  analytics: (id) => get(`/classrooms/${id}/analytics`),
  removeStudent: (classId, studentId) => api.delete(`/teacher/classrooms/${classId}/students/${studentId}`),

  /** Smart Deadline Advisor */
  deadlineCheck: (classId, body) => send('post', `/classrooms/${classId}/deadline-check`, body),

  assignments: (classId) => get(`/classrooms/${classId}/assignments`),
  createAssignment: (classId, body) => send('post', `/classrooms/${classId}/assignments`, body),
  assignment: (id) => get(`/assignments/${id}`),
  updateAssignment: (id, body) => send('put', `/assignments/${id}`, body),
  deleteAssignment: (id) => api.delete(`/teacher/assignments/${id}`),

  extensions: (status) => get('/extension-requests', status ? { status } : {}),
  decideExtension: (id, body) => send('patch', `/extension-requests/${id}`, body),
}
