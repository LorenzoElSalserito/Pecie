import type { KeyboardEvent, ReactNode } from 'react'

export type TabItem<Value extends string> = { value: Value; label: ReactNode; accessibleLabel?: string; tutorialId?: string }

export type TabsProps<Value extends string> = {
  label: string
  value: Value
  items: ReadonlyArray<TabItem<Value>>
  onChange: (value: Value) => void
  className?: string
  itemClassName?: string
  activeItemClassName?: string
}

/**
 * Horizontal tab list with roving tabindex: Left/Right (and Up/Down) move between tabs, Home/End
 * jump to the ends, the active tab is the only one in the tab order. Class names are injectable so
 * existing surfaces keep their chrome while sharing the behaviour.
 */
export function Tabs<Value extends string>({ label, value, items, onChange, className, itemClassName = 'pecie-tab', activeItemClassName = 'pecie-tab--active' }: TabsProps<Value>): React.JSX.Element {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const index = items.findIndex((item) => item.value === value)
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (delta === 0 && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + delta + items.length) % items.length
    onChange(items[next].value)
    event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }
  return (
    <div aria-label={label} className={['pecie-tabs', className].filter(Boolean).join(' ')} role="tablist">
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            aria-label={item.accessibleLabel}
            aria-selected={active}
            className={[itemClassName, active ? activeItemClassName : null].filter(Boolean).join(' ')}
            data-tutorial-id={item.tutorialId}
            key={item.value}
            onClick={() => onChange(item.value)}
            onKeyDown={onKeyDown}
            role="tab"
            tabIndex={active ? 0 : -1}
            type="button"
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
