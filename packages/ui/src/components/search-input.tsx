import type { InputHTMLAttributes } from 'react'

import { Icon } from './icon'

export type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  /** Accessible name; the field has no visible label by design. */
  label: string
  className?: string
}

/** Search field with a leading magnifier glyph (`.binder-search` chrome). */
export function SearchInput({ label, className, ...input }: SearchInputProps): React.JSX.Element {
  return (
    <div className={['binder-search', className].filter(Boolean).join(' ')} role="search">
      <Icon className="binder-search__icon" name="search" />
      <input aria-label={label} className="binder-search__input" type="search" {...input} />
    </div>
  )
}
