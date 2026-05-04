import { useEffect, useState } from 'react'

import { Button, Dialog } from '@pecie/ui'
import type {
  GetRuntimeCapabilitiesResponse,
  PrivacyInventoryResponse,
  PrivacyMaintenanceActionId,
  RuntimeCapabilityReport
} from '@pecie/schemas'
import { expertCapabilities, previewModes, privacyMaintenanceActions } from '@pecie/schemas'

import { t } from '../i18n'
import { AuthorFields, WorkspaceFields } from './SetupWizard'
import type { SettingsDialogProps } from './types'
import { formatFileSize } from './utils'

function getRuntimeCapabilityLabel(locale: SettingsDialogProps['settings']['locale'], capabilityId: RuntimeCapabilityReport['capabilityId']): string {
  switch (capabilityId) {
    case 'pandoc':
      return t(locale, 'exportRuntimeCapability_pandoc')
    case 'weasyprint':
      return t(locale, 'exportRuntimeCapability_weasyprint')
    case 'xelatex':
      return t(locale, 'exportRuntimeCapability_xelatex')
    case 'pdflatex':
      return t(locale, 'exportRuntimeCapability_pdflatex')
    case 'lualatex':
      return t(locale, 'exportRuntimeCapability_lualatex')
    default:
      return capabilityId
  }
}

