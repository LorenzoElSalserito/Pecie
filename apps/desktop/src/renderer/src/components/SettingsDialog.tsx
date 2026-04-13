import { useEffect, useState } from 'react'

import { Button, Dialog } from '@pecie/ui'

import { t } from '../i18n'
import { AuthorFields, WorkspaceFields } from './SetupWizard'
import type { SettingsDialogProps } from './types'

export function SettingsDialog({
  open,
  settings,
  appDataDirectory,
  currentProjectPath,
  onPreviewChange,
  onClose,
  onPrepareUninstall,
  onSave
}: SettingsDialogProps): React.JSX.Element | null {
  const [draft, setDraft] = useState(settings)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(settings)
      setStatus(null)
    }
  }, [open, settings])

  useEffect(() => {
    if (!open) {
      onPreviewChange?.(null)
      return
    }

    onPreviewChange?.({
      theme: draft.theme,
      fontPreference: draft.fontPreference,
      uiZoom: draft.uiZoom
    })

    return () => {
      onPreviewChange?.(null)
    }
  }, [draft.fontPreference, draft.theme, draft.uiZoom, onPreviewChange, open])

  if (!open) {
    return null
  }

  const locale = draft.locale

  return (
    <Dialog open={open} onClose={onClose} size="default" icon="bi-gear" title={t(locale, 'settings')}>
      <div className="dialog-form">
        <WorkspaceFields locale={locale} setSettings={setDraft} settings={draft} />
        <AuthorFields locale={locale} setSettings={setDraft} settings={draft} />
        <section className="context-card">
          <h3>{t(locale, 'sendBugReport')}</h3>
          <p>{t(locale, 'sendBugReportBody')}</p>
          <div className="dialog-actions dialog-actions--inline">
            <span>{status}</span>
            <Button
              onClick={async () => {
                const response = await window.pecie.invokeSafe('bug-report:compose', {
                  locale,
                  currentProjectPath
                })
                setStatus(`${t(locale, 'bugReportReady')} ${response.logPath}`)
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
            <span className="meta-list__mono">{appDataDirectory}</span>
            <Button
              onClick={async () => {
                const response = await window.pecie.invokeSafe('path:openInFileManager', {
                  path: appDataDirectory
                })
                setStatus(response.success ? t(locale, 'localDataFolderOpened') : t(locale, 'projectActionFailed'))
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
            <span className="meta-list__mono">{appDataDirectory}</span>
            <Button
              onClick={async () => {
                if (!window.confirm(t(locale, 'prepareUninstallConfirm'))) {
                  return
                }
                await onPrepareUninstall()
                setStatus(t(locale, 'prepareUninstallDone'))
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {t(locale, 'prepareUninstall')}
            </Button>
          </div>
        </section>
        <div className="dialog-actions">
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            {t(locale, 'cancel')}
          </Button>
          <Button
            disabled={!draft.authorProfile.name.trim() || !draft.workspaceDirectory.trim()}
            onClick={() => {
              onPreviewChange?.(null)
              void onSave(draft)
            }}
            size="sm"
            type="button"
          >
            {t(locale, 'save')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
