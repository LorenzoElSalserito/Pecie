import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

import { Icon } from './icon'
import type { IconName } from '../icons/registry'

export type ChipTone = 'neutral' | 'warning' | 'danger'

export type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  /** `count` renders the compact numeric chip, `status` the status pill. */
  kind?: 'count' | 'status'
  tone?: ChipTone
}

/** Static chip: counts (`.count-chip`) and status pills (`.status-pill`, toned). */
export function Chip({ kind = 'count', tone = 'neutral', className, children, ...props }: ChipProps): React.JSX.Element {
  const base = kind === 'status' ? 'status-pill' : 'count-chip'
  const classes = [base, tone !== 'neutral' && kind === 'status' ? `status-pill--${tone}` : null, className].filter(Boolean).join(' ')
  return (
    <span {...props} className={classes}>
      {children}
    </span>
  )
}

export type ToggleChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'className'> & {
  pressed: boolean
  /** Icon-only chip: square, label exposed through aria-label/title. */
  icon?: IconName
  label: string
  accent?: boolean
  className?: string
  children?: ReactNode
}

/** Pressable chip with `aria-pressed`; icon-only when `icon` is set, otherwise shows its children or label. */
export function ToggleChip({ pressed, icon, label, accent, className, children, ...button }: ToggleChipProps): React.JSX.Element {
  const classes = ['toggle-chip', icon ? 'toggle-chip--icon' : null, accent ? 'toggle-chip--accent' : null, className].filter(Boolean).join(' ')
  return (
    <button aria-label={icon ? label : undefined} aria-pressed={pressed} className={classes} title={icon ? label : undefined} type="button" {...button}>
      {icon ? <Icon name={icon} /> : (children ?? label)}
    </button>
  )
}
