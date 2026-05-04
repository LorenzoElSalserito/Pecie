import { useEffect, useState } from 'react'

import { Button, Dialog } from '@pecie/ui'

import {
  type ExportProfileSupportDecision,
  type GetRuntimeCapabilitiesResponse,
  previewCapabilities,
  previewModes,
  type ExportDocumentResponse,
  type ListExportProfilesResponse,
  type PreviewExportResponse,
  type RuntimeCapabilityReport
} from '@pecie/schemas'

import { t } from '../i18n'
import type { ExportDialogProps, ExportFormatId, TemplateId } from './types'
import { exportFormats } from './types'
import { buildExportFilePath, formatTemplateLabel } from './utils'

const exportStepMachine = {
  idle: { next: ['profile-selected'] },
  'profile-selected': { next: ['preview-generating', 'export-writing'] },
  'preview-generating': { next: ['preview-ready', 'preview-error'] },
  'preview-ready': { next: ['export-writing', 'back-to-editor'] },
  'preview-error': { next: ['profile-selected'] },
  'export-writing': { next: ['export-done', 'export-error'] },
  'export-done': { next: [] },
  'export-error': { next: ['profile-selected'] },
  'back-to-editor': { next: [] }
} as const

type ExportStepState = keyof typeof exportStepMachine

function canTransition(from: ExportStepState, to: ExportStepState): boolean {
  return (exportStepMachine[from].next as readonly ExportStepState[]).includes(to)
}

function profileFamilyPrefix(profileId: string): string {
  return profileId.replace(/-(pdf|docx|odt|rtf|epub|html|latex|jats|tei|md|txt)$/, '')
}

function renderPreviewParagraphs(value: string): React.JSX.Element[] {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => <p key={paragraph}>{paragraph}</p>)
}

function getProfileSupportDecision(
  profile: ListExportProfilesResponse['profiles'][number] | undefined,
  capabilities: RuntimeCapabilityReport[]
): ExportProfileSupportDecision | null {
  if (!profile) {
    return null
  }

  const requiredCapabilities = new Set<GetRuntimeCapabilitiesResponse['capabilities'][number]['capabilityId']>()
  if (!['md', 'txt'].includes(profile.format)) {
    requiredCapabilities.add('pandoc')
  }
  if (profile.engine) {
    requiredCapabilities.add(profile.engine)
  }

  const required = Array.from(requiredCapabilities)
  const missing = required.filter((capabilityId) => {
    const entry = capabilities.find((item) => item.capabilityId === capabilityId)
    return !entry || entry.status !== 'available'
  })

  if (required.length === 0 || missing.length === 0) {
    return {
      profileId: profile.id,
      supported: true,
      availability: 'ready',
      requiredCapabilities: required,
      missingCapabilities: [],
      messageKey: 'exportRuntimeProfileReady'
    }
  }

  const onlyAddonMissing = missing.every((capabilityId) => capabilityId !== 'pandoc')
  return {
    profileId: profile.id,
    supported: false,
    availability: onlyAddonMissing ? 'addon-required' : 'unsupported',
    requiredCapabilities: required,
    missingCapabilities: missing,
    messageKey: onlyAddonMissing ? 'exportRuntimeProfileAddonRequired' : 'exportRuntimeProfileUnsupported'
  }
}

