import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { errorMessage } from '../api/client'
import Icon from './Icons'

export default function Modal({ open, title, onClose, children, footer, size = 'max-w-lg' }) {
  const panelRef = useRef(null)
  // Callers pass a new onClose arrow on every render. Keep it in a ref so the effect below runs
  // only when the modal opens or closes; otherwise any parent re-render (a background refetch,
  // a button going "Saving…") would yank focus back to the first field while the user types.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    const previous = document.activeElement
    // Start in the first form field; fall back to the first button (e.g. confirm dialogs).
    const panel = panelRef.current
    ;(panel?.querySelector('input:not([type=hidden]), select, textarea') ?? panel?.querySelector('.border-t button, button'))?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null
  // Portal to <body>, so an animated (transformed) page wrapper can never trap the fixed overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="modal-title"
        className={`flex max-h-[92vh] w-full ${size} animate-slide-up flex-col rounded-t-3xl bg-surface shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 sm:animate-scale-in sm:rounded-2xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="modal-title" className="text-lg font-bold">{title}</h2>
          <button type="button" className="btn-ghost rounded-full transition hover:rotate-90" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** In-app confirm dialog (never window.confirm). If onConfirm fails, the error is shown in the dialog. */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', busy, onConfirm, onClose }) {
  const [error, setError] = useState(null)
  useEffect(() => { if (open) setError(null) }, [open])

  const confirm = async () => {
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal open={open} title={title} onClose={onClose} size="max-w-sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-danger" disabled={busy} onClick={confirm}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }>
      <p className="text-sm text-slate-600">{message}</p>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </Modal>
  )
}
