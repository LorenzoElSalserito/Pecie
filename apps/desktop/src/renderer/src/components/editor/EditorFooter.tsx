import type { SupportedLocale } from '@pecie/schemas'

import { t } from '../../i18n'
import type { CitationLibraryStatus, EditorPreferences } from './types'

export type EditorFooterProps = {
  locale: SupportedLocale
  wordCount: number
  citationLibraryStatus: CitationLibraryStatus | null
  sessionWordDelta: number
  sessionWordDeltaLabel: string
  preferences: EditorPreferences
}

/** Compact footer: counts, citation library state, session delta and active modes. */
export function EditorFooter({ locale, wordCount, citationLibraryStatus, sessionWordDelta, sessionWordDeltaLabel, preferences }: EditorFooterProps): React.JSX.Element {
  return (
    <div className="editor-footer">
      <span>
        {wordCount} {t(locale, 'wordCount').toLowerCase()}
      </span>
      {citationLibraryStatus ? (
        <>
          <span className="editor-footer__divider" aria-hidden="true"></span>
          <span>
            {t(locale, 'citationLibraryReady', { count: citationLibraryStatus.entryCount.toLocaleString(locale) })}
            {citationLibraryStatus.diagnosticsCount > 0 ? ` · ${t(locale, 'citationLibraryIssues', { count: citationLibraryStatus.diagnosticsCount.toLocaleString(locale) })}` : ''}
          </span>
        </>
      ) : null}
      <span className="editor-footer__divider" aria-hidden="true"></span>
      <span className={`editor-footer__session${sessionWordDelta > 0 ? ' editor-footer__session--positive' : sessionWordDelta < 0 ? ' editor-footer__session--negative' : ''}`}>
        {t(locale, 'sessionProgress', { count: sessionWordDeltaLabel })}
      </span>
      <span>{preferences.focusMode ? `${t(locale, 'focusMode')}: ${t(locale, 'enabled')}` : ''}</span>
      <span>{preferences.typewriterMode ? `${t(locale, 'typewriterMode')}: ${t(locale, 'enabled')}` : ''}</span>
      <span className="editor-footer__shortcut">Cmd/Ctrl+S</span>
    </div>
  )
}
