import { useEffect } from 'react'

import { ToastViewport as ToastStack } from '@pecie/ui'

import type { ToastViewportProps } from './types'

/** Desktop toast host: owns the auto-dismiss timers, delegates markup to the design system. */
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

  return <ToastStack dismissLabel={dismissLabel} onDismiss={onDismiss} toasts={toasts} />
}
