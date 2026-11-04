import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icons'

const ToastContext = createContext(null)

const TONES = {
  success: { icon: 'check', dot: 'bg-emerald-500' },
  error: { icon: 'warning', dot: 'bg-red-500' },
  info: { icon: 'spark', dot: 'bg-indigo-500' },
}

/**
 * Small notifications for finished actions ("Task saved", "Joined DBMS").
 * Usage: const toast = useToast(); toast('Task saved') or toast('Could not save', { tone: 'error' }).
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const toast = useCallback((title, { tone = 'success', description, duration = 3500 } = {}) => {
    const id = nextId.current++
    setToasts((list) => [...list.slice(-2), { id, title, tone, description }]) // keep at most 3
    setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  const value = useMemo(() => toast, [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-24 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end md:bottom-6">
          {toasts.map((t) => {
            const tone = TONES[t.tone] ?? TONES.success
            return (
              <div key={t.id} role="status"
                className="pointer-events-auto flex w-full max-w-sm animate-scale-in items-start gap-3 rounded-2xl bg-ink/95 p-3 pr-2 text-sm text-white shadow-2xl shadow-black/30 ring-1 ring-white/10 backdrop-blur">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone.dot}`}>
                  <Icon name={tone.icon} className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="font-semibold">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-white/70">{t.description}</p>}
                </div>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss"
                  className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white">
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// Remember where the user last clicked, so a burst can start from the button they pressed.
let lastPoint = null
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => { lastPoint = { x: e.clientX, y: e.clientY } }, { capture: true, passive: true })
}

const CONFETTI = ['#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b', '#38bdf8']

/**
 * A short confetti burst from a point on screen (e.g. the button that was clicked).
 * Plain DOM + the Web Animations API, so nothing re-renders. Skipped when motion is reduced.
 */
export function celebrate(x = lastPoint?.x ?? window.innerWidth / 2, y = lastPoint?.y ?? window.innerHeight / 2) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:70;overflow:hidden'
  document.body.appendChild(layer)
  const pieces = 26
  for (let i = 0; i < pieces; i++) {
    const p = document.createElement('span')
    const size = 5 + Math.random() * 6
    p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size * (Math.random() < 0.5 ? 1 : 0.45)}px;`
      + `background:${CONFETTI[i % CONFETTI.length]};border-radius:${Math.random() < 0.4 ? '50%' : '2px'}`
    layer.appendChild(p)
    const angle = (Math.PI * 2 * i) / pieces + Math.random() * 0.4
    const dist = 60 + Math.random() * 90
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist - 40
    p.animate([
      { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy + 80}px)) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' })
  }
  setTimeout(() => layer.remove(), 1500)
}
