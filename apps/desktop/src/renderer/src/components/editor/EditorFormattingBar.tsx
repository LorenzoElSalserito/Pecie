import type { SupportedLocale } from '@pecie/schemas'
import { Button, Icon, TextField, Tooltip } from '@pecie/ui'

import { t } from '../../i18n'
import type { FormattingActionDefinition } from './types'

export type EditorFormattingBarProps = {
  locale: SupportedLocale
  groups: { core: FormattingActionDefinition[]; insert: FormattingActionDefinition[] }
  /** Accessible name and tooltip for an action: label plus keyboard shortcut when there is one. */
  describe: (entry: FormattingActionDefinition) => string
  onAction: (entry: FormattingActionDefinition) => void
}

/** Row 2 of the editor sheet: the writing-assistance toolbar, grouped in text and insert actions. */
export function EditorFormattingBar({ locale, groups, describe, onAction }: EditorFormattingBarProps): React.JSX.Element {
  return (
    <div className="editor-formatting-bar" id="editor-markdown-tools">
      {(['core', 'insert'] as const).map((groupKey) => (
        <div className="editor-formatting-bar__group" key={groupKey}>
          <span className="editor-formatting-bar__label">{t(locale, groupKey === 'core' ? 'formattingGroupCore' : 'formattingGroupInsert')}</span>
          <div className="editor-formatting-bar__chips" aria-label={t(locale, 'markdownAssist')} role="toolbar">
            {groups[groupKey].map((entry) => (
              <Tooltip content={describe(entry)} key={entry.action} placement="bottom">
                <button aria-label={describe(entry)} className="format-chip" onClick={() => onAction(entry)} type="button">
                  <Icon className="format-chip__icon" name={entry.icon} />
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export type EditorTableDialogProps = {
  locale: SupportedLocale
  rows: number
  columns: number
  onRowsChange: (rows: number) => void
  onColumnsChange: (columns: number) => void
  onCancel: () => void
  onInsert: () => void
}

/** Inline card that asks for the table size before inserting a Markdown table. */
export function EditorTableDialog({ locale, rows, columns, onRowsChange, onColumnsChange, onCancel, onInsert }: EditorTableDialogProps): React.JSX.Element {
  return (
    <section className="context-card context-card--soft">
      <div className="section-heading section-heading--compact">
        <h3>{t(locale, 'markdownTableDialogTitle')}</h3>
      </div>
      <div className="field-grid">
        <TextField label={t(locale, 'markdownTableRows')} max={20} min={1} onChange={(event) => onRowsChange(Number(event.target.value) || 1)} type="number" value={rows} />
        <TextField label={t(locale, 'markdownTableColumns')} max={10} min={1} onChange={(event) => onColumnsChange(Number(event.target.value) || 1)} type="number" value={columns} />
      </div>
      <div className="dialog-actions dialog-actions--inline">
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          {t(locale, 'cancel')}
        </Button>
        <Button onClick={onInsert} size="sm" type="button">
          {t(locale, 'insertTable')}
        </Button>
      </div>
    </section>
  )
}
