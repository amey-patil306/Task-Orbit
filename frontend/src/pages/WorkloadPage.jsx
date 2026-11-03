import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import Heatmap from '../components/Heatmap'
import LoadBadge from '../components/LoadBadge'
import PageHeader from '../components/PageHeader'
import { QueryState } from '../components/States'
import { usePredict, useWorkload } from '../hooks/useWorkload'
import { loadLevel } from '../lib/constants'
import { formatDay } from '../lib/dates'

const BAR_COLOURS = { low: '#16a34a', medium: '#f59e0b', high: '#dc2626', critical: '#7f1d1d' }
const LABEL_STYLE = { low: 'text-green-700', medium: 'text-amber-700', high: 'text-red-700' }

function HoursChart({ rows }) {
  const data = rows.map((r) => ({ ...r, label: formatDay(r.date).replace(',', '') }))
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={{ fontSize: 11 }} unit="h" allowDecimals={false} />
          <Tooltip formatter={(v, name) => [`${v} h`, name]} labelStyle={{ fontWeight: 600 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="hours_required" name="Required" radius={[4, 4, 0, 0]}>
            {data.map((r) => <Cell key={r.date} fill={BAR_COLOURS[loadLevel(r.load_ratio)]} />)}
          </Bar>
          <Line dataKey="hours_available" name="Available" type="stepAfter" stroke="#334155" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function DayTable({ rows, forecast }) {
  const risk = Object.fromEntries((forecast?.days ?? []).map((d) => [d.date, d]))
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-4">Day</th>
            <th className="py-2 pr-4 text-right">Required</th>
            <th className="py-2 pr-4 text-right">Available</th>
            <th className="py-2 pr-4">Load</th>
            <th className="py-2 pr-4">Rule label</th>
            <th className="py-2">ML label</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const ml = r.ml_label ?? (risk[r.date]?.probability != null ? risk[r.date].risk : null)
            return (
              <tr key={r.date}>
                <td className="whitespace-nowrap py-2 pr-4">{formatDay(r.date)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{r.hours_required} h</td>
                <td className="py-2 pr-4 text-right tabular-nums">{r.hours_available} h</td>
                <td className="py-2 pr-4"><LoadBadge ratio={r.load_ratio} /></td>
                <td className={`py-2 pr-4 font-medium capitalize ${LABEL_STYLE[r.rule_label]}`}>{r.rule_label}</td>
                <td className={`py-2 capitalize ${ml ? `font-medium ${LABEL_STYLE[ml]}` : 'text-slate-400'}`}>{ml ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function WorkloadPage() {
  const workload = useWorkload(28)
  const predict = usePredict()

  return (
    <>
      <PageHeader title="Workload" subtitle="How heavy each of the next 4 weeks looks" />
      <QueryState query={workload} loadingLabel="Calculating your load…"
        isEmpty={(rows) => rows.every((r) => r.hours_required === 0)}
        empty={
          <div className="card text-center">
            <p className="font-medium">No work scheduled in the next 4 weeks</p>
            <p className="mt-1 text-sm text-slate-500">Add tasks with due dates to see your daily load.</p>
            <Link to="/tasks" className="btn-primary mt-4">Add a task</Link>
          </div>
        }>
        {(rows) => {
          const overloaded = rows.filter((r) => r.rule_label === 'high').length
          return (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-5">
                <section className="card lg:col-span-2">
                  <h2 className="font-semibold">Next 4 weeks</h2>
                  <p className="mb-4 mt-1 text-sm text-slate-500">
                    {overloaded === 0 ? 'No overloaded days. Nice!' : `${overloaded} overloaded day${overloaded === 1 ? '' : 's'}. Hover a day for details.`}
                  </p>
                  <Heatmap rows={rows} />
                </section>
                <section className="card lg:col-span-3">
                  <h2 className="font-semibold">Required vs available hours</h2>
                  <p className="mb-4 mt-1 text-sm text-slate-500">Bars above the line are days you can't fit everything in.</p>
                  <HoursChart rows={rows} />
                </section>
              </div>
              <section className="card">
                <h2 className="mb-1 font-semibold">Day by day</h2>
                <p className="mb-3 text-sm text-slate-500">
                  Rule label comes from hours ÷ availability. ML label appears for the next 7 days once the model is trained.
                </p>
                <DayTable rows={rows} forecast={predict.data} />
              </section>
            </div>
          )
        }}
      </QueryState>
    </>
  )
}
