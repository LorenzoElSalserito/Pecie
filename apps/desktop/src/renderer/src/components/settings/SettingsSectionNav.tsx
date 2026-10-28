import { useEffect, useRef, useState, type RefObject } from 'react'

import { Icon, type IconName } from '@pecie/ui'

export type SettingsSection = { id: string; label: string; icon: IconName }

/**
 * Side navigation of the settings dialog. It sits outside the scrolling pane, so content never
 * slides underneath it; it jumps to a section without hiding any control and follows the scroll
 * position (scroll-spy) so the current section is always the highlighted one.
 */
export function SettingsSectionNav({
  label,
  sections,
  scrollRoot
}: {
  label: string
  sections: SettingsSection[]
  scrollRoot: RefObject<HTMLElement>
}): React.JSX.Element {
  const [current, setCurrent] = useState(sections[0]?.id ?? '')
  // While a click-driven scroll is running the clicked section stays highlighted (no flicker
  // through the sections in between, and a short final section is not overridden).
  const jumping = useRef(false)

  useEffect(() => {
    const root = scrollRoot.current
    if (!root) {
      return
    }
    const update = (): void => {
      if (jumping.current) {
        return
      }
      // The current section is the last one whose top has crossed the upper third of the pane;
      // at the very bottom the last section wins even when it is too short to reach that line.
      const rootTop = root.getBoundingClientRect().top
      const threshold = rootTop + root.clientHeight / 3
      let next = sections[0]?.id ?? ''
      for (const section of sections) {
        const element = document.getElementById(section.id)
        if (element && element.getBoundingClientRect().top <= threshold) {
          next = section.id
        }
      }
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) {
        next = sections[sections.length - 1]?.id ?? next
      }
      setCurrent(next)
    }
    const endJump = (): void => {
      jumping.current = false
    }
    root.addEventListener('scroll', update, { passive: true })
    root.addEventListener('scrollend', endJump)
    return () => {
      root.removeEventListener('scroll', update)
      root.removeEventListener('scrollend', endJump)
    }
  }, [scrollRoot, sections])

  return (
    <nav aria-label={label} className="settings-nav">
      {sections.map((section) => (
        <button
          aria-current={current === section.id ? 'true' : undefined}
          className={`settings-nav__item${current === section.id ? ' settings-nav__item--current' : ''}`}
          key={section.id}
          onClick={() => {
            setCurrent(section.id)
            const root = scrollRoot.current
            const target = document.getElementById(section.id)
            if (root && target) {
              const offset = target.getBoundingClientRect().top - root.getBoundingClientRect().top
              const maxScroll = root.scrollHeight - root.clientHeight
              jumping.current =
                Math.abs(
                  Math.min(maxScroll, Math.max(0, root.scrollTop + offset)) - root.scrollTop
                ) > 1
            }
            target?.scrollIntoView({
              block: 'start',
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'auto'
                : 'smooth'
            })
            target?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true })
          }}
          type="button"
        >
          <Icon className="settings-nav__icon" name={section.icon} />
          <span className="settings-nav__label">{section.label}</span>
        </button>
      ))}
    </nav>
  )
}
