import { useEffect, useMemo, useState } from 'react'

import { Button, Dialog } from '@pecie/ui'

import { t } from '../i18n'
import {
  completeTutorialSession,
  createTutorialSession,
  ensureTutorialTargetVisible,
  executeTutorialStep,
  pauseTutorialSession,
  resolveNextTutorialStepIndex,
  resolvePreviousTutorialStepIndex,
  skipTutorialSession
} from './tutorial-engine'
import type { OnboardingOverlayProps } from './types'
import { tutorialScripts } from './tutorials'

export function OnboardingOverlay({
  open,
  locale,
  tutorialId,
  initialStepIndex = 0,
  onProgress,
  onDismiss
}: OnboardingOverlayProps): React.JSX.Element | null {
  const tutorial = tutorialScripts[tutorialId as keyof typeof tutorialScripts] ?? null
  const tutorialStepCount = tutorial?.steps.length ?? 0
  const [stepIndex, setStepIndex] = useState(initialStepIndex)
  const session = useMemo(
    () => createTutorialSession(tutorial?.id ?? tutorialId, stepIndex, Math.max(1, tutorialStepCount)),
    [stepIndex, tutorial?.id, tutorialId, tutorialStepCount]
  )
  const currentStep = tutorial?.steps[Math.max(0, Math.min(stepIndex, tutorialStepCount - 1))] ?? null
  const isFirstStep = stepIndex === 0
  const isLastStep = tutorialStepCount > 0 && stepIndex === tutorialStepCount - 1

  useEffect(() => {
    if (!open || !tutorial) {
      return
    }

    setStepIndex(Math.max(0, Math.min(initialStepIndex, tutorialStepCount - 1)))
  }, [initialStepIndex, open, tutorial, tutorialStepCount])

  useEffect(() => {
    if (!open || !tutorial) {
      return
    }

    onProgress({
      tutorialId: session.tutorialId,
      stepIndex: session.stepIndex,
      status: 'running'
    })
  }, [onProgress, open, session.stepIndex, session.tutorialId, tutorial])

  useEffect(() => {
    if (!open || !currentStep) {
      return
    }

    let activeTarget: HTMLElement | null = null
    let cancelled = false

    void (async () => {
      const target = await ensureTutorialTargetVisible(currentStep.target)
      if (!target || cancelled) {
        return
      }

      activeTarget = target
      target.classList.add('tutorial-target--active')
      target.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      })

      if (currentStep.action === 'focus' && typeof target.focus === 'function') {
        target.focus({ preventScroll: true })
      }
    })()

    return () => {
      cancelled = true
      activeTarget?.classList.remove('tutorial-target--active')
    }
  }, [currentStep, open])

  if (!open || !tutorial || !currentStep) {
    return null
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        skipTutorialSession(session)
        onDismiss('skipped')
      }}
      size="compact"
      icon={tutorial.icon}
      title={t(locale, tutorial.titleKey)}
    >
      <div className="tutorial-progress" aria-label={t(locale, 'tutorialProgressLabel')}>
        {tutorial.steps.map((step, index) => (
          <span
            aria-hidden="true"
            className={`tutorial-progress__dot${index <= stepIndex ? ' tutorial-progress__dot--active' : ''}`}
            key={step.id}
          />
        ))}
      </div>
      <div className="tutorial-step-card">
        <p className="eyebrow">
          {t(locale, 'tutorialStepCounter', {
            current: String(stepIndex + 1),
            total: String(tutorial.steps.length)
          })}
        </p>
        <p>{t(locale, currentStep.bodyKey)}</p>
        <p className="tutorial-step-card__target">
          <strong>{t(locale, 'tutorialTargetLabel')}</strong> {t(locale, currentStep.targetLabelKey)}
        </p>
      </div>

      <div className="dialog-actions dialog-actions--end">
        <Button onClick={() => onDismiss('skipped')} size="sm" type="button" variant="ghost">
          {t(locale, 'tutorialSkip')}
        </Button>
        <Button
          disabled={isFirstStep}
          onClick={() => {
            const nextStepIndex = resolvePreviousTutorialStepIndex(stepIndex, tutorial.steps.length)
            setStepIndex(nextStepIndex)
            const paused = pauseTutorialSession(session, nextStepIndex, tutorial.steps.length)
            onProgress({ tutorialId: paused.tutorialId, stepIndex: paused.stepIndex, status: 'paused' })
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          {t(locale, 'back')}
        </Button>
        <Button
          onClick={() => {
            if (isLastStep) {
              void executeTutorialStep(currentStep).finally(() => {
                window.requestAnimationFrame(() => {
                  completeTutorialSession(session)
                  onDismiss('completed')
                })
              })
              return
            }
            void executeTutorialStep(currentStep).finally(() => {
              const nextStepIndex = resolveNextTutorialStepIndex(stepIndex, tutorial.steps.length)
              setStepIndex(nextStepIndex)
              const paused = pauseTutorialSession(session, nextStepIndex, tutorial.steps.length)
              onProgress({ tutorialId: paused.tutorialId, stepIndex: paused.stepIndex, status: 'paused' })
            })
          }}
          size="sm"
          type="button"
        >
          {isLastStep ? t(locale, 'understood') : t(locale, 'next')}
        </Button>
      </div>
    </Dialog>
  )
}
