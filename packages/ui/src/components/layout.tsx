import type { HTMLAttributes, ReactNode } from 'react'

import { Icon } from './icon'
import type { IconName } from '../icons/registry'

export type CardProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'div'
  variant?: 'default' | 'soft' | 'flush'
  heading?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

/** Raised surface (`.context-card`) with optional eyebrow, heading and action row. */
export function Card({ as: Tag = 'section', variant = 'default', heading, eyebrow, actions, className, children, ...props }: CardProps): React.JSX.Element {
  const classes = ['context-card', variant === 'soft' ? 'context-card--soft' : null, variant === 'flush' ? 'context-card--flush' : null, className].filter(Boolean).join(' ')
  return (
    <Tag {...props} className={classes}>
      {eyebrow || heading ? (
        <div className="context-card__heading">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          {heading ? <h3>{heading}</h3> : null}
        </div>
      ) : null}
      {children}
      {actions ? <div className="context-card__actions">{actions}</div> : null}
    </Tag>
  )
}

export type EmptyStateProps = {
  icon: IconName
  title: ReactNode
  body?: ReactNode
  actions?: ReactNode
  premium?: boolean
  titleId?: string
  className?: string
}

/** Empty state (`.empty-state`): decorative glyph, title, optional body and actions. */
export function EmptyState({ icon, title, body, actions, premium, titleId, className }: EmptyStateProps): React.JSX.Element {
  return (
    <div className={['empty-state', premium ? 'empty-state--premium' : null, className].filter(Boolean).join(' ')}>
      <div aria-hidden="true" className={`empty-state__icon${premium ? ' empty-state__icon--large' : ''}`}>
        <Icon name={icon} />
      </div>
      {premium ? (
        <h2 className="empty-state__title" id={titleId}>
          {title}
        </h2>
      ) : (
        <strong id={titleId}>{title}</strong>
      )}
      {body ? <p>{body}</p> : null}
      {actions ? <div className="empty-state__actions">{actions}</div> : null}
    </div>
  )
}
