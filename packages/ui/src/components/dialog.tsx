import { createElement, type ReactNode } from 'react'
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components'

type DialogSize = 'default' | 'compact' | 'wide'

const sizeClasses: Record<DialogSize, string> = {
  default: 'dialog-card',
  compact: 'dialog-card dialog-card--compact',
  wide: 'dialog-card dialog-card--wide'
}

const ModalOverlayRoot = ModalOverlay as unknown as (props: Record<string, unknown>) => React.JSX.Element
const ModalRoot = Modal as unknown as (props: Record<string, unknown>) => React.JSX.Element
const DialogRoot = AriaDialog as unknown as (props: Record<string, unknown>) => React.JSX.Element
const HeadingRoot = Heading as unknown as (props: Record<string, unknown>) => React.JSX.Element

export function Dialog({
  title,
  description,
  icon,
  open,
  onClose,
  size = 'default',
  children
}: {
  title?: string
  description?: string
  icon?: string
  open: boolean
  onClose?: () => void
  size?: DialogSize
  children: ReactNode
}): React.JSX.Element | null {
  if (!open) {
    return null
  }

  return (
    <ModalOverlayRoot
      className="dialog-scrim"
      isDismissable={Boolean(onClose)}
      isOpen={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!nextOpen) {
          onClose?.()
        }
      }}
    >
      <ModalRoot className={sizeClasses[size]}>
        <DialogRoot aria-label={title} className="dialog-card__content">
          {title ? (
            <div className="dialog-card__header">
              {icon ? <i aria-hidden="true" className={`bi ${icon} dialog-card__icon`}></i> : null}
              <div className="stack-list">
                {createElement(HeadingRoot, { slot: 'title' }, title)}
                {description ? <p>{description}</p> : null}
              </div>
            </div>
          ) : null}
          {children}
        </DialogRoot>
      </ModalRoot>
    </ModalOverlayRoot>
  )
}
