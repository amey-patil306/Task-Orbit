import { useState } from 'react'
import { useCheckins, useSaveCheckin } from '../hooks/useClassrooms'

const LEVELS = [
  { value: 1, label: 'Relaxed', cls: 'hover:bg-green-50 aria-checked:bg-green-600' },
  { value: 2, label: 'Fine', cls: 'hover:bg-green-50 aria-checked:bg-green-500' },
  { value: 3, label: 'Busy', cls: 'hover:bg-amber-50 aria-checked:bg-amber-500' },
  { value: 4, label: 'Stressed', cls: 'hover:bg-red-50 aria-checked:bg-red-500' },
  { value: 5, label: 'Overwhelmed', cls: 'hover:bg-red-50 aria-checked:bg-red-700' },
]

/** Weekly "How overloaded did you feel?" (1-5). Also real labelled data for the ML models. */
export default function StressCheckin() {
  const checkins = useCheckins()
  const save = useSaveCheckin()
  const [editing, setEditing] = useState(false)

  if (!checkins.data) return null
  const current = checkins.data.items.find((i) => i.week_start === checkins.data.this_week)
  const history = checkins.data.items.slice(0, 6).reverse()

  if (current && !editing) {
    return (
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">This week you feel</p>
          <p className="font-semibold">{LEVELS[current.stress - 1].label} ({current.stress}/5)</p>
        </div>
        <div className="flex items-end gap-1" aria-label="Stress over recent weeks">
          {history.map((h) => (
            <div key={h.week_start} title={`Week of ${h.week_start}: ${h.stress}/5`}
              className={`w-4 rounded-t ${h.stress >= 4 ? 'bg-red-400' : h.stress === 3 ? 'bg-amber-400' : 'bg-green-400'}`}
              style={{ height: `${h.stress * 7}px` }} />
          ))}
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={() => setEditing(true)}>Change</button>
      </section>
    )
  }

  return (
    <section className="card">
      <h2 className="font-semibold">Weekly check-in</h2>
      <p className="mt-1 text-sm text-slate-500">How overloaded do you feel this week? Your teachers see this so they can spot overload early.</p>
      <div className="mt-3 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Stress level">
        {LEVELS.map((l) => (
          <button key={l.value} type="button" role="radio" aria-checked={current?.stress === l.value}
            disabled={save.isPending}
            onClick={async () => { await save.mutateAsync({ stress: l.value }); setEditing(false) }}
            className={`rounded-lg border border-slate-200 px-1 py-2 text-center text-xs font-medium transition aria-checked:text-white ${l.cls}`}>
            <span className="block text-lg">{l.value}</span>{l.label}
          </button>
        ))}
      </div>
    </section>
  )
}
