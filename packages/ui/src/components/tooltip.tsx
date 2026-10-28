import { cloneElement, useId, type ReactElement } from 'react'

export type TooltipProps = {
  /** Tooltip copy; also exposed to assistive tech through aria-describedby. */
  content: string
  placement?: 'top' | 'bottom'
  children: ReactElement<{ 'aria-describedby'?: string; className?: string; 'data-tooltip'?: string; 'data-tooltip-placement'?: string }>
}

/**
 * CSS-only tooltip: shows on hover and on keyboard focus (`:focus-visible`), never on touch-tap
 * alone, and respects reduced motion. The trigger must be a focusable element.
 */
export function Tooltip({ content, placement = 'top', children }: TooltipProps): React.JSX.Element {
  const id = useId()
  const child = children
  return (
    <>
      {cloneElement(child, {
        'aria-describedby': [child.props['aria-describedby'], id].filter(Boolean).join(' '),
        className: [child.props.className, 'pecie-tooltip-trigger'].filter(Boolean).join(' '),
        'data-tooltip': content,
        'data-tooltip-placement': placement
      })}
      <span className="pecie-tooltip-sr" id={id} role="tooltip">
        {content}
      </span>
    </>
  )
}
