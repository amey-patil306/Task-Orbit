import { Link } from 'react-router-dom'
import { SEVERITY_STYLES } from '../../lib/constants'
import Icon from '../Icons'

/** Plain-language suggestions generated from the class data. */
export default function InsightList({ insights, limit }) {
  const items = limit ? insights.slice(0, limit) : insights
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Nothing needs your attention right now. 👍</p>
  }
  return (
    <ul className="stagger space-y-2">
      {items.map((i, n) => {
        const s = SEVERITY_STYLES[i.severity]
        const to = i.kind === 'extensions' ? '/teacher/extensions' : i.classroom_id ? `/teacher/classes/${i.classroom_id}` : null
        return (
          <li key={n} className={`flex items-start gap-3 rounded-xl border border-l-4 border-slate-200 bg-surface p-3 transition duration-200 hover:translate-x-0.5 hover:shadow-md ${s.bar}`}>
            <Icon name="spark" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="flex-1 text-sm text-slate-700">{i.message}</p>
            {to && <Link to={to} className="shrink-0 text-xs font-medium text-indigo-600 hover:underline">Open</Link>}
          </li>
        )
      })}
    </ul>
  )
}
