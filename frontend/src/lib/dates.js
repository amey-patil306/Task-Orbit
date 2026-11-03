// The API stores and returns UTC; we always display in Asia/Kolkata (section 8).
export const TZ = 'Asia/Kolkata'
const IST_OFFSET = '+05:30' // India has no daylight saving, so this is fixed.

const fmt = (opts) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, ...opts })
const dateFmt = fmt({ day: 'numeric', month: 'short', year: 'numeric' })
const shortFmt = fmt({ weekday: 'short', day: 'numeric', month: 'short' })
const timeFmt = fmt({ hour: 'numeric', minute: '2-digit' })
const partsFmt = fmt({ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export const formatDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : '—')
export const formatShortDate = (iso) => (iso ? shortFmt.format(new Date(iso)) : '—')
export const formatDateTime = (iso) => (iso ? `${dateFmt.format(new Date(iso))}, ${timeFmt.format(new Date(iso))}` : '—')

/** Plain YYYY-MM-DD date (no time) shown as e.g. "Mon, 2 Nov". */
export const formatDay = (ymd) => (ymd ? shortFmt.format(new Date(`${ymd}T12:00:00${IST_OFFSET}`)) : '—')

function istParts(date) {
  return Object.fromEntries(partsFmt.formatToParts(date).map((p) => [p.type, p.value]))
}

/** UTC ISO string -> "YYYY-MM-DDTHH:mm" for an <input type="datetime-local"> in IST. */
export function toIstInput(iso) {
  if (!iso) return ''
  const p = istParts(new Date(iso))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** "YYYY-MM-DDTHH:mm" typed in IST -> ISO string with offset; the backend converts to UTC. */
export const fromIstInput = (value) => (value ? `${value}:00${IST_OFFSET}` : null)

/** Today's date in IST as YYYY-MM-DD. */
export function istToday() {
  const p = istParts(new Date())
  return `${p.year}-${p.month}-${p.day}`
}

/** Whole days from today (IST) until an ISO datetime; negative when overdue. */
export function daysUntil(iso) {
  const p = istParts(new Date(iso))
  const due = Date.UTC(+p.year, +p.month - 1, +p.day)
  const [y, m, d] = istToday().split('-').map(Number)
  return Math.round((due - Date.UTC(y, m - 1, d)) / 86400000)
}

export function relativeDue(iso) {
  const n = daysUntil(iso)
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} overdue`
  if (n === 0) return 'Due today'
  if (n === 1) return 'Due tomorrow'
  return `Due in ${n} days`
}

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
