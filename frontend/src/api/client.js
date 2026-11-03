import axios from 'axios'

const TOKEN_KEY = 'task-orbit-token'
const SLOW_REQUEST_MS = 4000

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
  },
  set: (token) => {
    try { localStorage.setItem(TOKEN_KEY, token) } catch { /* private mode */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ }
  },
}

// The API base URL always comes from the environment (section 11).
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 90000, // a sleeping free backend can take up to a minute to wake
})

/* ---------- slow-request tracking for the "Waking up the server" banner ---------- */

let slowCount = 0
const slowListeners = new Set()

export function onSlowChange(listener) {
  slowListeners.add(listener)
  return () => slowListeners.delete(listener)
}

function setSlow(delta) {
  slowCount = Math.max(0, slowCount + delta)
  slowListeners.forEach((fn) => fn(slowCount > 0))
}

function startTimer(config) {
  config._slowTimer = setTimeout(() => {
    config._isSlow = true
    setSlow(1)
  }, SLOW_REQUEST_MS)
}

function stopTimer(config) {
  if (!config) return
  clearTimeout(config._slowTimer)
  if (config._isSlow) {
    config._isSlow = false
    setSlow(-1)
  }
}

/* ---------- 401 handling: AuthContext registers what to do ---------- */

let unauthorizedHandler = () => {}
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  startTimer(config)
  return config
})

api.interceptors.response.use(
  (response) => {
    stopTimer(response.config)
    return response
  },
  (error) => {
    stopTimer(error.config)
    // A 401 on a request that carried a token means the session is no longer valid.
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      tokenStore.clear()
      unauthorizedHandler()
    }
    return Promise.reject(error)
  },
)

/** Human-readable message from the backend's {"error": {...}} format. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.error?.message) return error.response.data.error.message
  if (error?.code === 'ECONNABORTED') return 'The server took too long to respond.'
  if (error?.request && !error?.response) return 'Cannot reach the server. Check your connection.'
  return fallback
}

/** Field-level errors from a 400 validation_error, e.g. {email: "..."}. */
export function fieldErrors(error) {
  return error?.response?.data?.error?.fields ?? {}
}

export default api
