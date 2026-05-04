import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@pecie/ui'

import appIcon from '../asset/Icon.svg'
import { SUPPORTED_LOCALES, localeLabel, t } from '../i18n'
import type { LauncherProps, TemplateId } from './types'
import { templateIds } from './types'
import {
  defaultComposer,
  formatTemplateBestFor,
  formatTemplateDescription,
  formatTemplateLabel,
  formatTemplateOutcome,
  formatTemplateStructure,
  getGreeting,
  slugify,
  stringAccentColor
} from './utils'

const templateIcons: Record<TemplateId, string> = {
  blank: 'bi-plus-square',
  thesis: 'bi-mortarboard',
  paper: 'bi-journal-text',
  book: 'bi-book',
  manual: 'bi-journal-code',
  journal: 'bi-newspaper',
  article: 'bi-file-earmark-richtext',
  videoScript: 'bi-camera-video',
  screenplay: 'bi-film'
}

export function Launcher({
  settings,
  quickResume,
  onOpenGuide,
  onOpenInfo,
  onOpenProjectLibrary,
  onOpenProjectDialog,
  onOpenSettings,
  onOpenRecentProject,
  onProjectCreated
}: LauncherProps): React.JSX.Element {
  const locale = settings.locale
  const [draft, setDraft] = useState(() => defaultComposer(settings))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [titleExampleIndex, setTitleExampleIndex] = useState(0)

  useEffect(() => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      directory: settings.workspaceDirectory,
      language: settings.locale
    }))
  }, [settings.locale, settings.workspaceDirectory])

  const hasRecent = settings.recentProjectPaths.length > 0
  const lastProject = hasRecent ? settings.recentProjectPaths[0] : null
  const lastProjectName = lastProject?.split('/').at(-1) ?? ''
  const greeting = getGreeting(locale)
  const quickResumeDetails = quickResume && quickResume.projectPath === lastProject ? quickResume : undefined
  const quickResumeDate = quickResumeDetails
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(quickResumeDetails.lastEditedAt))
    : null
  const selectedTemplateGuidance = useMemo(
    () => ({
      label: formatTemplateLabel(locale, draft.template),
      bestFor: formatTemplateBestFor(locale, draft.template),
      structure: formatTemplateStructure(locale, draft.template),
      outcome: formatTemplateOutcome(locale, draft.template)
    }),
    [draft.template, locale]
  )
  const titleExamples = useMemo(
    () => [
      t(locale, 'projectTitleExample1'),
      t(locale, 'projectTitleExample2'),
      t(locale, 'projectTitleExample3'),
      t(locale, 'projectTitleExample4'),
      t(locale, 'projectTitleExample5')
    ],
    [locale]
  )

  useEffect(() => {
    if (draft.title.trim()) {
      return
    }

    const interval = window.setInterval(() => {
      setTitleExampleIndex((current) => (current + 1) % titleExamples.length)
    }, 3200)

    return () => window.clearInterval(interval)
  }, [draft.title, titleExamples.length])

  return (
    <main className="launcher-shell">
      <section className="launcher-main">
        {/* ── Hero + Quick Resume ── */}
        <div className="launcher-main__header">
          <div className="launcher-hero">
            <div className="launcher-hero__brand">
              <img alt="" className="brand-mark launcher-brand-mark fade-in-up" src={appIcon} />
              <div className="launcher-hero__copy">
                <p className="launcher-hero__greeting fade-in-up">{greeting}</p>
                <h1 className="launcher-hero__tagline fade-in-up">{t(locale, 'heroTagline')}</h1>
                <p className="launcher-hero__subtitle fade-in-up">{t(locale, 'heroSubtitle')}</p>
              </div>
            </div>
          </div>
          <div className="launcher-main__actions">
            <div className="launcher-main__action-group">
              <Button onClick={onOpenProjectLibrary} size="sm" variant="secondary">
                {t(locale, 'manageProjects')}
              </Button>
              <Button data-tutorial-id="launcher-open-project" onClick={onOpenProjectDialog} size="sm" variant="secondary">
                {t(locale, 'openExisting')}
              </Button>
            </div>
            <div className="launcher-main__action-group launcher-main__action-group--minor">
              <Button onClick={onOpenGuide} size="sm" variant="ghost">
                {t(locale, 'quickGuideTitle')}
              </Button>
              <Button onClick={onOpenInfo} size="sm" variant="ghost">
                {t(locale, 'info')}
              </Button>
              <Button data-tutorial-id="launcher-open-settings" onClick={onOpenSettings} size="sm" variant="ghost">
                {t(locale, 'settings')}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Quick Resume Banner ── */}
        {lastProject ? (
          <button
            className="quick-resume-banner"
            onClick={() => void onOpenRecentProject(lastProject)}
            type="button"
          >
            <div className="quick-resume-banner__copy">
              <span className="eyebrow">{t(locale, 'quickResume')}</span>
              <strong>{lastProjectName}</strong>
              {quickResumeDetails ? (
                <>
                  <span className="quick-resume-banner__snippet">{quickResumeDetails.lastEditedSnippet}</span>
                  {quickResumeDate ? <time className="quick-resume-banner__date">{quickResumeDate}</time> : null}
                </>
              ) : null}
            </div>
            <span className="quick-resume-banner__cta">
              {t(locale, 'continueWriting')}
              <i aria-hidden="true" className="bi bi-arrow-right"></i>
            </span>
          </button>
        ) : null}

        {/* ── Project Composer ── */}
        <div className="launcher-composer">
          <div className="launcher-composer__main">
            <section className="context-card context-card--soft">
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="eyebrow">{t(locale, 'projectBasics')}</p>
                  <h2>{t(locale, 'projectBasicsTitle')}</h2>
                </div>
              </div>
              <div className="dialog-form">
                <div className="field-grid field-grid--single">
                  <label className="field">
                    <span>{t(locale, 'projectTitle')}</span>
                    <div className="field-input-shell">
                      <input
                        data-tutorial-id="launcher-project-title"
                        className="field-input--hero"
                        placeholder=""
                        value={draft.title}
                        onChange={(event) =>
                          setDraft((currentDraft) => ({
                            ...currentDraft,
                            title: event.target.value,
                            projectName:
                              !currentDraft.projectName || currentDraft.projectName === slugify(currentDraft.title)
                                ? slugify(event.target.value)
                                : currentDraft.projectName
                          }))
                        }
                      />
                      {!draft.title.trim() ? (
                        <span
                          aria-hidden="true"
                          className="field-input-shell__placeholder field-input-shell__placeholder--animated"
                          key={`${locale}-${titleExampleIndex}`}
                        >
                          {titleExamples[titleExampleIndex]}
                        </span>
                      ) : null}
                    </div>
                  </label>
                </div>

                {/* ── Template Picker Cards ── */}
                <div className="field">
                  <span>{t(locale, 'template')}</span>
                  <div
                    className="template-card-grid"
                    role="radiogroup"
                    aria-label={t(locale, 'template')}
                    data-tutorial-id="launcher-template-picker"
                  >
                    {templateIds.map((templateId) => (
                      <button
                        key={templateId}
                        aria-checked={draft.template === templateId}
                        className={`template-card${draft.template === templateId ? ' template-card--selected' : ''}`}
                        onClick={() => setDraft({ ...draft, template: templateId })}
                        role="radio"
                        type="button"
                      >
                        <i aria-hidden="true" className={`bi ${templateIcons[templateId]} template-card__icon`}></i>
                        <strong>{formatTemplateLabel(locale, templateId)}</strong>
                        <small>{formatTemplateDescription(locale, templateId)}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <section className="context-card context-card--soft template-guidance-card" aria-live="polite">
                  <div className="section-heading section-heading--compact">
                    <div>
                      <p className="eyebrow">{t(locale, 'templateGuidanceEyebrow')}</p>
                      <h3>{selectedTemplateGuidance.label}</h3>
                    </div>
                    <span className="status-pill">{t(locale, 'template')}</span>
                  </div>
                  <dl className="meta-list">
                    <div>
                      <dt>{t(locale, 'templateGuidanceBestFor')}</dt>
                      <dd>{selectedTemplateGuidance.bestFor}</dd>
                    </div>
                    <div>
                      <dt>{t(locale, 'templateGuidanceStructure')}</dt>
                      <dd>{selectedTemplateGuidance.structure}</dd>
                    </div>
                    <div>
                      <dt>{t(locale, 'templateGuidanceOutcome')}</dt>
                      <dd>{selectedTemplateGuidance.outcome}</dd>
                    </div>
                  </dl>
                </section>

                <div className="field-grid">
                  <label className="field">
                    <span>{t(locale, 'projectLanguage')}</span>
                    <select value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value as typeof draft.language })}>
                      {SUPPORTED_LOCALES.map((supportedLocale) => (
                        <option key={supportedLocale} value={supportedLocale}>
                          {localeLabel(supportedLocale)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="field launcher-cta-field">
                    <span aria-hidden="true">&nbsp;</span>
                    <Button
                      data-tutorial-id="launcher-create-project"
                      disabled={busy || !draft.title.trim() || !draft.projectName.trim() || !draft.directory.trim()}
                      onClick={async () => {
                        setBusy(true)
                        setError(null)
                        try {
                          const project = await window.pecie.invokeSafe('project:create', {
                            directory: draft.directory,
                            projectName: draft.projectName.trim(),
                            title: draft.title.trim(),
                            language: draft.language,
                            template: draft.template,
                            authorProfile: settings.authorProfile
                          })
                          onProjectCreated(project)
                        } catch (caughtError) {
                          setError(caughtError instanceof Error ? caughtError.message : '')
                        } finally {
                          setBusy(false)
                        }
                      }}
                      size="lg"
                      type="button"
                    >
                      <i aria-hidden="true" className="bi bi-pen"></i>
                      {busy ? t(locale, 'createProject') : t(locale, 'startWriting')}
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <div className="launcher-meta-grid">
              <section className="context-card">
                <h3>{t(locale, 'projectSummary')}</h3>
                <dl className="meta-list">
                  <div>
                    <dt>{t(locale, 'template')}</dt>
                    <dd>{formatTemplateLabel(locale, draft.template)}</dd>
                  </div>
                  <div>
                    <dt>{t(locale, 'projectLanguage')}</dt>
                    <dd>{localeLabel(draft.language)}</dd>
                  </div>
                  <div>
                    <dt>{t(locale, 'projectFolderName')}</dt>
                    <dd className="meta-list__mono">{`${draft.projectName || 'project'}.pe`}</dd>
                  </div>
                </dl>
              </section>

              <section className="context-card">
                <div className="section-heading section-heading--compact launcher-author-card__header">
                  <div>
                    <h3>{t(locale, 'authorProfileReady')}</h3>
                  </div>
                  <Button onClick={onOpenSettings} size="sm" type="button" variant="ghost">
                    {t(locale, 'editAuthorProfile')}
                  </Button>
                </div>
                <dl className="meta-list">
                  <div>
                    <dt>{t(locale, 'authorName')}</dt>
                    <dd>{settings.authorProfile.name}</dd>
                  </div>
                  <div>
                    <dt>{t(locale, 'authorRole')}</dt>
                    <dd>{t(locale, `role${settings.authorProfile.role[0].toUpperCase()}${settings.authorProfile.role.slice(1)}`)}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        </div>

        {error ? (
          <p className="message-box message-box--error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <aside className="launcher-side">
        <section className="context-card context-card--soft">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">{t(locale, 'projectDestination')}</p>
              <h2>{t(locale, 'projectDestinationTitle')}</h2>
            </div>
          </div>
          <div className="dialog-form">
            <div className="field-grid field-grid--single">
              <label className="field">
                <span>{t(locale, 'destinationDirectory')}</span>
                <div className="field-with-action">
                  <input
                    data-tutorial-id="launcher-destination-directory"
                    value={draft.directory}
                    onChange={(event) => setDraft({ ...draft, directory: event.target.value })}
                  />
                  <Button
                    onClick={async () => {
                      const result = await window.pecie.invokeSafe('path:pickDirectory', {
                        defaultPath: draft.directory || settings.workspaceDirectory
                      })
                      if (!result.canceled && result.path) {
                        setDraft({ ...draft, directory: result.path })
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

              <label className="field">
                <span>{t(locale, 'projectFolderName')}</span>
                <input value={draft.projectName} onChange={(event) => setDraft({ ...draft, projectName: event.target.value })} />
                <small className="field-hint">{`${draft.projectName || 'project'}.pe`}</small>
              </label>

              <div className="context-card">
                <h3>{t(locale, 'workspaceCurrent')}</h3>
                <p className="meta-list__mono">{settings.workspaceDirectory}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="context-card">
          <h3>{t(locale, 'recentProjects')}</h3>
          {settings.recentProjectPaths.length > 0 ? (
            <div className="recent-list">
              {settings.recentProjectPaths.map((recentProjectPath) => (
                <button
                  key={recentProjectPath}
                  className="recent-list__item"
                  onClick={() => void onOpenRecentProject(recentProjectPath)}
                  style={{ '--recent-accent': stringAccentColor(recentProjectPath.split('/').at(-1) ?? recentProjectPath) } as CSSProperties}
                  type="button"
                >
                  <div className="recent-list__identity">
                    <i aria-hidden="true" className="bi bi-folder2-open recent-list__icon"></i>
                    <div>
                      <strong>{recentProjectPath.split('/').at(-1)}</strong>
                      <span>{recentProjectPath}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p>{t(locale, 'noRecentProjects')}</p>
          )}
        </section>

      </aside>
    </main>
  )
}
