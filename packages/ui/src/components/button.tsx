import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

export function Button({
  children,
  style,
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}): React.JSX.Element {
  const classes = [
    'pecie-btn',
    `pecie-btn--${variant}`,
    `pecie-btn--${size}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <button
      {...props}
      className={classes}
      style={style}
    >
      {children}
    </button>
  )
}
