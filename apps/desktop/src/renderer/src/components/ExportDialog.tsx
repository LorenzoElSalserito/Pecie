import { useEffect, useState } from 'react'

import { Button, Dialog } from '@pecie/ui'

import type { ExportDocumentResponse } from '@pecie/schemas'

import { t } from '../i18n'
import type { ExportDialogProps, ExportFormatId } from './types'
import { exportFormats } from './types'
import { buildExportFilePath } from './utils'

export function ExportDialog({
  open,
  locale,
  project,
  selectedNode,
  workspaceDirectory,
  onClose
}: ExportDialogProps): React.JSX.Element | null {
  const [format, setFormat] = useState<ExportFormatId>('pdf')
  const [scope, setScope] = useState<'current-document' | 'whole-project'>('current-document')
  const [outputPath, setOutputPath] = useState('')
  const [logLines, setLogLines] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const isCurrentDocumentAvailable = selectedNode?.type === 'document' && Boolean(selectedNode.documentId)

  useEffect(() => {
    if (!open || !project) {
      return
    }

    const extension = exportFormats.find((entry) => entry.id === format)?.extension ?? format
    setOutputPath(
      buildExportFilePath({
        directory: workspaceDirectory,
        extension,
        projectTitle: project.project.title,
        scope,
        documentTitle: selectedNode?.title
      })
    )
  }, [format, open, project, scope, selectedNode?.title, workspaceDirectory])

  useEffect(() => {
    if (scope === 'current-document' && !isCurrentDocumentAvailable) {
      setScope('whole-project')
    }
  }, [isCurrentDocumentAvailable, scope])

  if (!open || !project) {
    return null
  }

  return (
    <Dialog open={open} onClose={onClose} size="compact" icon="bi-box-arrow-up" title={t(locale, 'exportTitle')}>
      <div className="dialog-form">
        <div className="field-grid">
          <label className="field">
            <span>{t(locale, 'format')}</span>
            <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormatId)}>
              {exportFormats.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>{t(locale, 'scope')}</span>
            <select value={scope} onChange={(event) => setScope(event.target.value as 'current-document' | 'whole-project')}>
              <option disabled={!isCurrentDocumentAvailable} value="current-document">
                {t(locale, 'currentDocument')}
              </option>
              <option value="whole-project">{t(locale, 'wholeProject')}
              </option>
            </select>
          </label>
        </div>

        {!isCurrentDocumentAvailable ? (
          <p className="message-box" role="status">
            {t(locale, 'exportNeedsSelection')}
          </p>
        ) : null}

        <label className="field">
          <span>{t(locale, 'outputPath')}</span>
          <div className="field-with-action">
            <input value={outputPath} onChange={(event) => setOutputPath(event.target.value)} />
            <Button
              onClick={async () => {
                const result = await window.pecie.invokeSafe('path:pickDirectory', {
                  defaultPath: workspaceDirectory
                })
                if (!result.canceled && result.path) {
                  const extension = exportFormats.find((entry) => entry.id === format)?.extension ?? format
                  setOutputPath(
                    buildExportFilePath({
                      directory: result.path,
                      extension,
                      projectTitle: project.project.title,
                      scope,
                      documentTitle: selectedNode?.title
                    })
                  )
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

        <div className="dialog-actions">
          <Button
            disabled={busy || !outputPath.trim() || (scope === 'current-document' && !isCurrentDocumentAvailable)}
            onClick={async () => {
              setBusy(true)
              setLogLines([])
              try {
                const response: ExportDocumentResponse = await window.pecie.invokeSafe('export:document', {
                  projectPath: project.projectPath,
                  format,
                  outputPath,
                  scope,
                  documentId: scope === 'current-document' ? selectedNode?.documentId : undefined
                })
                setLogLines(response.log)
              } catch (error: unknown) {
                setLogLines([error instanceof Error ? error.message : 'Export failed'])
              } finally {
                setBusy(false)
              }
            }}
            size="sm"
            type="button"
          >
            {busy ? (
              <>
                <span className="progress-bar" aria-hidden="true">
                  <span className="progress-bar__track"></span>
                </span>
                {t(locale, 'startExport')}
              </>
            ) : (
              t(locale, 'startExport')
            )}
          </Button>
        </div>

        {logLines.length > 0 ? (
          <section className="context-card">
            <h3>{t(locale, 'export')}</h3>
            <ul aria-live="assertive" className="stack-list stack-list--tight">
              {logLines.map((line) => (
                <li key={line}>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Dialog>
  )
}
