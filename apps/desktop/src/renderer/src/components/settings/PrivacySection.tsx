import { useCallback, useEffect, useState } from 'react'

import type { PrivacyInventoryResponse, PrivacyMaintenanceActionId, SupportedLocale } from '@pecie/schemas'
import { privacyMaintenanceActions } from '@pecie/schemas'
import { Banner, Button } from '@pecie/ui'

import { t } from '../../i18n'
import { formatFileSize } from '../utils'

export function PrivacySection({
  id,
  locale,
  workspaceDirectory,
  currentProjectPath,
  showTechnicalDetails,
  onStatus
}: {
  id: string
  locale: SupportedLocale
  workspaceDirectory: string
  currentProjectPath?: string
  showTechnicalDetails: boolean
  onStatus: (message: string) => void
}): React.JSX.Element {
  const [privacyInventory, setPrivacyInventory] = useState<PrivacyInventoryResponse | null>(null)
  const [privacyLoading, setPrivacyLoading] = useState(false)
  const [privacyBusyAction, setPrivacyBusyAction] = useState<PrivacyMaintenanceActionId | null>(null)

  const load = useCallback(async () => {
    setPrivacyLoading(true)
    try {
      const response = await window.pecie.invokeSafe('privacy:getInventory', { workspaceDirectory, projectPath: currentProjectPath })
      setPrivacyInventory(response)
    } finally {
      setPrivacyLoading(false)
    }
  }, [currentProjectPath, workspaceDirectory])

  useEffect(() => {
    void load()
  }, [load])

  const privacyItems = privacyInventory?.items ?? []

  return (
    <section className="context-card" id={id}>
      <div className="context-card__heading">
        <div>
          <h3 tabIndex={-1}>{t(locale, 'privacyDashboardTitle')}</h3>
          <p>{t(locale, 'privacyDashboardBody')}</p>
        </div>
        <Button disabled={privacyLoading} onClick={() => void load()} size="sm" type="button" variant="secondary">
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
      {privacyLoading ? <Banner>{t(locale, 'privacyLoading')}</Banner> : null}
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
                      if (action.destructive && !window.confirm(t(locale, 'privacyActionConfirm', { action: t(locale, action.i18nLabel) }))) {
                        return
                      }
                      setPrivacyBusyAction(confirmedActionId)
                      const response = await window.pecie.invokeSafe('privacy:runMaintenance', { action: confirmedActionId, workspaceDirectory, projectPath: currentProjectPath })
                      const refreshed = await window.pecie.invokeSafe('privacy:getInventory', { workspaceDirectory, projectPath: currentProjectPath })
                      setPrivacyInventory(refreshed)
                      setPrivacyBusyAction(null)
                      onStatus(t(locale, 'privacyActionDone', { action: t(locale, action.i18nLabel), reclaimed: formatFileSize(response.reclaimedBytes, locale) }))
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
  )
}
