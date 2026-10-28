import { useCallback, useEffect, useState } from 'react'

import type { ListInstalledPluginsResponse, SupportedLocale } from '@pecie/schemas'
import { Banner, Button } from '@pecie/ui'

import { t } from '../../i18n'

export function PluginsSection({ id, locale, showTechnicalDetails }: { id: string; locale: SupportedLocale; showTechnicalDetails: boolean }): React.JSX.Element {
  const [pluginInventory, setPluginInventory] = useState<ListInstalledPluginsResponse | null>(null)
  const [pluginLoading, setPluginLoading] = useState(false)
  const [pluginError, setPluginError] = useState<string | null>(null)
  const [pluginBusyId, setPluginBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const installedPlugins = pluginInventory?.plugins ?? []
  const pluginDiagnostics = pluginInventory?.diagnostics ?? []
  const enabledPluginCount = installedPlugins.filter((plugin) => plugin.enabled).length

  return (
    <section className="context-card" id={id}>
      <div className="context-card__heading">
        <div>
          <h3 tabIndex={-1}>{t(locale, 'pluginManagerTitle')}</h3>
          <p>{t(locale, 'pluginManagerBody')}</p>
        </div>
        <Button disabled={pluginLoading} onClick={() => void load()} size="sm" type="button" variant="secondary">
          {t(locale, 'pluginManagerRefresh')}
        </Button>
      </div>
      <Banner>{t(locale, showTechnicalDetails ? 'pluginManagerDisclosure' : 'pluginManagerStandardDisclosure')}</Banner>
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
      {pluginLoading ? <Banner>{t(locale, 'pluginManagerLoading')}</Banner> : null}
      {pluginError ? <Banner role="alert">{pluginError}</Banner> : null}
      {!pluginLoading && installedPlugins.length === 0 && pluginDiagnostics.length === 0 ? <p>{t(locale, 'pluginManagerEmpty')}</p> : null}
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
                      const response = await window.pecie.invokeSafe('plugins:setEnabled', { pluginId: plugin.manifest.id, enabled: nextEnabled })
                      setPluginInventory((current) => {
                        if (!current) {
                          return { plugins: [response.plugin], diagnostics: response.diagnostics }
                        }
                        return {
                          plugins: current.plugins.map((entry) => (entry.manifest.id === response.plugin.manifest.id ? response.plugin : entry)),
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
                  <span>
                    {plugin.manifest.permissions.length} {t(locale, 'pluginManagerPermissions')}
                  </span>
                  <span>
                    {plugin.manifest.hooks.length} {t(locale, 'pluginManagerHooks')}
                  </span>
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
        {showTechnicalDetails
          ? pluginDiagnostics.map((diagnostic) => (
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
            ))
          : null}
      </div>
    </section>
  )
}
