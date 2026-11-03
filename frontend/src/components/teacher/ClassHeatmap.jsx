import { LOAD_STYLES, classLevel } from '../../lib/constants'
import { formatDay } from '../../lib/dates'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const LEGEND = { low: 'Under 10%', medium: '10–30%', high: '30–50%', critical: '50%+' }

const weekday = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/** Class workload calendar: each day coloured by the share of students overloaded. */
export default function ClassHeatmap({ days, compact = false }) {
  const blanks = days.length ? weekday(days[0].date) : 0
  return (
    <div>
      {!compact && (
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-slate-400">
          {DAY_HEADERS.map((d) => <div key={d}>{d}</div>)}
        </div>
      )}
      <div className={`grid grid-cols-7 ${compact ? 'gap-1' : 'mt-1.5 gap-1.5'}`}>
        {!compact && Array.from({ length: blanks }, (_, i) => <div key={`b${i}`} />)}
        {days.map((d) => {
          const level = classLevel(d.pct_overloaded)
          const quiet = d.pct_overloaded === 0
          return (
            <div key={d.date} tabIndex={0}
              className={`group relative flex items-center justify-center rounded-md font-medium outline-none focus-visible:ring-2
                focus-visible:ring-indigo-500 ${compact ? 'h-6 text-[10px]' : 'aspect-square text-xs'}
                ${quiet ? 'bg-green-100 text-green-800' : `${LOAD_STYLES[level].cell} text-white`}`}>
              {Number(d.date.slice(8))}
              {d.deadlines > 0 && !compact && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white/90" aria-hidden="true" />
              )}
              <div role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-48 -translate-x-1/2 rounded-lg bg-slate-900 p-2 text-left text-xs font-normal text-white shadow-lg group-hover:block group-focus:block">
                <p className="font-medium">{formatDay(d.date)}</p>
                <p>{Math.round(d.pct_overloaded * 100)}% of students overloaded</p>
                <p className="text-slate-300">avg {d.avg_hours_required} h of work · {d.deadlines} deadline{d.deadlines === 1 ? '' : 's'}</p>
              </div>
            </div>
          )
        })}
      </div>
      {!compact && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Students overloaded:</span>
          {Object.entries(LEGEND).map(([l, text]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${l === 'low' ? 'bg-green-100 ring-1 ring-green-300' : LOAD_STYLES[l].cell}`} />{text}
            </span>
          ))}
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-slate-500" />deadline that day</span>
        </div>
      )}
    </div>
  )
}
