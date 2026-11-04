import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

/** Sets the browser tab title, e.g. "Tasks · Task Orbit". */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = typeof title === 'string' && title ? `${title} · Task Orbit` : 'Task Orbit'
  }, [title])
}

export default function PageHeader({ title, subtitle, actions }) {
  const { user } = useAuth()
  usePageTitle(title)
  const bar = user?.role === 'teacher' ? 'from-emerald-500 via-teal-500 to-cyan-500' : 'from-indigo-500 via-violet-500 to-fuchsia-500'
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <span className={`mb-2 block h-1 w-10 rounded-full bg-gradient-to-r ${bar}`} />
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}
