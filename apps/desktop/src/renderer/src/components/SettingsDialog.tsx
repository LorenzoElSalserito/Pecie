import { useEffect, useMemo, useRef, useState } from 'react'

import { Button, Dialog } from '@pecie/ui'

import { t } from '../i18n'
import { AuthorFields, WorkspaceFields } from './SetupWizard'
import { ExpertModeSection } from './settings/ExpertModeSection'
import { PluginsSection } from './settings/PluginsSection'
import { PreviewSection } from './settings/PreviewSection'
import { PrivacySection } from './settings/PrivacySection'
import { RuntimeSection } from './settings/RuntimeSection'
import { SettingsSectionNav, type SettingsSection } from './settings/SettingsSectionNav'
import { SupportSection } from './settings/SupportSection'
import type { SettingsDialogProps } from './types'

/**
 * Settings: workspace and profile first, then one card per concern. Two panes: the section nav
 * stays fixed beside (or, on narrow windows, above) the only scrolling region, so content never
 * slides under it. Every section owns its own state and loads its data when the dialog mounts;
 * the nav jumps without hiding anything, so every control stays reachable by keyboard and by the
 * tutorials. Header and actions stay visible while the sections scroll.
 */
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
  const paneRef = useRef<HTMLDivElement>(null)
  const locale = draft.locale
  const sections = useMemo<SettingsSection[]>(
    () => [
      { id: 'settings-section-workspace', label: t(locale, 'stepWorkspace'), icon: 'folder2-open' },
      { id: 'settings-section-profile', label: t(locale, 'stepAuthor'), icon: 'person' },
      { id: 'settings-section-expert', label: t(locale, 'expertModeTitle'), icon: 'mortarboard' },
      { id: 'settings-section-preview', label: t(locale, 'previewSettingsTitle'), icon: 'eye' },
      {
        id: 'settings-section-runtime',
        label: t(locale, 'exportRuntimeSettingsTitle'),
        icon: 'box-arrow-up'
      },
      { id: 'settings-section-plugins', label: t(locale, 'pluginManagerTitle'), icon: 'puzzle' },
      { id: 'settings-section-support', label: t(locale, 'sendBugReport'), icon: 'bug' },
      {
        id: 'settings-section-privacy',
        label: t(locale, 'privacyDashboardTitle'),
        icon: 'shield-lock'
      }
    ],
    [locale]
  )

  useEffect(() => {
    if (open) {
      setDraft(settings)
      setStatus(null)
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

  if (!open) {
    return null
  }

  const showTechnicalDetails = draft.expertModeEnabled

  return (
    <Dialog
      className="settings-dialog"
      icon="gear"
      onClose={onClose}
      open={open}
      size="wide"
      title={t(locale, 'settings')}
    >
      <div className="settings-layout">
        <SettingsSectionNav
          label={t(locale, 'settingsSectionsNav')}
          scrollRoot={paneRef}
          sections={sections}
        />
        <div className="settings-pane" ref={paneRef}>
          <section className="context-card" id="settings-section-workspace">
            <h3 tabIndex={-1}>{t(locale, 'stepWorkspace')}</h3>
            <WorkspaceFields locale={locale} setSettings={setDraft} settings={draft} />
          </section>
          <section className="context-card" id="settings-section-profile">
            <h3 tabIndex={-1}>{t(locale, 'stepAuthor')}</h3>
            <AuthorFields locale={locale} setSettings={setDraft} settings={draft} />
          </section>
          <ExpertModeSection
            draft={draft}
            id="settings-section-expert"
            locale={locale}
            setDraft={setDraft}
          />
          <PreviewSection
            draft={draft}
            id="settings-section-preview"
            locale={locale}
            setDraft={setDraft}
          />
          <RuntimeSection
            id="settings-section-runtime"
            locale={locale}
            showTechnicalDetails={showTechnicalDetails}
          />
          <PluginsSection
            id="settings-section-plugins"
            locale={locale}
            showTechnicalDetails={showTechnicalDetails}
          />
          <SupportSection
            appDataDirectory={appDataDirectory}
            currentProjectPath={currentProjectPath}
            id="settings-section-support"
            locale={locale}
            onPrepareUninstall={onPrepareUninstall}
            onStatus={setStatus}
            status={status}
          />
          <PrivacySection
            currentProjectPath={currentProjectPath}
            id="settings-section-privacy"
            locale={locale}
            onStatus={setStatus}
            showTechnicalDetails={showTechnicalDetails}
            workspaceDirectory={draft.workspaceDirectory}
          />
        </div>
      </div>
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
    </Dialog>
  )
}
