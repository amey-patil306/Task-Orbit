import { formatDay } from '../lib/dates'

const RISK = {
  low: { label: 'Low', cls: 'bg-green-50 text-green-800 border-green-200', dot: 'bg-load-low' },
  medium: { label: 'Medium', cls: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-load-medium' },
  high: { label: 'High', cls: 'bg-red-50 text-red-800 border-red-200', dot: 'bg-load-high' },
}

/** Next 7 days of overload risk from POST /api/predict. */
export default function RiskStrip({ forecast }) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {forecast.days.map((d) => {
          const r = RISK[d.risk] ?? RISK.low
          const [weekday, day] = formatDay(d.date).split(', ')
          return (
            <div key={d.date} className={`rounded-lg border px-1 py-2 text-center ${r.cls}`}
              title={`${formatDay(d.date)}: ${r.label} risk${d.probability != null ? ` (${Math.round(d.probability * 100)}%)` : ''}`}>
              <p className="text-[11px] font-medium opacity-75">{weekday}</p>
              <p className="text-xs">{day?.split(' ')[0]}</p>
              <span className={`mx-auto mt-1.5 block h-2 w-2 rounded-full ${r.dot}`} />
              <p className="mt-1 hidden text-[11px] font-medium sm:block">{r.label}</p>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {forecast.source === 'ml' ? `ML forecast · model ${forecast.model_version}` : 'Rule-based forecast (ML model not trained yet)'}
      </p>
    </div>
  )
}
