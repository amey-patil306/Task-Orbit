import { useEffect, useRef, useState } from 'react'
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
    panelRef.current?.querySelector('input, select, textarea, button')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="modal-title"
        className={`flex max-h-[92vh] w-full ${size} flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
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
