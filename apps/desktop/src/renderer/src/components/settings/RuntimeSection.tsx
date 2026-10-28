import { useCallback, useEffect, useState } from 'react'

import type { GetRuntimeCapabilitiesResponse, SupportedLocale } from '@pecie/schemas'
import { Banner, Button } from '@pecie/ui'

import { t } from '../../i18n'
import { getRuntimeCapabilityLabel } from './labels'

export function RuntimeSection({ id, locale, showTechnicalDetails }: { id: string; locale: SupportedLocale; showTechnicalDetails: boolean }): React.JSX.Element {
  const [runtimeCapabilities, setRuntimeCapabilities] = useState<GetRuntimeCapabilitiesResponse['capabilities']>([])
  const [runtimeVersion, setRuntimeVersion] = useState<string | undefined>(undefined)
  const [runtimeLoading, setRuntimeLoading] = useState(false)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setRuntimeLoading(true)
    try {
      const response = await window.pecie.invokeSafe('export:getRuntimeCapabilities', {})
      setRuntimeCapabilities(response.capabilities)
      setRuntimeVersion(response.runtimeVersion)
      setRuntimeError(null)
    } catch (error: unknown) {
      setRuntimeCapabilities([])
      setRuntimeVersion(undefined)
      setRuntimeError(error instanceof Error ? error.message : 'Unable to load export components.')
    } finally {
      setRuntimeLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const availableCapabilities = runtimeCapabilities.filter((capability) => capability.status === 'available')
  const bundledCapabilities = availableCapabilities.filter((capability) => capability.source === 'bundled')
  const missingAddonCapabilities = runtimeCapabilities.filter(
    (capability) =>
      capability.status !== 'available' &&
      (capability.distribution === 'bundled-sidecar' || capability.distribution === 'system-addon' || capability.distribution === 'manual-addon')
  )
  const runtimeGuidanceKey = missingAddonCapabilities.length > 0 ? 'exportRuntimeSettingsAddonBody' : 'exportRuntimeSettingsReadyBody'

  return (
    <section className="context-card" id={id}>
      <div className="context-card__heading">
        <div>
          <h3 tabIndex={-1}>{t(locale, 'exportRuntimeSettingsTitle')}</h3>
          <p>{t(locale, 'exportRuntimeSettingsBody')}</p>
        </div>
        <Button disabled={runtimeLoading} onClick={() => void load()} size="sm" type="button" variant="secondary">
          {t(locale, 'exportRuntimeRefresh')}
        </Button>
      </div>
      <Banner>{t(locale, runtimeGuidanceKey)}</Banner>
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
      {runtimeLoading ? <Banner>{t(locale, 'exportRuntimeLoading')}</Banner> : null}
      {runtimeError ? <Banner role="alert">{runtimeError}</Banner> : null}
      {!runtimeLoading && runtimeCapabilities.length === 0 ? <p>{t(locale, 'exportRuntimeInventoryEmpty')}</p> : null}
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
  )
}
