import type { KeyboardEvent, ReactNode } from 'react'

export type SegmentedOption<Value extends string> = { value: Value; label: string; icon?: ReactNode }

export type SegmentedControlProps<Value extends string> = {
  label: string
  value: Value
  options: ReadonlyArray<SegmentedOption<Value>>
  onChange: (value: Value) => void
  className?: string
  /** Render the icon only; the label stays as accessible name and tooltip. */
  iconOnly?: boolean
}

function moveSelection<Value extends string>(event: KeyboardEvent<HTMLButtonElement>, options: ReadonlyArray<SegmentedOption<Value>>, value: Value, onChange: (value: Value) => void): void {
  const index = options.findIndex((option) => option.value === value)
  const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (delta === 0 && event.key !== 'Home' && event.key !== 'End') return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + delta + options.length) % options.length
  onChange(options[next].value)
  event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
}

/** Exclusive choice rendered as a tablist (`.segmented-control`): arrows move, Home/End jump. */
export function SegmentedControl<Value extends string>({ label, value, options, onChange, className, iconOnly }: SegmentedControlProps<Value>): React.JSX.Element {
  return (
    <div aria-label={label} className={['segmented-control', className].filter(Boolean).join(' ')} role="tablist">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            aria-label={iconOnly ? option.label : undefined}
            aria-selected={active}
            className={`segmented-control__item${active ? ' segmented-control__item--active' : ''}`}
            key={option.value}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => moveSelection(event, options, value, onChange)}
            role="tab"
            tabIndex={active ? 0 : -1}
            title={iconOnly ? option.label : undefined}
            type="button"
          >
            {option.icon}
            {iconOnly ? null : <span>{option.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
