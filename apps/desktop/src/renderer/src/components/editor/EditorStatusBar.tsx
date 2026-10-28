import type { SupportedLocale } from '@pecie/schemas'
import { Icon, SegmentedControl, ToggleChip, type IconName } from '@pecie/ui'

import { t } from '../../i18n'
import type { EditorViewMode } from '../types'
import type { EditorPreferences } from './types'

export type EditorStatusBarProps = {
  locale: SupportedLocale
  saveState: string
  statusMessage: string
  wordCount: number
  currentWordGoal: number | undefined
  isWordGoalEditorOpen: boolean
  onToggleWordGoalEditor: () => void
  showPageMarkers: boolean
  onTogglePageMarkers: () => void
  viewMode: EditorViewMode
  onViewModeChange: (mode: EditorViewMode) => void
  preferences: EditorPreferences
  onPreferencesChange: (preferences: EditorPreferences) => void
  isMarkdownToolsOpen: boolean
  onToggleMarkdownTools: () => void
}

/** Row 1 of the editor sheet: live status on the left, writing toggles and view switcher on the right. */
export function EditorStatusBar({
  locale,
  saveState,
  statusMessage,
  wordCount,
  currentWordGoal,
  isWordGoalEditorOpen,
  onToggleWordGoalEditor,
  showPageMarkers,
  onTogglePageMarkers,
  viewMode,
  onViewModeChange,
  preferences,
  onPreferencesChange,
  isMarkdownToolsOpen,
  onToggleMarkdownTools
}: EditorStatusBarProps): React.JSX.Element {
  const wordGoalLabel = currentWordGoal ? t(locale, 'editWordGoal') : t(locale, 'setWordGoal')
  return (
    <div className="editor-statusbar">
      <div className="editor-statusbar__left" role="status" aria-live="polite">
        <span className={`save-indicator save-indicator--${saveState}`} aria-hidden="true"></span>
        <span>{statusMessage}</span>
        <span className="editor-statusbar__divider" aria-hidden="true"></span>
        <span className="editor-statusbar__metric">
          {wordCount} {t(locale, 'wordCount').toLowerCase()}
        </span>
        {currentWordGoal ? (
          <>
            <span className="editor-statusbar__divider" aria-hidden="true"></span>
            <span className="editor-statusbar__goal-copy">{t(locale, 'wordGoalProgress', { current: String(wordCount), goal: String(currentWordGoal) })}</span>
          </>
        ) : null}
      </div>
      <div className="editor-statusbar__right">
        <button
          aria-label={wordGoalLabel}
          aria-expanded={isWordGoalEditorOpen}
          className={`toggle-chip toggle-chip--icon${currentWordGoal ? ' toggle-chip--accent' : ''}`}
          onClick={onToggleWordGoalEditor}
          title={wordGoalLabel}
          type="button"
        >
          <Icon name="flag" />
        </button>
        <ToggleChip accent={showPageMarkers} icon="file-earmark-break" label={t(locale, 'showPageMarkers')} onClick={onTogglePageMarkers} pressed={showPageMarkers} />
        <SegmentedControl
          iconOnly
          label={t(locale, 'editorViewMode')}
          onChange={onViewModeChange}
          options={(
            [
              ['write', t(locale, 'editorViewWrite'), 'pencil-square'],
              ['preview', t(locale, 'editorViewPreview'), 'eye'],
              ['split', t(locale, 'editorViewSplit'), 'layout-split']
            ] as Array<[EditorViewMode, string, IconName]>
          ).map(([mode, label, icon]) => ({ value: mode, label, icon: <Icon name={icon} /> }))}
          value={viewMode}
        />
        <ToggleChip
          icon="bullseye"
          label={t(locale, 'focusMode')}
          onClick={() => onPreferencesChange({ ...preferences, focusMode: !preferences.focusMode })}
          pressed={preferences.focusMode}
        />
        <ToggleChip
          icon="keyboard"
          label={t(locale, 'typewriterMode')}
          onClick={() => onPreferencesChange({ ...preferences, typewriterMode: !preferences.typewriterMode })}
          pressed={preferences.typewriterMode}
        />
        <ToggleChip
          accent={isMarkdownToolsOpen}
          aria-controls="editor-markdown-tools"
          aria-expanded={isMarkdownToolsOpen}
          icon="markdown"
          label={t(locale, 'markdownAssist')}
          onClick={onToggleMarkdownTools}
          pressed={isMarkdownToolsOpen}
        />
      </div>
    </div>
  )
}
