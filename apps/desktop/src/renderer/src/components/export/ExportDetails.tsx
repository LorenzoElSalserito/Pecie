import type { ExportProfileSupportDecision, ListExportProfilesResponse, RuntimeCapabilityReport, SupportedLocale } from '@pecie/schemas'

import { t } from '../../i18n'
import { getRuntimeCapabilityLabel } from '../settings/labels'

function formatRuntimeCapabilityList(locale: SupportedLocale, capabilityIds: RuntimeCapabilityReport['capabilityId'][]): string {
  return capabilityIds.map((capabilityId) => getRuntimeCapabilityLabel(locale, capabilityId)).join(', ')
}

/** Export log lines, announced assertively while an export runs. */
export function ExportLog({ locale, lines }: { locale: SupportedLocale; lines: string[] }): React.JSX.Element | null {
  if (lines.length === 0) return null
  return (
    <section className="context-card">
      <h3>{t(locale, 'export')}</h3>
      <ul aria-live="assertive" className="stack-list stack-list--tight">
        {lines.map((line) => (
          <li key={line}>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export type ExportProfileDetailsProps = {
  locale: SupportedLocale
  profile: ListExportProfilesResponse['profiles'][number] | undefined
  support: ExportProfileSupportDecision | null
  runtimeVersion: string | undefined
  diagnostics: ListExportProfilesResponse['diagnostics']
}

/** Technical detail card for the selected profile: source, runtime availability, engine, capabilities. */
export function ExportProfileDetails({ locale, profile, support, runtimeVersion, diagnostics }: ExportProfileDetailsProps): React.JSX.Element | null {
  if (!profile && diagnostics.length === 0) return null
  return (
    <section className="context-card">
      <h3>{t(locale, 'exportProfile')}</h3>
      {profile ? (
        <ul className="stack-list stack-list--tight">
          <li>
            <span>{profile.sourcePath}</span>
          </li>
          <li>
            <span>{`${t(locale, 'exportRuntimeAvailabilityLabel')}: ${support ? t(locale, `exportRuntimeAvailability_${support.availability}`) : t(locale, 'exportRuntimeAvailability_unknown')}`}</span>
          </li>
          {runtimeVersion ? (
            <li>
              <span>{`${t(locale, 'exportRuntimeVersion')}: ${runtimeVersion}`}</span>
            </li>
          ) : null}
          {profile.engine ? (
            <li>
              <span>{`${t(locale, 'exportEngine')}: ${profile.engine}`}</span>
            </li>
          ) : null}
          {profile.citationProfile ? (
            <li>
              <span>{`${t(locale, 'citationProfile')}: ${profile.citationProfile}`}</span>
            </li>
          ) : null}
          {support?.requiredCapabilities.length ? (
            <li>
              <span>{`${t(locale, 'exportRuntimeRequiredCapabilities')}: ${formatRuntimeCapabilityList(locale, support.requiredCapabilities)}`}</span>
            </li>
          ) : null}
          {support?.missingCapabilities.length ? (
            <li>
              <span>{`${t(locale, 'exportRuntimeMissingCapabilities')}: ${formatRuntimeCapabilityList(locale, support.missingCapabilities)}`}</span>
            </li>
          ) : null}
        </ul>
      ) : null}
      {diagnostics.length > 0 ? (
        <ul className="stack-list stack-list--tight">
          {diagnostics.map((diagnostic) => (
            <li key={`${diagnostic.profileId}-${diagnostic.sourcePath}`}>
              <span>{diagnostic.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
