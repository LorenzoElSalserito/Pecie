import { useEffect, useState } from 'react'

import { Button, Dialog } from '@pecie/ui'

import { t } from '../i18n'
import type { OpenProjectDialogProps } from './types'

export function OpenProjectDialog({
  open,
  locale,
  workspaceDirectory,
  recentProjectPaths,
  onClose,
  onOpenProject
}: OpenProjectDialogProps): React.JSX.Element | null {
  const [projectPath, setProjectPath] = useState(workspaceDirectory)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setProjectPath(workspaceDirectory)
      setError(null)
    }
  }, [open, workspaceDirectory])

  if (!open) {
    return null
  }

  return (
    <Dialog open={open} onClose={onClose} size="compact" icon="bi-folder2-open" title={t(locale, 'openDialogTitle')}>
      <div className="dialog-form">
        <label className="field">
          <span>{t(locale, 'projectPath')}</span>
          <div className="field-with-action">
            <input value={projectPath} onChange={(event) => setProjectPath(event.target.value)} />
            <Button
              onClick={async () => {
                const result = await window.pecie.invokeSafe('path:pickProject', {
                  defaultPath: workspaceDirectory
                })
                if (!result.canceled && result.path) {
                  setProjectPath(result.path)
                }
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {t(locale, 'browse')}
            </Button>
          </div>
        </label>

        {recentProjectPaths.length > 0 ? (
          <section className="context-card">
            <h3>{t(locale, 'recentProjects')}</h3>
            <div className="recent-list">
              {recentProjectPaths.map((recentProjectPath) => (
                <button
                  key={recentProjectPath}
                  className="recent-list__item"
                  onClick={() => void onOpenProject(recentProjectPath)}
                  type="button"
                >
                  <strong>{recentProjectPath.split('/').at(-1)}</strong>
                  <span>{recentProjectPath}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {error ? (
          <p className="message-box message-box--error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="dialog-actions">
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            {t(locale, 'cancel')}
          </Button>
          <Button
            disabled={busy || !projectPath.trim()}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await onOpenProject(projectPath.trim())
              } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : '')
              } finally {
                setBusy(false)
              }
            }}
            size="sm"
            type="button"
          >
            {busy ? t(locale, 'openProject') : t(locale, 'openNow')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
