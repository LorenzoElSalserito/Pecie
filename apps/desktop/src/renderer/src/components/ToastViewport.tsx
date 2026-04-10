import { useEffect } from 'react'

import type { ToastViewportProps } from './types'

export function ToastViewport({ toasts, dismissLabel, onDismiss }: ToastViewportProps): React.JSX.Element | null {
  useEffect(() => {
    if (toasts.length === 0) {
      return
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        onDismiss(toast.id)
      }, toast.tone === 'error' ? 5200 : 3600)
    )

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [onDismiss, toasts])

  if (toasts.length === 0) {
    return null
  }

  return (
    <div aria-atomic="true" aria-live="polite" className="toast-viewport">
      {toasts.map((toast) => (
        <article className={`toast toast--${toast.tone}`} key={toast.id} role="status">
          <span>{toast.message}</span>
          <button aria-label={dismissLabel} className="toast__dismiss" onClick={() => onDismiss(toast.id)} type="button">
            ×
          </button>
        </article>
      ))}
    </div>
  )
}
