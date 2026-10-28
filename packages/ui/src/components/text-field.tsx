import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

/** Shared chrome for labelled form controls: `.field` label, hint and error copy. */
export type FieldChromeProps = {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  compact?: boolean
  wide?: boolean
  className?: string
}

function fieldClasses({ compact, wide, className }: FieldChromeProps): string {
  return ['field', compact ? 'field--compact' : null, wide ? 'field--wide' : null, className].filter(Boolean).join(' ')
}

function FieldCopy({ hint, error, hintId, errorId }: { hint?: ReactNode; error?: ReactNode; hintId: string; errorId: string }): React.JSX.Element | null {
  if (!hint && !error) return null
  return (
    <>
      {hint ? (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </>
  )
}

function describedBy(hint: ReactNode, error: ReactNode, hintId: string, errorId: string): string | undefined {
  const ids = [hint ? hintId : null, error ? errorId : null].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
}

export type TextFieldProps = FieldChromeProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>

/** Single-line text input with visible label, optional hint and error (announced via role="alert"). */
export function TextField({ label, hint, error, compact, wide, className, ...input }: TextFieldProps): React.JSX.Element {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <label className={fieldClasses({ label, compact, wide, className })}>
      <span>{label}</span>
      <input aria-describedby={describedBy(hint, error, hintId, errorId)} aria-invalid={error ? true : undefined} {...input} />
      <FieldCopy error={error} errorId={errorId} hint={hint} hintId={hintId} />
    </label>
  )
}

export type TextAreaProps = FieldChromeProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>

/** Multi-line text input with the same chrome as TextField. */
export function TextArea({ label, hint, error, compact, wide, className, ...textarea }: TextAreaProps): React.JSX.Element {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <label className={fieldClasses({ label, compact, wide, className })}>
      <span>{label}</span>
      <textarea aria-describedby={describedBy(hint, error, hintId, errorId)} aria-invalid={error ? true : undefined} {...textarea} />
      <FieldCopy error={error} errorId={errorId} hint={hint} hintId={hintId} />
    </label>
  )
}

export type SelectProps = FieldChromeProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & { children: ReactNode }

/** Native select with the shared field chrome; options are passed as children. */
export function Select({ label, hint, error, compact, wide, className, children, ...select }: SelectProps): React.JSX.Element {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <label className={fieldClasses({ label, compact, wide, className })}>
      <span>{label}</span>
      <select aria-describedby={describedBy(hint, error, hintId, errorId)} aria-invalid={error ? true : undefined} {...select}>
        {children}
      </select>
      <FieldCopy error={error} errorId={errorId} hint={hint} hintId={hintId} />
    </label>
  )
}

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & { label: ReactNode; className?: string }

/** Native checkbox wrapped in its label: the whole row is the hit target. */
export function Checkbox({ label, className, ...input }: CheckboxProps): React.JSX.Element {
  return (
    <label className={['checkbox-field', className].filter(Boolean).join(' ')}>
      <input type="checkbox" {...input} />
      <span>{label}</span>
    </label>
  )
}

export type RadioOption<Value extends string> = { value: Value; label: ReactNode; description?: ReactNode; disabled?: boolean }

export type RadioGroupProps<Value extends string> = {
  label: ReactNode
  name: string
  value: Value
  options: ReadonlyArray<RadioOption<Value>>
  onChange: (value: Value) => void
  hint?: ReactNode
  error?: ReactNode
  className?: string
}

/** Native radio inputs inside a fieldset: arrow keys move the selection, the legend names the group. */
export function RadioGroup<Value extends string>({ label, name, value, options, onChange, hint, error, className }: RadioGroupProps<Value>): React.JSX.Element {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <fieldset aria-describedby={describedBy(hint, error, hintId, errorId)} className={['field', 'radio-group', className].filter(Boolean).join(' ')}>
      <legend>{label}</legend>
      <div className="radio-group__options">
        {options.map((option) => (
          <label className={`radio-group__option${option.value === value ? ' radio-group__option--checked' : ''}`} key={option.value}>
            <input checked={option.value === value} disabled={option.disabled} name={name} onChange={() => onChange(option.value)} type="radio" value={option.value} />
            <span className="radio-group__copy">
              <span>{option.label}</span>
              {option.description ? <small>{option.description}</small> : null}
            </span>
          </label>
        ))}
      </div>
      <FieldCopy error={error} errorId={errorId} hint={hint} hintId={hintId} />
    </fieldset>
  )
}
