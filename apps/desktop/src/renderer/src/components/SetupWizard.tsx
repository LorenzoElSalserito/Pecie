import { useEffect, useRef, useState } from 'react'

import type { AppFontPreference, AppSettings, AuthorProfile, SupportedLocale } from '@pecie/schemas'
import { Button, type ThemeMode } from '@pecie/ui'

import appIcon from '../asset/Icon.svg'
import { SUPPORTED_LOCALES, localeLabel, t } from '../i18n'
import type { AuthorFieldsProps, SetupWizardProps, WorkspaceFieldsProps } from './types'
import { authorRoles } from './types'

const UI_ZOOM_OPTIONS = [50, 75, 100, 125, 150] as const

export function WorkspaceFields({ locale, settings, setSettings }: WorkspaceFieldsProps): React.JSX.Element {
  return (
    <div className="dialog-block">
      <div className="field-grid">
        <label className="field">
          <span>{t(locale, 'workspaceLabel')}</span>
          <div className="field-with-action">
            <input
              value={settings.workspaceDirectory}
              onChange={(event) => setSettings({ ...settings, workspaceDirectory: event.target.value })}
            />
            <Button
              onClick={async () => {
                const result = await window.pecie.invokeSafe('path:pickDirectory', {
                  defaultPath: settings.workspaceDirectory
                })
                if (!result.canceled && result.path) {
                  setSettings({ ...settings, workspaceDirectory: result.path })
                }
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {t(locale, 'browse')}
            </Button>
          </div>
          <small className="field-hint">{t(locale, 'workspaceHelp')}</small>
        </label>

        <label className="field">
          <span>{t(locale, 'uiLanguage')}</span>
          <select
            value={settings.locale}
            onChange={(event) =>
              setSettings({
                ...settings,
                locale: event.target.value as SupportedLocale,
                authorProfile: {
                  ...settings.authorProfile,
                  preferredLanguage: event.target.value as SupportedLocale
                }
              })
            }
          >
            {SUPPORTED_LOCALES.map((supportedLocale) => (
              <option key={supportedLocale} value={supportedLocale}>
                {localeLabel(supportedLocale)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span>{t(locale, 'theme')}</span>
        <select value={settings.theme} onChange={(event) => setSettings({ ...settings, theme: event.target.value as ThemeMode })}>
          <option value="light">{t(locale, 'themeLight')}</option>
          <option value="dark">{t(locale, 'themeDark')}</option>
          <option value="system">{t(locale, 'themeSystem')}</option>
        </select>
      </label>

      <label className="field">
        <span>{t(locale, 'fontPreference')}</span>
        <select
          value={settings.fontPreference}
          onChange={(event) =>
            setSettings({
              ...settings,
              fontPreference: event.target.value as AppFontPreference
            })
          }
        >
          <option value="classic">{t(locale, 'fontClassic')}</option>
          <option value="dyslexic">{t(locale, 'fontDyslexic')}</option>
        </select>
      </label>

      <label className="field">
        <span>{t(locale, 'uiZoom')}</span>
        <select
          value={settings.uiZoom}
          onChange={(event) =>
            setSettings({
              ...settings,
              uiZoom: Number(event.target.value) as AppSettings['uiZoom']
            })
          }
        >
          {UI_ZOOM_OPTIONS.map((zoom) => (
            <option key={zoom} value={zoom}>
              {zoom}%
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export function AuthorFields({ locale, settings, setSettings, nameError }: AuthorFieldsProps): React.JSX.Element {
  return (
    <div className="dialog-block">
      <div className="field-grid">
        <label className="field">
          <span>{t(locale, 'authorName')}</span>
          <input
            aria-describedby={nameError ? 'setup-author-name-error' : undefined}
            aria-invalid={nameError ? 'true' : 'false'}
            required
            value={settings.authorProfile.name}
            onChange={(event) =>
              setSettings({
                ...settings,
                authorProfile: { ...settings.authorProfile, name: event.target.value }
              })
            }
          />
          {nameError ? (
            <small className="field-error" id="setup-author-name-error">
              {nameError}
            </small>
          ) : null}
        </label>

        <label className="field">
          <span>{t(locale, 'authorRole')}</span>
          <select
            value={settings.authorProfile.role}
            onChange={(event) =>
              setSettings({
                ...settings,
                authorProfile: { ...settings.authorProfile, role: event.target.value as AuthorProfile['role'] }
              })
            }
          >
            {authorRoles.map((role) => (
              <option key={role} value={role}>
                {t(locale, `role${role[0].toUpperCase()}${role.slice(1)}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>{t(locale, 'institution')}</span>
          <input
            value={settings.authorProfile.institutionName ?? ''}
            onChange={(event) =>
              setSettings({
                ...settings,
                authorProfile: { ...settings.authorProfile, institutionName: event.target.value || undefined }
              })
            }
          />
        </label>

        <label className="field">
          <span>{t(locale, 'department')}</span>
          <input
            value={settings.authorProfile.department ?? ''}
            onChange={(event) =>
              setSettings({
                ...settings,
                authorProfile: { ...settings.authorProfile, department: event.target.value || undefined }
              })
            }
          />
        </label>
      </div>
    </div>
  )
}

export function SetupWizard({ bootstrap, onPreviewChange, onComplete }: SetupWizardProps): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [displayedStep, setDisplayedStep] = useState(0)
  const [draft, setDraft] = useState<AppSettings>(bootstrap.settings)
  const [touched, setTouched] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'exit' | 'enter'>('idle')
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'backward'>('forward')
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const transitionTimeoutsRef = useRef<number[]>([])
  const completionTimeoutRef = useRef<number | null>(null)
  const locale = draft.locale
  const authorNameError = touched && !draft.authorProfile.name.trim() ? t(locale, 'authorNameRequired') : null
  const currentStep = displayedStep
  const currentStepIconClass = currentStep === 0 ? 'bi-folder2-open' : 'bi-person'

  function clearTransitionTimeouts(): void {
    transitionTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    transitionTimeoutsRef.current = []
  }

  function clearCompletionTimeout(): void {
    if (completionTimeoutRef.current) {
      window.clearTimeout(completionTimeoutRef.current)
      completionTimeoutRef.current = null
    }
  }

  function requestStepChange(nextStep: number): void {
    if (nextStep === step || transitionPhase !== 'idle') {
      return
    }

    if (prefersReducedMotion) {
      setStep(nextStep)
      setDisplayedStep(nextStep)
      return
    }

    const direction = nextStep > step ? 'forward' : 'backward'
    setTransitionDirection(direction)
    setTransitionPhase('exit')
    clearTransitionTimeouts()

    const exitTimeoutId = window.setTimeout(() => {
      setDisplayedStep(nextStep)
      setStep(nextStep)
      setTransitionPhase('enter')

      const enterTimeoutId = window.setTimeout(() => {
        setTransitionPhase('idle')
      }, 200)

      transitionTimeoutsRef.current.push(enterTimeoutId)
    }, 200)

    transitionTimeoutsRef.current.push(exitTimeoutId)
  }

  useEffect(() => {
    setDraft(bootstrap.settings)
    setStep(0)
    setDisplayedStep(0)
    setTouched(false)
    setIsCompleting(false)
    setTransitionPhase('idle')
    clearTransitionTimeouts()
    clearCompletionTimeout()
  }, [bootstrap.settings])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = (): void => {
      setPrefersReducedMotion(mediaQuery.matches)
    }

    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)

    return () => {
      mediaQuery.removeEventListener('change', updatePreference)
      clearTransitionTimeouts()
      clearCompletionTimeout()
    }
  }, [])

  useEffect(() => {
    onPreviewChange?.({
      theme: draft.theme,
      fontPreference: draft.fontPreference,
      uiZoom: draft.uiZoom
    })

    return () => {
      onPreviewChange?.(null)
    }
  }, [draft.fontPreference, draft.theme, draft.uiZoom, onPreviewChange])

  return (
    <main className="setup-shell">
      <section className="setup-card">
        <div className="setup-card__header">
          <div>
            <img alt="" className="brand-mark" src={appIcon} />
            <p className="eyebrow">{t(locale, currentStep === 0 ? 'stepWorkspace' : 'stepAuthor')}</p>
            <h1>{t(locale, 'setupTitle')}</h1>
            <p className="muted-copy">{t(locale, 'setupBody')}</p>
          </div>
          <div aria-label={t(locale, 'setupOverview')} className="wizard-progress" role="progressbar" aria-valuemin={1} aria-valuemax={2} aria-valuenow={step + 1}>
            <div className={`wizard-progress__step${step >= 0 ? ' wizard-progress__step--active' : ''}`}>
              <span aria-hidden="true" className="wizard-progress__dot" />
              <span>{t(locale, 'stepWorkspace')}</span>
            </div>
            <div className={`wizard-progress__connector${step >= 1 ? ' wizard-progress__connector--active' : ''}`} />
            <div className={`wizard-progress__step${step >= 1 ? ' wizard-progress__step--active' : ''}`}>
              <span aria-hidden="true" className="wizard-progress__dot" />
              <span>{t(locale, 'stepAuthor')}</span>
            </div>
          </div>
        </div>

        <section className="setup-overview" aria-label={t(locale, 'setupOverview')}>
          <article className="setup-overview__card">
            <span>{t(locale, 'uiLanguage')}</span>
            <strong>{localeLabel(draft.locale)}</strong>
          </article>
          <article className="setup-overview__card">
            <span>{t(locale, 'theme')}</span>
            <strong>{t(locale, draft.theme === 'light' ? 'themeLight' : draft.theme === 'dark' ? 'themeDark' : 'themeSystem')}</strong>
          </article>
          <article className="setup-overview__card">
            <span>{t(locale, 'fontPreference')}</span>
            <strong>{t(locale, draft.fontPreference === 'dyslexic' ? 'fontDyslexic' : 'fontClassic')}</strong>
          </article>
          <article className="setup-overview__card">
            <span>{t(locale, 'uiZoom')}</span>
            <strong>{draft.uiZoom}%</strong>
          </article>
        </section>

        <div
          aria-live="polite"
          className={`setup-step setup-step--${transitionPhase} setup-step--${transitionDirection}${isCompleting ? ' setup-step--celebration' : ''}`}
        >
          {isCompleting ? (
            <div className="setup-celebration" role="status">
              <div aria-hidden="true" className="setup-celebration__icon">
                <i className="bi bi-check2"></i>
              </div>
              <div className="setup-celebration__copy">
                <p className="eyebrow">{t(locale, 'setupReadyEyebrow')}</p>
                <h2>{t(locale, 'setupCelebrationTitle')}</h2>
                <p className="muted-copy">{t(locale, 'setupCelebrationBody')}</p>
              </div>
            </div>
          ) : currentStep === 0 ? (
            <>
              <div aria-hidden="true" className="setup-step-hero">
                <div className="setup-step-hero__icon-shell">
                  <i className={`bi ${currentStepIconClass} setup-step-hero__icon`}></i>
                </div>
              </div>
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="eyebrow">{t(locale, 'stepWorkspace')}</p>
                  <h2>{t(locale, 'setupWorkspaceTitle')}</h2>
                </div>
              </div>
              <WorkspaceFields locale={locale} setSettings={setDraft} settings={draft} />
            </>
          ) : (
            <>
              <div aria-hidden="true" className="setup-step-hero">
                <div className="setup-step-hero__icon-shell">
                  <i className={`bi ${currentStepIconClass} setup-step-hero__icon`}></i>
                </div>
              </div>
              <div className="section-heading section-heading--compact">
                <div>
                  <p className="eyebrow">{t(locale, 'stepAuthor')}</p>
                  <h2>{t(locale, 'setupAuthorTitle')}</h2>
                </div>
              </div>
              <AuthorFields locale={locale} nameError={authorNameError} setSettings={setDraft} settings={draft} />
            </>
          )}
        </div>

        <div className={currentStep > 0 ? 'dialog-actions' : 'dialog-actions dialog-actions--end'}>
          {!isCompleting && currentStep > 0 ? (
            <Button disabled={transitionPhase !== 'idle'} onClick={() => requestStepChange(0)} size="sm" type="button" variant="ghost">
              {t(locale, 'back')}
            </Button>
          ) : null}
          {!isCompleting && currentStep === 0 ? (
            <Button disabled={transitionPhase !== 'idle'} onClick={() => requestStepChange(1)} size="sm" type="button">
              {t(locale, 'continue')}
            </Button>
          ) : null}
          {!isCompleting && currentStep !== 0 ? (
            <Button
              disabled={transitionPhase !== 'idle' || isCompleting}
              onClick={() => {
                setTouched(true)
                if (!draft.authorProfile.name.trim() || !draft.workspaceDirectory.trim()) {
                  return
                }
                setIsCompleting(true)
                clearCompletionTimeout()
                completionTimeoutRef.current = window.setTimeout(() => {
                  onPreviewChange?.(null)
                  void onComplete({ ...draft, onboardingCompleted: false })
                }, prefersReducedMotion ? 1200 : 1500)
              }}
              size="sm"
              type="button"
            >
              {t(locale, 'finishSetup')}
            </Button>
          ) : null}
        </div>
      </section>
    </main>
  )
}
