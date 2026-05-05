import { useEffect, useState } from 'react'

import { Button, Dialog } from '@pecie/ui'
import type {
  GetRuntimeCapabilitiesResponse,
  ListInstalledPluginsResponse,
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
  const [pluginInventory, setPluginInventory] = useState<ListInstalledPluginsResponse | null>(null)
  const [pluginLoading, setPluginLoading] = useState(false)
  const [pluginError, setPluginError] = useState<string | null>(null)
  const [pluginBusyId, setPluginBusyId] = useState<string | null>(null)

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
      setPluginInventory(null)
      setPluginLoading(false)
      setPluginError(null)
      setPluginBusyId(null)
      return
    }

    setPrivacyLoading(true)
    setRuntimeLoading(true)
    setPluginLoading(true)
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
    void window.pecie
      .invokeSafe('plugins:listInstalled', {})
      .then((response) => {
        setPluginInventory(response)
        setPluginError(null)
      })
      .catch((error: unknown) => {
        setPluginInventory(null)
        setPluginError(error instanceof Error ? error.message : 'Unable to load installed plugins.')
      })
      .finally(() => setPluginLoading(false))
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
  const installedPlugins = pluginInventory?.plugins ?? []
  const pluginDiagnostics = pluginInventory?.diagnostics ?? []
  const enabledPluginCount = installedPlugins.filter((plugin) => plugin.enabled).length
  const showTechnicalDetails = draft.expertModeEnabled
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
          <p>{t(locale, draft.expertModeEnabled ? 'expertModeEnabled' : 'expertModeDisabled')}</p>
          {showTechnicalDetails ? (
            <div className="privacy-inventory">
              {expertCapabilityEntries.map(([capabilityId, capability]) => (
                <article className="privacy-item-card" key={capabilityId}>
                  <div className="privacy-item-card__header">
                    <div>
                      <h4>{getExpertCapabilityLabel(locale, capabilityId)}</h4>
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
          ) : null}
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
                  </div>
                  <strong>{t(locale, `exportRuntimeCapabilityStatus_${capability.status}`)}</strong>
                </div>
                {showTechnicalDetails ? (
                  <div className="privacy-item-card__meta">
                    <span>{t(locale, `exportRuntimeCapabilitySource_${capability.source}`)}</span>
                    <span>{t(locale, `exportRuntimeDistribution_${capability.distribution}`)}</span>
                    <span>{capability.version ?? t(locale, 'exportRuntimeCapabilityVersionMissing')}</span>
                  </div>
                ) : null}
                <p>{t(locale, `exportRuntimeCapabilityHelp_${capability.capabilityId}`)}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="context-card">
          <div className="context-card__heading">
            <div>
              <h3>{t(locale, 'pluginManagerTitle')}</h3>
              <p>{t(locale, 'pluginManagerBody')}</p>
            </div>
            <Button
              disabled={pluginLoading}
              onClick={async () => {
                setPluginLoading(true)
                try {
                  const response = await window.pecie.invokeSafe('plugins:listInstalled', {})
                  setPluginInventory(response)
                  setPluginError(null)
                } catch (error: unknown) {
                  setPluginInventory(null)
                  setPluginError(error instanceof Error ? error.message : 'Unable to load installed plugins.')
                } finally {
                  setPluginLoading(false)
                }
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {t(locale, 'pluginManagerRefresh')}
            </Button>
          </div>
          <p className="message-box" role="status">
            {t(locale, showTechnicalDetails ? 'pluginManagerDisclosure' : 'pluginManagerStandardDisclosure')}
          </p>
          {pluginInventory ? (
            <dl className="meta-list">
              <div>
                <dt>{t(locale, 'pluginManagerInstalledCount')}</dt>
                <dd>{installedPlugins.length}</dd>
              </div>
              <div>
                <dt>{t(locale, 'pluginManagerEnabledCount')}</dt>
                <dd>{enabledPluginCount}</dd>
              </div>
              {showTechnicalDetails ? (
                <div>
                  <dt>{t(locale, 'pluginManagerDiagnosticCount')}</dt>
                  <dd>{pluginDiagnostics.length}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {pluginLoading ? <p className="message-box">{t(locale, 'pluginManagerLoading')}</p> : null}
          {pluginError ? <p className="message-box" role="alert">{pluginError}</p> : null}
          {!pluginLoading && installedPlugins.length === 0 && pluginDiagnostics.length === 0 ? (
            <p>{t(locale, 'pluginManagerEmpty')}</p>
          ) : null}
          <div className="privacy-inventory">
            {installedPlugins.map((plugin) => (
              <article className="privacy-item-card" key={plugin.manifest.id}>
                <div className="privacy-item-card__header">
                  <div>
                    <h4>{plugin.manifest.label}</h4>
                  </div>
                  <div className="dialog-actions dialog-actions--inline">
                    <strong>{t(locale, plugin.enabled ? 'pluginManagerEnabled' : 'pluginManagerDisabled')}</strong>
                    <Button
                      disabled={pluginBusyId === plugin.manifest.id}
                      onClick={async () => {
                        const nextEnabled = !plugin.enabled
                        setPluginBusyId(plugin.manifest.id)
                        try {
                          const response = await window.pecie.invokeSafe('plugins:setEnabled', {
                            pluginId: plugin.manifest.id,
                            enabled: nextEnabled
                          })
                          setPluginInventory((current) => {
                            if (!current) {
                              return {
                                plugins: [response.plugin],
                                diagnostics: response.diagnostics
                              }
                            }

                            return {
                              plugins: current.plugins.map((entry) =>
                                entry.manifest.id === response.plugin.manifest.id ? response.plugin : entry
                              ),
                              diagnostics: response.diagnostics
                            }
                          })
                          setPluginError(null)
                        } catch (error: unknown) {
                          setPluginError(error instanceof Error ? error.message : 'Unable to update plugin state.')
                        } finally {
                          setPluginBusyId(null)
                        }
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {t(locale, plugin.enabled ? 'pluginManagerDisable' : 'pluginManagerEnable')}
                    </Button>
                  </div>
                </div>
                <div className="privacy-item-card__meta">
                  <span>{plugin.manifest.version}</span>
                  {showTechnicalDetails ? (
                    <>
                      <span>{plugin.manifest.permissions.length} {t(locale, 'pluginManagerPermissions')}</span>
                      <span>{plugin.manifest.hooks.length} {t(locale, 'pluginManagerHooks')}</span>
                    </>
                  ) : null}
                </div>
                {plugin.manifest.description ? <p>{plugin.manifest.description}</p> : null}
                {showTechnicalDetails ? (
                  <dl className="meta-list">
                    <div>
                      <dt>{t(locale, 'pluginManagerPluginId')}</dt>
                      <dd className="meta-list__mono">{plugin.manifest.id}</dd>
                    </div>
                    <div>
                      <dt>{t(locale, 'pluginManagerEntryPoint')}</dt>
                      <dd className="meta-list__mono">{plugin.manifest.entryPoint}</dd>
                    </div>
                    <div>
                      <dt>{t(locale, 'pluginManagerSourcePath')}</dt>
                      <dd className="meta-list__mono">{plugin.sourcePath}</dd>
                    </div>
                    <div>
                      <dt>{t(locale, 'pluginManagerPermissions')}</dt>
                      <dd className="meta-list__mono">{plugin.manifest.permissions.join(', ')}</dd>
                    </div>
                    <div>
                      <dt>{t(locale, 'pluginManagerHooks')}</dt>
                      <dd className="meta-list__mono">{plugin.manifest.hooks.join(', ')}</dd>
                    </div>
                  </dl>
                ) : null}
              </article>
            ))}
            {showTechnicalDetails ? pluginDiagnostics.map((diagnostic) => (
              <article className="privacy-item-card" key={diagnostic.sourcePath}>
                <div className="privacy-item-card__header">
                  <div>
                    <h4>{t(locale, 'pluginManagerDiagnosticTitle')}</h4>
                    <p className="meta-list__mono">{diagnostic.sourcePath}</p>
                  </div>
                  <strong>{diagnostic.severity}</strong>
                </div>
                <p>{diagnostic.message}</p>
              </article>
            )) : null}
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
                      {showTechnicalDetails ? <p className="meta-list__mono">{item.relativePath}</p> : null}
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
            <span>{t(locale, 'localDataFolderHidden')}</span>
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
            <span>{t(locale, 'prepareUninstallLocalDataHint')}</span>
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