function getExpertCapabilityLabel(
  locale: SettingsDialogProps['settings']['locale'],
  capabilityId: keyof typeof expertCapabilities
): string {
  switch (capabilityId) {
    case 'gitGraph':
      return t(locale, 'expertCapability_gitGraph')
    case 'rawTags':
      return t(locale, 'expertCapability_rawTags')
    case 'guidedReset':
      return t(locale, 'expertCapability_guidedReset')
    case 'structuredLogs':
      return t(locale, 'expertCapability_structuredLogs')
    default:
      return capabilityId
  }
}

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
  const [previewDisclosureDismissed, setPreviewDisclosureDismissed] = useState(false)
  const [privacyInventory, setPrivacyInventory] = useState<PrivacyInventoryResponse | null>(null)
  const [privacyLoading, setPrivacyLoading] = useState(false)
  const [privacyBusyAction, setPrivacyBusyAction] = useState<PrivacyMaintenanceActionId | null>(null)
  const [runtimeCapabilities, setRuntimeCapabilities] = useState<GetRuntimeCapabilitiesResponse['capabilities']>([])
  const [runtimeVersion, setRuntimeVersion] = useState<string | undefined>(undefined)
  const [runtimeLoading, setRuntimeLoading] = useState(false)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(settings)
      setStatus(null)
      setPreviewDisclosureDismissed(false)
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

  useEffect(() => {
    if (!open) {
      setPrivacyInventory(null)
      setPrivacyLoading(false)
      setPrivacyBusyAction(null)
      setRuntimeCapabilities([])
      setRuntimeVersion(undefined)
      setRuntimeLoading(false)
      setRuntimeError(null)
      return
    }

    setPrivacyLoading(true)
    setRuntimeLoading(true)
    void window.pecie
      .invokeSafe('privacy:getInventory', {
        workspaceDirectory: draft.workspaceDirectory,
        projectPath: currentProjectPath
      })
      .then((response) => setPrivacyInventory(response))
      .finally(() => setPrivacyLoading(false))
    void window.pecie
      .invokeSafe('export:getRuntimeCapabilities', {})
      .then((response) => {
        setRuntimeCapabilities(response.capabilities)
        setRuntimeVersion(response.runtimeVersion)
        setRuntimeError(null)
      })
      .catch((error: unknown) => {
        setRuntimeCapabilities([])
        setRuntimeVersion(undefined)
        setRuntimeError(error instanceof Error ? error.message : 'Unable to load export runtime capabilities.')
      })
      .finally(() => setRuntimeLoading(false))
  }, [currentProjectPath, draft.workspaceDirectory, open])

  if (!open) {
    return null
  }

  const locale = draft.locale
  const previewMode = draft.preview.mode
  const previewModePolicy = previewModes[previewMode]
  const shouldShowPreviewDisclosure =
    !previewDisclosureDismissed && draft.preview.disclosuresSeen[previewMode] !== true
  const privacyItems = privacyInventory?.items ?? []
  const availableCapabilities = runtimeCapabilities.filter((capability) => capability.status === 'available')
  const bundledCapabilities = availableCapabilities.filter((capability) => capability.source === 'bundled')
  const missingAddonCapabilities = runtimeCapabilities.filter(
    (capability) =>
      capability.status !== 'available' &&
      (capability.distribution === 'bundled-sidecar' ||
        capability.distribution === 'system-addon' ||
        capability.distribution === 'manual-addon')
  )
  const runtimeGuidanceKey =
    missingAddonCapabilities.length > 0 ? 'exportRuntimeSettingsAddonBody' : 'exportRuntimeSettingsReadyBody'
  const expertCapabilityEntries = Object.entries(expertCapabilities) as Array<
    [keyof typeof expertCapabilities, (typeof expertCapabilities)[keyof typeof expertCapabilities]]
  >

  return (
    <Dialog open={open} onClose={onClose} size="default" icon="bi-gear" title={t(locale, 'settings')}>
      <div className="dialog-form">
        <WorkspaceFields locale={locale} setSettings={setDraft} settings={draft} />
        <AuthorFields locale={locale} setSettings={setDraft} settings={draft} />
        <section className="context-card">
          <h3>{t(locale, 'expertModeTitle')}</h3>
          <p>{t(locale, 'expertModeBody')}</p>
          <p className="message-box" role="alert">
            {t(locale, 'expertModeDisclosure')}
          </p>
          <label className="checkbox-field">
            <input
              checked={draft.expertModeEnabled}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  expertModeEnabled: event.target.checked
                })
              }
              type="checkbox"
            />
            <span>{t(locale, 'expertModeToggle')}</span>
          </label>
          <p className="meta-list__mono">{t(locale, draft.expertModeEnabled ? 'expertModeEnabled' : 'expertModeDisabled')}</p>
          <div className="privacy-inventory">
            {expertCapabilityEntries.map(([capabilityId, capability]) => (
              <article className="privacy-item-card" key={capabilityId}>
                <div className="privacy-item-card__header">
                  <div>
                    <h4>{getExpertCapabilityLabel(locale, capabilityId)}</h4>
                    <p className="meta-list__mono">{capabilityId}</p>
                  </div>
                  <strong>{t(locale, `expertRisk_${capability.risk}`)}</strong>
                </div>
                <div className="privacy-item-card__meta">
                  <span>{t(locale, 'expertCapabilityRisk')}</span>
                  <span>{capability.requiresProject ? t(locale, 'expertCapabilityRequiresProject') : t(locale, 'expertCapabilityAppWide')}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="context-card">
          <h3>{t(locale, 'previewSettingsTitle')}</h3>
          <p>{t(locale, 'previewSettingsBody')}</p>
          <label className="field">
            <span>{t(locale, 'previewModeLabel')}</span>
            <select
              onChange={(event) => {
                const nextMode = event.target.value as typeof draft.preview.mode
                setDraft({
                  ...draft,
                  preview: {
                    ...draft.preview,
                    mode: nextMode
                  }
                })
                setPreviewDisclosureDismissed(false)
              }}
              value={previewMode}
            >
              {Object.entries(previewModes).map(([mode, policy]) => (
                <option key={mode} value={mode}>
                  {t(locale, policy.shortLabelKey)}
                </option>
              ))}
            </select>
          </label>
          <p className="message-box" role="status">
            {t(locale, previewModePolicy.helperKey)}
          </p>
          {shouldShowPreviewDisclosure ? (
            <div className="message-box">
              <p>{t(locale, previewModePolicy.disclosureKey)}</p>
              <label className="checkbox-field">
                <input
                  checked={draft.preview.disclosuresSeen[previewMode] === true}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      preview: {
                        ...draft.preview,
                        disclosuresSeen: {
                          ...draft.preview.disclosuresSeen,
                          [previewMode]: event.target.checked
                        }
                      }
                    })
                  }
                  type="checkbox"
                />
                <span>{t(locale, 'previewDisclosureDismiss')}</span>
              </label>
            </div>
          ) : null}
        </section>
        <section className="context-card">
          <div className="context-card__heading">
            <div>
              <h3>{t(locale, 'exportRuntimeSettingsTitle')}</h3>
              <p>{t(locale, 'exportRuntimeSettingsBody')}</p>
            </div>
            <Button
              disabled={runtimeLoading}
              onClick={async () => {
                setRuntimeLoading(true)
                try {
                  const response = await window.pecie.invokeSafe('export:getRuntimeCapabilities', {})
                  setRuntimeCapabilities(response.capabilities)
                  setRuntimeVersion(response.runtimeVersion)
                  setRuntimeError(null)
                } catch (error: unknown) {
                  setRuntimeCapabilities([])
                  setRuntimeVersion(undefined)
                  setRuntimeError(error instanceof Error ? error.message : 'Unable to load export runtime capabilities.')
                } finally {
                  setRuntimeLoading(false)
                }
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {t(locale, 'exportRuntimeRefresh')}
            </Button>
          </div>
          <p className="message-box" role="status">
            {t(locale, runtimeGuidanceKey)}
          </p>
          {runtimeVersion || runtimeCapabilities.length > 0 ? (
            <dl className="meta-list">
              <div>
                <dt>{t(locale, 'exportRuntimeVersion')}</dt>
                <dd>{runtimeVersion ?? t(locale, 'exportRuntimeAvailability_unknown')}</dd>
              </div>
              <div>
                <dt>{t(locale, 'exportRuntimeBundledCount')}</dt>
                <dd>{bundledCapabilities.length}</dd>
              </div>
              <div>
                <dt>{t(locale, 'exportRuntimeAddonCount')}</dt>
                <dd>{missingAddonCapabilities.length}</dd>
              </div>
            </dl>
          ) : null}
          {runtimeLoading ? <p className="message-box">{t(locale, 'exportRuntimeLoading')}</p> : null}
          {runtimeError ? <p className="message-box" role="alert">{runtimeError}</p> : null}
          {!runtimeLoading && runtimeCapabilities.length === 0 ? (
            <p>{t(locale, 'exportRuntimeInventoryEmpty')}</p>
          ) : null}
          <div className="privacy-inventory">
            {runtimeCapabilities.map((capability) => (
              <article className="privacy-item-card" key={capability.capabilityId}>
                <div className="privacy-item-card__header">
                  <div>
                    <h4>{getRuntimeCapabilityLabel(locale, capability.capabilityId)}</h4>
                    <p className="meta-list__mono">{capability.capabilityId}</p>
                  </div>
                  <strong>{t(locale, `exportRuntimeCapabilityStatus_${capability.status}`)}</strong>
                </div>
                <div className="privacy-item-card__meta">
                  <span>{t(locale, `exportRuntimeCapabilitySource_${capability.source}`)}</span>
                  <span>{t(locale, `exportRuntimeDistribution_${capability.distribution}`)}</span>
                  <span>{capability.version ?? t(locale, 'exportRuntimeCapabilityVersionMissing')}</span>
                </div>
                <p>{t(locale, `exportRuntimeCapabilityHelp_${capability.capabilityId}`)}</p>
              </article>
            ))}
          </div>
        </section>
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
          <div className="context-card__heading">
            <div>
              <h3>{t(locale, 'privacyDashboardTitle')}</h3>
              <p>{t(locale, 'privacyDashboardBody')}</p>
            </div>
            <Button
              disabled={privacyLoading}
              onClick={async () => {
                setPrivacyLoading(true)
                const response = await window.pecie.invokeSafe('privacy:getInventory', {
                  workspaceDirectory: draft.workspaceDirectory,
                  projectPath: currentProjectPath
                })
                setPrivacyInventory(response)
                setPrivacyLoading(false)
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {t(locale, 'privacyRefresh')}
            </Button>
          </div>
          {privacyInventory ? (
            <dl className="meta-list">
              <div>
                <dt>{t(locale, 'privacyTotalSize')}</dt>
                <dd>{formatFileSize(privacyInventory.totals.sizeBytes, locale)}</dd>
              </div>
              <div>
                <dt>{t(locale, 'privacySensitiveCount')}</dt>
                <dd>{privacyInventory.totals.sensitiveItems}</dd>
              </div>
              <div>
                <dt>{t(locale, 'privacyDeletableCount')}</dt>
                <dd>{privacyInventory.totals.deletableItems}</dd>
              </div>
            </dl>
          ) : null}
          {privacyLoading ? <p className="message-box">{t(locale, 'privacyLoading')}</p> : null}
          {!privacyLoading && privacyItems.length === 0 ? <p>{t(locale, 'privacyInventoryEmpty')}</p> : null}
          <div className="privacy-inventory">
            {privacyItems.map((item) => {
              const actionId = item.maintenanceAction ?? null
              const action = actionId ? privacyMaintenanceActions[actionId] : null

              return (
                <article className="privacy-item-card" key={item.id}>
                  <div className="privacy-item-card__header">
                    <div>
                      <h4>{item.label}</h4>
                      <p className="meta-list__mono">{item.relativePath}</p>
                    </div>
                    <strong>{formatFileSize(item.sizeBytes, locale)}</strong>
                  </div>
                  <div className="privacy-item-card__meta">
                    <span>{t(locale, item.source === 'app' ? 'privacySourceApp' : 'privacySourceProject')}</span>
                    <span>{item.containsSensitiveData ? t(locale, 'privacySensitiveYes') : t(locale, 'privacySensitiveNo')}</span>
                    <span>{item.deletable ? t(locale, 'privacyDeletableYes') : t(locale, 'privacyDeletableNo')}</span>
                  </div>
                  {item.descriptionKey ? <p>{t(locale, item.descriptionKey)}</p> : null}
                  {action ? (
                    <div className="dialog-actions dialog-actions--inline">
                      <span>{t(locale, 'privacyActionHint')}</span>
                      <Button
                        disabled={privacyBusyAction === actionId}
                        onClick={async () => {
                          const confirmedActionId = actionId as PrivacyMaintenanceActionId
                          if (
                            action.destructive &&
                            !window.confirm(
                              t(locale, 'privacyActionConfirm', {
                                action: t(locale, action.i18nLabel)
                              })
                            )
                          ) {
                            return
                          }

                          setPrivacyBusyAction(confirmedActionId)
                          const response = await window.pecie.invokeSafe('privacy:runMaintenance', {
                            action: confirmedActionId,
                            workspaceDirectory: draft.workspaceDirectory,
                            projectPath: currentProjectPath
                          })
                          const refreshed = await window.pecie.invokeSafe('privacy:getInventory', {
                            workspaceDirectory: draft.workspaceDirectory,
                            projectPath: currentProjectPath
                          })
                          setPrivacyInventory(refreshed)
                          setPrivacyBusyAction(null)
                          setStatus(
                            t(locale, 'privacyActionDone', {
                              action: t(locale, action.i18nLabel),
                              reclaimed: formatFileSize(response.reclaimedBytes, locale)
                            })
                          )
                        }}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        {t(locale, action.i18nLabel)}
                      </Button>
                    </div>
                  ) : null}
                </article>
              )
            })}
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
