import type { SupportedLocale } from '@pecie/schemas'
import { Button } from '@pecie/ui'

import { t } from '../../i18n'

export function SupportSection({
  id,
  locale,
  status,
  currentProjectPath,
  appDataDirectory,
  onPrepareUninstall,
  onStatus
}: {
  id: string
  locale: SupportedLocale
  status: string | null
  currentProjectPath?: string
  appDataDirectory: string
  onPrepareUninstall: () => Promise<void>
  onStatus: (message: string) => void
}): React.JSX.Element {
  return (
    <>
      <section className="context-card" id={id}>
        <h3 tabIndex={-1}>{t(locale, 'sendBugReport')}</h3>
        <p>{t(locale, 'sendBugReportBody')}</p>
        <div className="dialog-actions dialog-actions--inline">
          <span>{status}</span>
          <Button
            onClick={async () => {
              const response = await window.pecie.invokeSafe('bug-report:compose', { locale, currentProjectPath })
              onStatus(`${t(locale, 'bugReportReady')} ${response.logPath}`)
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {t(locale, 'sendBugReport')}
          </Button>
        </div>
      </section>
      <section className="context-card">
        <h3>{t(locale, 'localDataFolder')}</h3>
        <p>{t(locale, 'localDataFolderBody')}</p>
        <div className="dialog-actions dialog-actions--inline">
          <span>{t(locale, 'localDataFolderHidden')}</span>
          <Button
            onClick={async () => {
              const response = await window.pecie.invokeSafe('path:openInFileManager', { path: appDataDirectory })
              onStatus(response.success ? t(locale, 'localDataFolderOpened') : t(locale, 'projectActionFailed'))
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {t(locale, 'openLocalDataFolder')}
          </Button>
        </div>
      </section>
      <section className="context-card">
        <h3>{t(locale, 'prepareUninstall')}</h3>
        <p>{t(locale, 'prepareUninstallBody')}</p>
        <div className="dialog-actions dialog-actions--inline">
          <span>{t(locale, 'prepareUninstallLocalDataHint')}</span>
          <Button
            onClick={async () => {
              if (!window.confirm(t(locale, 'prepareUninstallConfirm'))) {
                return
              }
              await onPrepareUninstall()
              onStatus(t(locale, 'prepareUninstallDone'))
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {t(locale, 'prepareUninstall')}
          </Button>
        </div>
      </section>
    </>
  )
}
