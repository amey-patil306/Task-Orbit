import { useEffect, useState } from 'react'
import { onSlowChange } from '../api/client'

/** Shown when any request runs longer than 4 s, e.g. while the free backend wakes up. */
export default function WakeUpBanner() {
  const [slow, setSlow] = useState(false)
  useEffect(() => onSlowChange(setSlow), [])
  if (!slow) return null
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[60] flex justify-center p-3">
      <div className="flex items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-white" />
        Waking up the server… this can take up to a minute the first time.
      </div>
    </div>
  )
}
