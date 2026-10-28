import type { SupportedLocale } from '@pecie/schemas'
import { Button } from '@pecie/ui'

import { t } from '../../i18n'

export type EditorWordGoalCardProps = {
  locale: SupportedLocale
  wordCount: number
  currentWordGoal: number | undefined
  wordGoalInput: string
  onWordGoalInputChange: (value: string) => void
  onCancel: () => void
  onSave: () => void
  /** 0..1 */
  progress: number
}

/** Word goal editor and progress bar shown under the status bar. */
export function EditorWordGoalCard({ locale, wordCount, currentWordGoal, wordGoalInput, onWordGoalInputChange, onCancel, onSave, progress }: EditorWordGoalCardProps): React.JSX.Element {
  return (
    <div className="editor-goal-card">
      <div className="editor-goal-card__header">
        <div className="editor-goal-card__summary">
          <strong>{t(locale, 'wordGoalLabel')}</strong>
          <span>{currentWordGoal ? t(locale, 'wordGoalProgress', { current: String(wordCount), goal: String(currentWordGoal) }) : t(locale, 'wordGoalUnset')}</span>
        </div>
        <label className="editor-goal-card__field">
          <span>{t(locale, 'wordGoalInputLabel')}</span>
          <input inputMode="numeric" min={1} onChange={(event) => onWordGoalInputChange(event.target.value)} placeholder="5000" type="number" value={wordGoalInput} />
        </label>
        <div className="editor-goal-card__actions">
          <Button onClick={onCancel} size="sm" type="button" variant="ghost">
            {t(locale, 'cancel')}
          </Button>
          <Button disabled={!wordGoalInput.trim() && !currentWordGoal} onClick={onSave} size="sm" type="button" variant="secondary">
            {wordGoalInput.trim() ? t(locale, 'saveWordGoal') : t(locale, 'clearWordGoal')}
          </Button>
        </div>
      </div>
      <div aria-hidden="true" className="editor-word-goal-progress">
        <span className="editor-word-goal-progress__fill" style={{ width: `${progress * 100}%` }}></span>
      </div>
    </div>
  )
}
