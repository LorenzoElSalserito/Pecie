import type { AppSettings, SupportedLocale } from '@pecie/schemas'
import { expertCapabilities } from '@pecie/schemas'
import { Banner, Checkbox } from '@pecie/ui'

import { t } from '../../i18n'
import { getExpertCapabilityLabel } from './labels'

const expertCapabilityEntries = Object.entries(expertCapabilities) as Array<[keyof typeof expertCapabilities, (typeof expertCapabilities)[keyof typeof expertCapabilities]]>

export function ExpertModeSection({ id, locale, draft, setDraft }: { id: string; locale: SupportedLocale; draft: AppSettings; setDraft: (settings: AppSettings) => void }): React.JSX.Element {
  return (
    <section className="context-card" id={id}>
      <h3 tabIndex={-1}>{t(locale, 'expertModeTitle')}</h3>
      <p>{t(locale, 'expertModeBody')}</p>
      <Banner role="alert">{t(locale, 'expertModeDisclosure')}</Banner>
      <Checkbox checked={draft.expertModeEnabled} label={t(locale, 'expertModeToggle')} onChange={(event) => setDraft({ ...draft, expertModeEnabled: event.target.checked })} />
      <p>{t(locale, draft.expertModeEnabled ? 'expertModeEnabled' : 'expertModeDisabled')}</p>
      {draft.expertModeEnabled ? (
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
  )
}
