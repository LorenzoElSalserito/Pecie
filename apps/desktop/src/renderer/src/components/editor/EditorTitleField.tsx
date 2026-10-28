import type { SupportedLocale } from '@pecie/schemas'

import { t } from '../../i18n'

/** Inline editable document title; its id labels the whole editor surface. */
export function EditorTitleField({ locale, value, onChange }: { locale: SupportedLocale; value: string; onChange: (value: string) => void }): React.JSX.Element {
  return (
    <div className="editor-title-field">
      <input
        aria-label={t(locale, 'editorTitle')}
        className="editor-title-input"
        id="editor-surface-title"
        placeholder={t(locale, 'projectTitlePlaceholder')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
