import type { HTMLAttributes, ReactNode } from 'react'

export type BannerTone = 'neutral' | 'error'

export type BannerProps = HTMLAttributes<HTMLParagraphElement> & { tone?: BannerTone; children: ReactNode }

/** Inline message (`.message-box`): neutral is a polite status, error is announced immediately. */
export function Banner({ tone = 'neutral', className, children, role, ...props }: BannerProps): React.JSX.Element {
  return (
    <p {...props} className={['message-box', tone === 'error' ? 'message-box--error' : null, className].filter(Boolean).join(' ')} role={role ?? (tone === 'error' ? 'alert' : 'status')}>
      {children}
    </p>
  )
}

export type ProgressProps = {
  /** 0..1; omit for the indeterminate bar. */
  value?: number
  /** Accessible name; required unless `decorative`. */
  label?: string
  /** Purely visual (e.g. inside a button whose text already says what happens): hidden from AT. */
  decorative?: boolean
  className?: string
}

/** Progress bar (`.progress-bar`): indeterminate shimmer, or a determinate fill with an accessible value. */
export function Progress({ value, label, decorative, className }: ProgressProps): React.JSX.Element {
  const determinate = typeof value === 'number'
  const percent = determinate ? Math.max(0, Math.min(100, Math.round(value * 100))) : undefined
  const accessibility = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'progressbar', 'aria-label': label, 'aria-valuemin': determinate ? 0 : undefined, 'aria-valuemax': determinate ? 100 : undefined, 'aria-valuenow': percent }
  return (
    <span {...accessibility} className={['progress-bar', determinate ? 'progress-bar--determinate' : null, className].filter(Boolean).join(' ')}>
      <span className="progress-bar__track" style={determinate ? { width: `${percent}%` } : undefined}></span>
    </span>
  )
}

export type ToastTone = 'success' | 'info' | 'error'
export type ToastItem = { id: string; message: string; tone: ToastTone }

export type ToastViewportProps = {
  toasts: ToastItem[]
  dismissLabel: string
  onDismiss: (id: string) => void
}

/** Non-intrusive toast stack (`.toast-viewport`): polite live region, each toast dismissable. */
export function ToastViewport({ toasts, dismissLabel, onDismiss }: ToastViewportProps): React.JSX.Element | null {
  if (toasts.length === 0) return null
  return (
    <div aria-atomic="true" aria-live="polite" className="toast-viewport">
      {toasts.map((toast) => (
        <div className={`toast toast--${toast.tone}`} key={toast.id} role="status">
          <span>{toast.message}</span>
          <button aria-label={dismissLabel} className="toast__dismiss" onClick={() => onDismiss(toast.id)} type="button">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
