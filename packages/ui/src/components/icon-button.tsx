import type { ButtonHTMLAttributes } from 'react'

import { Button } from './button'

type IconButtonVariant = 'ghost' | 'secondary' | 'primary'

/**
 * Square button for a lone icon; `aria-label` is mandatory. The label doubles as the native
 * tooltip unless `title` is passed explicitly (pass `title={undefined}` when wrapping in `<Tooltip>`).
 */
export function IconButton({
  children,
  'aria-label': ariaLabel,
  className,
  variant = 'ghost',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: IconButtonVariant; size?: 'sm' | 'md' | 'lg' }): React.JSX.Element {
  if (!ariaLabel) {
    throw new Error('IconButton richiede aria-label')
  }
  const title = 'title' in props ? props.title : ariaLabel

  return (
    <Button {...props} aria-label={ariaLabel} className={['pecie-icon-button', className].filter(Boolean).join(' ')} title={title} variant={variant}>
      {children}
    </Button>
  )
}
