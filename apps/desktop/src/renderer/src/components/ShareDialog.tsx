import { useMemo, useState } from 'react'

import { Button, Dialog } from '@pecie/ui'
import { shareImportModes, shareIncludeModes } from '@pecie/schemas'

import { t } from '../i18n'
import type { ShareDialogProps, ShareImportModeId, ShareIncludeId, SharePreviewState } from './types'

const includeOptions = Object.keys(shareIncludeModes) as ShareIncludeId[]
const importModeOptions = Object.keys(shareImportModes) as ShareImportModeId[]

function buildDefaultOutputPath(workspaceDirectory: string, projectTitle: string): string {
  const slug = projectTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${workspaceDirectory}/${slug || 'pecie-share'}.pe-share`
}

function getSeverityTone(severity: 'info' | 'warning' | 'critical'): 'neutral' | 'warning' | 'danger' {
  if (severity === 'critical') {
    return 'danger'
  }
  if (severity === 'warning') {
    return 'warning'
  }
  return 'neutral'
}

function getExcludedPathLabel(pathValue: string): string {
  if (pathValue === 'cache') {
    return 'shareExcluded_cache'
  }
  if (pathValue === 'logs') {
    return 'shareExcluded_logs'
  }
  if (pathValue === 'exports/out') {
    return 'shareExcluded_exports'
  }
  return pathValue
}

export function ShareDialog({
  open,
  locale,
  project,
  workspaceDirectory,
  onClose,
  onImportOpenedProject
}: ShareDialogProps): React.JSX.Element | null {
  const [include, setInclude] = useState<ShareIncludeId>('current-only')
  const [importMode, setImportMode] = useState<ShareImportModeId>('fork')
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState('')
  const [previewState, setPreviewState] = useState<SharePreviewState | null>(null)
  const [outputPath, setOutputPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [importPath, setImportPath] = useState('')
  const [messages, setMessages] = useState<string[]>([])

  const milestoneIds = useMemo(
    () =>
      selectedMilestoneIds
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [selectedMilestoneIds]
  )
  const includeMode = shareIncludeModes[include]
  const importModeConfig = shareImportModes[importMode]
  const requiresSelectedMilestones = include === 'current-plus-selected-milestones'
  const canPreviewOrCreate = !requiresSelectedMilestones || milestoneIds.length > 0
  const reviewState =
    previewState?.manifest.include === include && previewState.outputPath
      ? previewState
      : null
  const reviewManifest = reviewState?.manifest ?? null
  const reviewOutputPath = reviewState?.outputPath ?? ''
  const criticalWarnings = reviewManifest?.privacyWarnings.filter((warning) => warning.severity === 'critical') ?? []
  const reviewIncludedItems = reviewManifest
    ? [
        t(locale, 'shareIncluded_snapshot'),
        ...(shareIncludeModes[reviewManifest.include].includesTimelineMetadata ? [t(locale, 'shareIncluded_timeline')] : []),
        ...(shareIncludeModes[reviewManifest.include].includesHistory ? [t(locale, 'shareIncluded_history')] : []),
        ...(reviewManifest.include === 'current-plus-selected-milestones' && reviewManifest.selectedMilestoneIds.length > 0
          ? [t(locale, 'shareIncluded_selectedMilestones', { count: String(reviewManifest.selectedMilestoneIds.length) })]
          : [])
      ]
    : []

  if (!open) {
    return null
  }

  return (
    <Dialog open={open} onClose={onClose} size="wide" icon="bi-share" title={t(locale, 'shareTitle')}>
      <div className="dialog-form">
        {project ? (
          <section className="context-card context-card--soft">
            <div className="context-card__heading">
              <h3>{t(locale, 'shareCreateTitle')}</h3>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>{t(locale, 'shareInclude')}</span>
                <select onChange={(event) => setInclude(event.target.value as ShareIncludeId)} value={include}>
                  {includeOptions.map((option) => (
                    <option key={option} value={option}>
                      {t(locale, shareIncludeModes[option].i18nLabel as never)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t(locale, 'shareSelectedMilestones')}</span>
                <input
                  aria-describedby="share-selected-milestones-hint"
                  onChange={(event) => setSelectedMilestoneIds(event.target.value)}
                  placeholder="timeline-event-1, timeline-event-2"
                  value={selectedMilestoneIds}
                />
                <small id="share-selected-milestones-hint">
                  {requiresSelectedMilestones
                    ? t(locale, 'shareSelectedMilestonesRequired')
                    : t(locale, 'shareSelectedMilestonesOptional')}
                </small>
              </label>
            </div>
            <p>{t(locale, includeMode.includesHistory ? 'shareModeHint_history' : 'shareModeHint_snapshot')}</p>

            <label className="field">
              <span>{t(locale, 'outputPath')}</span>
              <div className="field-with-action">
                <input
                  onChange={(event) => setOutputPath(event.target.value)}
                  value={outputPath || buildDefaultOutputPath(workspaceDirectory, project.project.title)}
                />
                <Button
                  onClick={async () => {
                    const result = await window.pecie.invokeSafe('path:pickDirectory', {
                      defaultPath: workspaceDirectory
                    })
                    if (!result.canceled && result.path) {
                      setOutputPath(buildDefaultOutputPath(result.path, project.project.title))
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
                disabled={busy || !canPreviewOrCreate}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const response = await window.pecie.invokeSafe('share:previewPackage', {
                      projectPath: project.projectPath,
                      include,
                      selectedMilestoneIds: milestoneIds
                    })
                    setPreviewState({
                      manifest: response.manifest,
                      outputPath: outputPath || buildDefaultOutputPath(workspaceDirectory, project.project.title)
                    })
                    setMessages([])
                  } finally {
                    setBusy(false)
                  }
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                {t(locale, 'sharePreviewAction')}
              </Button>
              <Button
                disabled={busy || !canPreviewOrCreate}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const finalOutputPath = outputPath || buildDefaultOutputPath(workspaceDirectory, project.project.title)
                    const response = await window.pecie.invokeSafe('share:createPackage', {
                      projectPath: project.projectPath,
                      include,
                      outputPath: finalOutputPath,
                      selectedMilestoneIds: milestoneIds
                    })
                    setPreviewState({
                      manifest: response.manifest,
                      outputPath: response.outputPath
                    })
                    setMessages([t(locale, 'sharePackageCreated'), response.outputPath])
                  } catch (error) {
                    setMessages([error instanceof Error ? error.message : t(locale, 'sharePackageFailed')])
                  } finally {
                    setBusy(false)
                  }
                }}
                size="sm"
                type="button"
              >
                {t(locale, 'shareCreateAction')}
              </Button>
            </div>

            {!canPreviewOrCreate ? <p>{t(locale, 'shareSelectedMilestonesMissing')}</p> : null}

            {reviewManifest ? (
              <div className="context-card context-card--soft">
                <div className="context-card__heading">
                  <h3>{t(locale, 'sharePrivacyReviewTitle')}</h3>
                </div>
                {criticalWarnings.length > 0 ? (
                  <p>
                    <span className={`status-pill status-pill--${getSeverityTone('critical')}`}>{t(locale, 'shareSeverity_critical')}</span>{' '}
                    {t(locale, 'shareCriticalWarningBanner')}
                  </p>
                ) : (
                  <p>
                    <span className={`status-pill status-pill--${getSeverityTone('info')}`}>{t(locale, 'shareSeverity_info')}</span>{' '}
                    {t(locale, 'shareNoCriticalWarnings')}
                  </p>
                )}
                <dl className="meta-list">
                  <div>
                    <dt>{t(locale, 'projectTitle')}</dt>
                    <dd>{reviewManifest.projectTitle}</dd>
                  </div>
                  <div>
                    <dt>{t(locale, 'shareInclude')}</dt>
                    <dd>{t(locale, shareIncludeModes[reviewManifest.include].i18nLabel as never)}</dd>
                  </div>
                  <div>
                    <dt>{t(locale, 'outputPath')}</dt>
                    <dd>{reviewOutputPath}</dd>
                  </div>
                  <div>
                    <dt>{t(locale, 'shareSelectedMilestones')}</dt>
                    <dd>{reviewManifest.selectedMilestoneIds.length > 0 ? String(reviewManifest.selectedMilestoneIds.length) : t(locale, 'shareNone')}</dd>
                  </div>
                </dl>
                <div className="guide-grid guide-grid--dense">
                  <article className="guide-card">
                    <div className="stack-list stack-list--tight">
                      <h4>{t(locale, 'shareIncludedTitle')}</h4>
                      <p>{t(locale, 'shareIncludedBody')}</p>
                      <ul className="stack-list stack-list--tight">
                        {reviewIncludedItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                  <article className="guide-card">
                    <div className="stack-list stack-list--tight">
                      <h4>{t(locale, 'shareExcludedTitle')}</h4>
                      <p>{t(locale, 'shareExcludedBody')}</p>
                      <ul className="stack-list stack-list--tight">
                        {reviewManifest.excludedPaths.map((pathValue) => (
                          <li key={pathValue}>{t(locale, getExcludedPathLabel(pathValue) as never)}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </div>
                <div className="stack-list stack-list--tight">
                  <h4>{t(locale, 'shareWarningsTitle')}</h4>
                  <ul className="stack-list stack-list--tight">
                    {reviewManifest.privacyWarnings.map((warning) => (
                      <li key={`${warning.code}:${warning.severity}`}>
                        <span className={`status-pill status-pill--${getSeverityTone(warning.severity)}`}>
                          {t(locale, `shareSeverity_${warning.severity}` as never)}
                        </span>{' '}
                        <span>{t(locale, warning.code as never)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="context-card context-card--soft">
          <div className="context-card__heading">
            <h3>{t(locale, 'shareImportTitle')}</h3>
          </div>
          <label className="field">
            <span>{t(locale, 'shareImportFile')}</span>
            <div className="field-with-action">
              <input onChange={(event) => setImportPath(event.target.value)} value={importPath} />
              <Button
                onClick={async () => {
                  const result = await window.pecie.invokeSafe('path:pickFiles', {
                    defaultPath: workspaceDirectory,
                    allowMultiple: false
                  })
                  if (result.paths[0]) {
                    setImportPath(result.paths[0])
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
          <label className="field">
            <span>{t(locale, 'shareImportMode')}</span>
            <select onChange={(event) => setImportMode(event.target.value as ShareImportModeId)} value={importMode}>
              {importModeOptions.map((option) => (
                <option key={option} value={option}>
                  {t(locale, shareImportModes[option].i18nLabel as never)}
                </option>
              ))}
            </select>
            <small>
              {t(locale, importModeConfig.includesHistory ? 'shareImportHint_history' : 'shareImportHint_snapshot')}
              {' · '}
              {t(locale, importModeConfig.createsNewProjectId ? 'shareImportHint_newProjectId' : 'shareImportHint_keepProjectId')}
            </small>
          </label>
          <div className="dialog-actions">
            <Button
              disabled={!importPath.trim() || busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const response = await window.pecie.invokeSafe('share:importPackage', {
                    packagePath: importPath,
                    workspaceDirectory,
                    mode: importMode
                  })
                  setMessages([t(locale, 'sharePackageImported'), response.projectPath])
                  await onImportOpenedProject(response.projectPath)
                } catch (error) {
                  setMessages([error instanceof Error ? error.message : t(locale, 'sharePackageFailed')])
                } finally {
                  setBusy(false)
                }
              }}
              size="sm"
              type="button"
            >
              {t(locale, 'shareImportAction')}
            </Button>
          </div>
        </section>

        {messages.length > 0 ? (
          <section className="context-card">
            <ul aria-live="polite" className="stack-list stack-list--tight">
              {messages.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Dialog>
  )
}