export function ExportDialog({
  open,
  locale,
  appSettings,
  project,
  selectedNode,
  onUpdateAppSettings,
  onClose
}: ExportDialogProps): React.JSX.Element | null {
  const [scope, setScope] = useState<'current-document' | 'whole-project'>('current-document')
  const [outputPath, setOutputPath] = useState('')
  const [logLines, setLogLines] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [exportStepState, setExportStepState] = useState<ExportStepState>('idle')
  const [exportProfiles, setExportProfiles] = useState<ListExportProfilesResponse['profiles']>([])
  const [exportProfileDiagnostics, setExportProfileDiagnostics] = useState<ListExportProfilesResponse['diagnostics']>([])
  const [runtimeCapabilities, setRuntimeCapabilities] = useState<GetRuntimeCapabilitiesResponse['capabilities']>([])
  const [runtimeVersion, setRuntimeVersion] = useState<string | undefined>(undefined)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [runtimeLoading, setRuntimeLoading] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatId>('pdf')
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [previewResponse, setPreviewResponse] = useState<PreviewExportResponse | null>(null)
  const [previewPageIndex, setPreviewPageIndex] = useState(0)
  const isCurrentDocumentAvailable = selectedNode?.type === 'document' && Boolean(selectedNode.documentId)
  const projectProfileFamily = project ? profileFamilyPrefix(project.manifest.defaultExportProfile) : ''
  const profilesForSelectedFormat = exportProfiles.filter((profile) => profile.format === selectedFormat)
  const selectedProfile =
    profilesForSelectedFormat.find((profile) => profile.id === selectedProfileId) ??
    profilesForSelectedFormat.find((profile) => profileFamilyPrefix(profile.id) === projectProfileFamily) ??
    profilesForSelectedFormat[0]
  const format = selectedProfile?.format ?? 'pdf'
  const exportPreviewPreference = selectedProfile
    ? appSettings.preview.exportPreview.byProfile[selectedProfile.id]
    : undefined
  const showPreviewBeforeSave = exportPreviewPreference?.showPreviewBeforeSave === true
  const exportPreviewEnabled = previewModes[appSettings.preview.mode].exportPreviewStepEnabled
  const previewCapability = previewCapabilities[format]
  const selectedProfileSupport = getProfileSupportDecision(selectedProfile, runtimeCapabilities)
  const exportActionDisabled =
    busy ||
    runtimeLoading ||
    !outputPath.trim() ||
    !selectedProfile ||
    !selectedProfileSupport?.supported ||
    (scope === 'current-document' && !isCurrentDocumentAvailable)

  useEffect(() => {
    if (!open || !project || !selectedProfile) {
      return
    }

    const defaultExportDirectory = `${project.projectPath}/exports/out`
    const extension = exportFormats.find((entry) => entry.id === selectedProfile.format)?.extension ?? selectedProfile.format
    setOutputPath(
      buildExportFilePath({
        directory: defaultExportDirectory,
        extension,
        projectTitle: project.project.title,
        scope,
        documentTitle: selectedNode?.title
      })
    )
  }, [open, project, scope, selectedNode?.title, selectedProfile])

  useEffect(() => {
    if (!open) {
      setExportStepState('idle')
      setPreviewResponse(null)
      setPreviewPageIndex(0)
      setSelectedProfileId('')
      return
    }

    setExportStepState((current) =>
      current === 'idle' || canTransition(current, 'profile-selected') ? 'profile-selected' : current
    )
  }, [open, scope, selectedFormat])

  useEffect(() => {
    if (!open) {
      return
    }

    if (selectedProfile && selectedProfile.id !== selectedProfileId) {
      setSelectedProfileId(selectedProfile.id)
      return
    }

    if (!selectedProfile && selectedProfileId) {
      setSelectedProfileId('')
    }
  }, [open, selectedProfile, selectedProfileId])

  useEffect(() => {
    if (scope === 'current-document' && !isCurrentDocumentAvailable) {
      setScope('whole-project')
    }
  }, [isCurrentDocumentAvailable, scope])

  useEffect(() => {
    if (!open || !project) {
      return
    }

    let ignore = false
    setRuntimeLoading(true)
    setRuntimeError(null)

    void Promise.all([
      window.pecie.invokeSafe('export:listProfiles', {
        projectPath: project.projectPath
      }),
      window.pecie.invokeSafe('export:getRuntimeCapabilities', {})
    ])
      .then(([response, capabilitiesResponse]) => {
        if (ignore) {
          return
        }

        setExportProfiles(response.profiles)
        setExportProfileDiagnostics(response.diagnostics)
        setRuntimeCapabilities(capabilitiesResponse.capabilities)
        setRuntimeVersion(capabilitiesResponse.runtimeVersion)
        const defaultProfile =
          response.profiles.find((profile) => profile.id === project.manifest.defaultExportProfile) ??
          response.profiles.find((profile) => profile.id === response.defaultProfileId) ??
          response.profiles[0]
        setSelectedProfileId(defaultProfile?.id ?? '')
        setSelectedFormat((current) => {
          if (response.profiles.some((profile) => profile.format === current)) {
            return current
          }
          return (defaultProfile?.format ?? 'pdf') as ExportFormatId
        })
      })
      .catch((error: unknown) => {
        if (ignore) {
          return
        }

        setRuntimeCapabilities([])
        setRuntimeVersion(undefined)
        setRuntimeError(error instanceof Error ? error.message : 'Unable to load export runtime capabilities.')
      })
      .finally(() => {
        if (!ignore) {
          setRuntimeLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [open, project])

  if (!open || !project) {
    return null
  }

  const currentProject = project
  const defaultExportDirectory = `${currentProject.projectPath}/exports/out`
  const previewPage = previewResponse?.preview?.pages[previewPageIndex] ?? null
  const previewPageUrl = previewPage ? `file://${currentProject.projectPath}/${previewPage.previewAssetRelPath}` : ''

  async function finalizeExport(): Promise<void> {
    if (!selectedProfile) {
      return
    }

    setBusy(true)
    setLogLines([])
    setExportStepState('export-writing')
    try {
      const response: ExportDocumentResponse = await window.pecie.invokeSafe('export:document', {
        projectPath: currentProject.projectPath,
        format,
        outputPath,
        scope,
        documentId: scope === 'current-document' ? selectedNode?.documentId : undefined,
        profileId: selectedProfile.id,
        citationProfileId: currentProject.project.defaultCitationProfileId
      })
      setLogLines(response.log)
      setExportStepState(response.success ? 'export-done' : 'export-error')
    } catch (error: unknown) {
      setLogLines([error instanceof Error ? error.message : 'Export failed'])
      setExportStepState('export-error')
    } finally {
      setBusy(false)
    }
  }

  async function startExportFlow(): Promise<void> {
    if (!selectedProfile) {
      return
    }

    if (!showPreviewBeforeSave || !exportPreviewEnabled) {
      await finalizeExport()
      return
    }

    setBusy(true)
    setLogLines([])
    setExportStepState('preview-generating')
    try {
      const response: PreviewExportResponse = await window.pecie.invokeSafe('export:preview', {
        projectPath: currentProject.projectPath,
        scope,
        documentId: scope === 'current-document' ? selectedNode?.documentId : undefined,
        profileId: selectedProfile.id
      })
      if (response.status === 'error') {
        setPreviewResponse(null)
        setLogLines([t(locale, response.errorMessageKey ?? 'exportStepState_preview-error')])
        setExportStepState('preview-error')
        return
      }

      setPreviewResponse(response)
      setPreviewPageIndex(0)
      setExportStepState('preview-ready')
    } catch (error: unknown) {
      setPreviewResponse(null)
      setLogLines([error instanceof Error ? error.message : 'Preview failed'])
      setExportStepState('preview-error')
    } finally {
      setBusy(false)
    }
  }

  async function persistExportPreviewPreference(nextValue: boolean): Promise<void> {
    if (!selectedProfile) {
      return
    }

    await onUpdateAppSettings({
      ...appSettings,
      preview: {
        ...appSettings.preview,
        exportPreview: {
          ...appSettings.preview.exportPreview,
          byProfile: {
            ...appSettings.preview.exportPreview.byProfile,
            [selectedProfile.id]: {
              profileId: selectedProfile.id,
              showPreviewBeforeSave: nextValue,
              lastDisclosureShownForMode: appSettings.preview.mode
            }
          }
        }
      }
    })
  }

  return (
    <Dialog open={open} onClose={onClose} size="compact" icon="bi-box-arrow-up" title={t(locale, 'exportTitle')}>
      <div className="dialog-form">
        <div className="field-grid">
          <label className="field">
            <span>{t(locale, 'template')}</span>
            <input readOnly value={formatTemplateLabel(locale, project.project.documentKind as TemplateId)} />
          </label>

          <label className="field">
            <span>{t(locale, 'format')}</span>
            <select
              data-tutorial-id="export-format"
              onChange={(event) => setSelectedFormat(event.target.value as ExportFormatId)}
              value={selectedFormat}
            >
              {exportFormats
                .filter((entry) => exportProfiles.some((profile) => profile.format === entry.id))
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
            </select>
          </label>

          <label className="field">
            <span>{t(locale, 'exportProfile')}</span>
            <select
              data-tutorial-id="export-profile"
              disabled={profilesForSelectedFormat.length === 0}
              onChange={(event) => setSelectedProfileId(event.target.value)}
              value={selectedProfile?.id ?? ''}
            >
              {profilesForSelectedFormat.map((profile) => {
                const support = getProfileSupportDecision(profile, runtimeCapabilities)
                return (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                    {support ? ` · ${t(locale, `exportRuntimeAvailability_${support.availability}`)}` : ''}
                  </option>
                )
              })}
            </select>
          </label>

          <label className="field">
            <span>{t(locale, 'scope')}</span>
            <select
              data-tutorial-id="export-scope"
              value={scope}
              onChange={(event) => setScope(event.target.value as 'current-document' | 'whole-project')}
            >
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
            <input data-tutorial-id="export-output-path" value={outputPath} onChange={(event) => setOutputPath(event.target.value)} />
            <Button
              onClick={async () => {
                const result = await window.pecie.invokeSafe('path:pickDirectory', {
                  defaultPath: defaultExportDirectory
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

        <label className="checkbox-field">
          <input
            checked={showPreviewBeforeSave}
            data-tutorial-id="export-preview-toggle"
            disabled={!exportPreviewEnabled || !selectedProfile}
            onChange={(event) => {
              void persistExportPreviewPreference(event.target.checked)
            }}
            type="checkbox"
          />
          <span>{t(locale, 'exportPreviewBeforeSave')}</span>
        </label>
        <p className="message-box" role="status">
          {exportPreviewEnabled
            ? t(locale, 'exportPreviewBeforeSaveBody')
            : t(locale, 'exportPreviewDisabledForMode')}
        </p>
        {runtimeLoading ? (
          <p className="message-box" role="status">{t(locale, 'exportRuntimeLoading')}</p>
        ) : null}
        {runtimeError ? (
          <p className="message-box" role="alert">{runtimeError}</p>
        ) : null}
        {selectedProfileSupport ? (
          <p className="message-box" role="status">{t(locale, selectedProfileSupport.messageKey)}</p>
        ) : null}

        {exportStepState === 'preview-generating' ? (
          <p aria-live="polite" className="message-box" role="status">
            {t(locale, 'exportPreviewGenerating')}
          </p>
        ) : null}
        {exportStepState === 'preview-ready' && previewResponse ? (
          <section className="context-card">
            <h3>{t(locale, 'exportPreviewTitle')}</h3>
            <p className="message-box" role="status">
              {t(locale, 'exportPreviewModeLabel', {
                mode: t(locale, previewModes[appSettings.preview.mode].shortLabelKey)
              })}
            </p>
            {previewResponse.warningMessageKey ? (
              <p className="message-box" role="status">{t(locale, previewResponse.warningMessageKey)}</p>
            ) : null}
            {previewCapability.previewKind === 'visual' && previewPage ? (
              <>
                <iframe className="attachment-preview-frame" src={previewPageUrl} title={t(locale, 'exportPreviewFrameTitle')} />
                {previewResponse.preview && previewResponse.preview.totalPages > 1 ? (
                  <div className="dialog-actions dialog-actions--end">
                    <Button
                      disabled={previewPageIndex === 0}
                      onClick={() => setPreviewPageIndex((current) => Math.max(0, current - 1))}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {t(locale, 'previous')}
                    </Button>
                    <span className="message-box">
                      {t(locale, 'exportPreviewPageCounter', {
                        current: String(previewPageIndex + 1),
                        total: String(previewResponse.preview.totalPages)
                      })}
                    </span>
                    <Button
                      disabled={previewPageIndex >= previewResponse.preview.totalPages - 1}
                      onClick={() =>
                        setPreviewPageIndex((current) => Math.min(previewResponse.preview!.totalPages - 1, current + 1))
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {t(locale, 'next')}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : previewCapability.previewKind === 'reader' ? (
              <article className="attachment-preview-reader">{renderPreviewParagraphs(previewResponse.previewText ?? '')}</article>
            ) : previewCapability.previewKind === 'approximate' ? (
              <article className="attachment-preview-text attachment-preview-text--rich">
                {renderPreviewParagraphs(previewResponse.previewText ?? '')}
              </article>
            ) : previewCapability.previewKind === 'text' ? (
              <pre className="attachment-preview-text">{previewResponse.previewText ?? ''}</pre>
            ) : (
              <pre className="attachment-preview-text">{previewResponse.previewText ?? ''}</pre>
            )}
          </section>
        ) : null}

        <div className="dialog-actions">
          {exportStepState === 'preview-ready' && previewResponse ? (
            <>
              <Button
                onClick={() => {
                  setExportStepState('back-to-editor')
                  onClose()
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t(locale, 'exportPreviewModify')}
              </Button>
              <Button disabled={busy} onClick={() => void finalizeExport()} size="sm" type="button">
                {t(locale, 'exportPreviewConfirm')}
              </Button>
            </>
          ) : (
            <Button
              disabled={exportActionDisabled}
              data-tutorial-id="export-start"
              onClick={() => void startExportFlow()}
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
          )}
        </div>
        <p className="message-box" role="status">
          {t(locale, 'exportStepStateLabel', {
            state: t(locale, `exportStepState_${exportStepState}`)
          })}
        </p>

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

        {selectedProfile || exportProfileDiagnostics.length > 0 ? (
          <section className="context-card">
            <h3>{t(locale, 'exportProfile')}</h3>
            {selectedProfile ? (
              <ul className="stack-list stack-list--tight">
                <li>
                  <span>{selectedProfile.sourcePath}</span>
                </li>
                <li>
                  <span>
                    {`${t(locale, 'exportRuntimeAvailabilityLabel')}: ${
                      selectedProfileSupport
                        ? t(locale, `exportRuntimeAvailability_${selectedProfileSupport.availability}`)
                        : t(locale, 'exportRuntimeAvailability_unknown')
                    }`}
                  </span>
                </li>
                {runtimeVersion ? (
                  <li>
                    <span>{`${t(locale, 'exportRuntimeVersion')}: ${runtimeVersion}`}</span>
                  </li>
                ) : null}
                {selectedProfile.engine ? (
                  <li>
                    <span>{`${t(locale, 'exportEngine')}: ${selectedProfile.engine}`}</span>
                  </li>
                ) : null}
                {selectedProfile.citationProfile ? (
                  <li>
                    <span>{`${t(locale, 'citationProfile')}: ${selectedProfile.citationProfile}`}</span>
                  </li>
                ) : null}
                {selectedProfileSupport?.requiredCapabilities.length ? (
                  <li>
                    <span>
                      {`${t(locale, 'exportRuntimeRequiredCapabilities')}: ${selectedProfileSupport.requiredCapabilities.join(', ')}`}
                    </span>
                  </li>
                ) : null}
                {selectedProfileSupport?.missingCapabilities.length ? (
                  <li>
                    <span>
                      {`${t(locale, 'exportRuntimeMissingCapabilities')}: ${selectedProfileSupport.missingCapabilities.join(', ')}`}
                    </span>
                  </li>
                ) : null}
              </ul>
            ) : null}
            {exportProfileDiagnostics.length > 0 ? (
              <ul className="stack-list stack-list--tight">
                {exportProfileDiagnostics.map((diagnostic) => (
                  <li key={`${diagnostic.profileId}-${diagnostic.sourcePath}`}>
                    <span>{diagnostic.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    </Dialog>
  )
}
