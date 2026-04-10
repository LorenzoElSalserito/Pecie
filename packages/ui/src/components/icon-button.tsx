import type { ButtonHTMLAttributes } from 'react'

import { Button } from './button'

export function IconButton({
  children,
  'aria-label': ariaLabel,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>): React.JSX.Element {
  if (!ariaLabel) {
    throw new Error('IconButton richiede aria-label')
  }

  return (
    <Button
      {...props}
      aria-label={ariaLabel}
      variant="ghost"
      style={{
        alignItems: 'center',
        display: 'inline-flex',
        height: 44,
        justifyContent: 'center',
        padding: 0,
        width: 44
      }}
    >
      {children}
    </Button>
  )
}
