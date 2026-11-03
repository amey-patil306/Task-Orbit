import { LOAD_STYLES, loadLevel } from '../lib/constants'
import { formatDay, istToday } from '../lib/dates'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function weekdayIndex(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7 // Mon = 0
}

/** Grid of coloured day cells (section 11): green < 0.7, amber 0.7-1.0, red > 1.0, dark red > 1.3. */
export default function Heatmap({ rows }) {
  const today = istToday()
  const blanks = rows.length ? weekdayIndex(rows[0].date) : 0

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-slate-400">
        {DAY_HEADERS.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {Array.from({ length: blanks }, (_, i) => <div key={`b${i}`} />)}
        {rows.map((r) => {
          const level = loadLevel(r.load_ratio)
          const empty = r.hours_required === 0
          return (
            <div key={r.date} tabIndex={0}
              className={`group relative flex aspect-square items-center justify-center rounded-md text-xs font-medium outline-none
                focus-visible:ring-2 focus-visible:ring-indigo-500 ${empty ? 'bg-green-100 text-green-800' : `${LOAD_STYLES[level].cell} text-white`}
                ${r.date === today ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}>
              {Number(r.date.slice(8))}
              <div role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-40 -translate-x-1/2 rounded-lg bg-slate-900 p-2 text-left text-xs font-normal text-white shadow-lg group-hover:block group-focus:block">
                <p className="font-medium">{formatDay(r.date)}</p>
                <p>{r.hours_required} h needed / {r.hours_available} h free</p>
                <p className="text-slate-300">{LOAD_STYLES[level].label}{r.load_ratio != null && ` · ${Math.round(r.load_ratio * 100)}%`}</p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {['low', 'medium', 'high', 'critical'].map((l) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded ${LOAD_STYLES[l].cell}`} />{LOAD_STYLES[l].label}
          </span>
        ))}
      </div>
    </div>
  )
}
