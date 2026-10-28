import { useState } from 'react'

import type { AppSettings, SupportedLocale } from '@pecie/schemas'
import { previewModes } from '@pecie/schemas'
import { Banner, Checkbox, Select } from '@pecie/ui'

import { t } from '../../i18n'

export function PreviewSection({ id, locale, draft, setDraft }: { id: string; locale: SupportedLocale; draft: AppSettings; setDraft: (settings: AppSettings) => void }): React.JSX.Element {
  const [previewDisclosureDismissed, setPreviewDisclosureDismissed] = useState(false)
  const previewMode = draft.preview.mode
  const previewModePolicy = previewModes[previewMode]
  const shouldShowPreviewDisclosure = !previewDisclosureDismissed && draft.preview.disclosuresSeen[previewMode] !== true
  return (
    <section className="context-card" id={id}>
      <h3 tabIndex={-1}>{t(locale, 'previewSettingsTitle')}</h3>
      <p>{t(locale, 'previewSettingsBody')}</p>
      <Select
        label={t(locale, 'previewModeLabel')}
        onChange={(event) => {
          const nextMode = event.target.value as typeof draft.preview.mode
          setDraft({ ...draft, preview: { ...draft.preview, mode: nextMode } })
          setPreviewDisclosureDismissed(false)
        }}
        value={previewMode}
      >
        {Object.entries(previewModes).map(([mode, policy]) => (
          <option key={mode} value={mode}>
            {t(locale, policy.shortLabelKey)}
          </option>
        ))}
      </Select>
      <Banner>{t(locale, previewModePolicy.helperKey)}</Banner>
      {shouldShowPreviewDisclosure ? (
        <div className="message-box">
          <p>{t(locale, previewModePolicy.disclosureKey)}</p>
          <Checkbox
            checked={draft.preview.disclosuresSeen[previewMode] === true}
            label={t(locale, 'previewDisclosureDismiss')}
            onChange={(event) =>
              setDraft({
                ...draft,
                preview: { ...draft.preview, disclosuresSeen: { ...draft.preview.disclosuresSeen, [previewMode]: event.target.checked } }
              })
            }
          />
        </div>
      ) : null}
    </section>
  )
}
