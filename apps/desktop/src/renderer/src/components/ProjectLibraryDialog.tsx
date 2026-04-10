import { useEffect, useState } from 'react'

import { Button, Dialog } from '@pecie/ui'

import { t } from '../i18n'
import type { ProjectLibraryDialogProps } from './types'
import { pathLabel } from './utils'

export function ProjectLibraryDialog({
  open,
  locale,
  settings,
  currentProjectPath,
  onClose,
  onOpenProject,
  onArchiveProject,
  onRestoreProject,
  onDeleteProject
}: ProjectLibraryDialogProps): React.JSX.Element | null {
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setBusyPath(null)
      setStatus(null)
    }
  }, [open])

  if (!open) {
    return null
  }

  async function runAction(projectPath: string, action: () => Promise<void>, successKey: string): Promise<void> {
    setBusyPath(projectPath)
    setStatus(null)
    try {
      await action()
      setStatus(t(locale, successKey))
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : t(locale, 'projectActionFailed'))
    } finally {
      setBusyPath(null)
    }
  }

  function renderProjectRow(projectPath: string, mode: 'recent' | 'archived'): React.JSX.Element {
    const isCurrent = currentProjectPath === projectPath
    return (
      <article className="project-library__item" key={`${mode}-${projectPath}`}>
        <div className="project-library__copy">
          <strong>{pathLabel(projectPath)}</strong>
          <span>{projectPath}</span>
          {isCurrent ? <small>{t(locale, 'currentProjectBadge')}</small> : null}
        </div>
        <div className="project-library__actions">
          <Button disabled={busyPath === projectPath} onClick={() => void onOpenProject(projectPath)} size="sm" variant="secondary">
            {t(locale, 'openNow')}
          </Button>
          {mode === 'recent' ? (
            <Button
              disabled={busyPath === projectPath}
              onClick={() => void runAction(projectPath, () => onArchiveProject(projectPath), 'projectArchived')}
              size="sm"
              variant="ghost"
            >
              {t(locale, 'archiveProject')}
            </Button>
          ) : (
            <Button
              disabled={busyPath === projectPath}
              onClick={() => void runAction(projectPath, () => onRestoreProject(projectPath), 'projectRestored')}
              size="sm"
              variant="ghost"
            >
              {t(locale, 'restoreProject')}
            </Button>
          )}
          <Button
            disabled={busyPath === projectPath}
            onClick={() => void runAction(projectPath, () => onDeleteProject(projectPath), 'projectDeleted')}
            size="sm"
            variant="ghost"
          >
            {t(locale, 'deleteProject')}
          </Button>
        </div>
      </article>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} size="default" icon="bi-collection" title={t(locale, 'manageProjectsTitle')}>
      <div className="dialog-form">
        <section className="context-card">
          <h3>{t(locale, 'activeProjects')}</h3>
          <div className="project-library__list">
            {settings.recentProjectPaths.length > 0 ? (
              settings.recentProjectPaths.map((projectPath) => renderProjectRow(projectPath, 'recent'))
            ) : (
              <p>{t(locale, 'noRecentProjects')}</p>
            )}
          </div>
        </section>

        <section className="context-card">
          <h3>{t(locale, 'archivedProjects')}</h3>
          <div className="project-library__list">
            {settings.archivedProjectPaths.length > 0 ? (
              settings.archivedProjectPaths.map((projectPath) => renderProjectRow(projectPath, 'archived'))
            ) : (
              <p>{t(locale, 'noArchivedProjects')}</p>
            )}
          </div>
        </section>

        {status ? (
          <p className="message-box" role="status">
            {status}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}
