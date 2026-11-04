import { useEffect, useState } from 'react'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Animates a number from 0 up to `target` (ease-out). Returns the current value. */
export default function useCountUp(target, { duration = 900, decimals = 0 } = {}) {
  const end = Number(target) || 0
  const [value, setValue] = useState(reducedMotion() ? end : 0)

  useEffect(() => {
    if (reducedMotion()) { setValue(end); return undefined }
    let frame
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setValue(end * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [end, duration])

  return Number(value.toFixed(decimals))
}
