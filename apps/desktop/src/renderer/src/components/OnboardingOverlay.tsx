import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { Button, Icon, isIconName } from '@pecie/ui'

import { t } from '../i18n'
import {
  completeTutorialSession,
  computeTutorialCoachPlacement,
  createTutorialSession,
  ensureTutorialTargetVisible,
  executeTutorialStep,
  pauseTutorialSession,
  resolveNextTutorialStepIndex,
  resolvePreviousTutorialStepIndex,
  skipTutorialSession,
  type TutorialCoachPlacement,
  type TutorialRect
} from './tutorial-engine'
import type { OnboardingOverlayProps } from './types'
import { tutorialScripts } from './tutorials'

const SPOTLIGHT_PADDING = 8
const REVEAL_DELAY_MS = 420

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function measure(element: HTMLElement): TutorialRect {
  const rect = element.getBoundingClientRect()
  return {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2
  }
}

/**
 * Guided tour rendered as a non-modal coach mark: a spotlight cut out around the real
 * control plus a floating card beside it. The interface underneath stays fully usable,
 * so the "focus" and "click" step actions act on the actual target.
 */
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
  const [revealed, setRevealed] = useState(false)
  const [targetRect, setTargetRect] = useState<TutorialRect | null>(null)
  const [placement, setPlacement] = useState<TutorialCoachPlacement | null>(null)
  const cardRef = useRef<HTMLElement | null>(null)
  const nextRef = useRef<() => void>(() => undefined)
  const backRef = useRef<() => void>(() => undefined)
  const skipRef = useRef<() => void>(() => undefined)
  const targetRef = useRef<HTMLElement | null>(null)
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

  // Let the surface underneath settle (launcher hero, dialog animations) before the tour appears.
  useEffect(() => {
    if (!open) {
      setRevealed(false)
      return
    }
    const timeout = window.setTimeout(() => setRevealed(true), prefersReducedMotion() ? 0 : REVEAL_DELAY_MS)
    return () => window.clearTimeout(timeout)
  }, [open])

  const syncGeometry = useCallback(() => {
    const target = targetRef.current
    const nextRect = target && target.isConnected ? measure(target) : null
    setTargetRect(nextRect)
    const card = cardRef.current
    if (!card) {
      return
    }
    setPlacement(
      computeTutorialCoachPlacement(nextRect, { width: card.offsetWidth, height: card.offsetHeight }, { width: window.innerWidth, height: window.innerHeight })
    )
  }, [])

  // Resolve, highlight and track the current target.
  useEffect(() => {
    if (!open || !revealed || !currentStep) {
      return
    }

    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    let frame = 0
    const scheduleSync = (): void => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(syncGeometry)
    }

    void (async () => {
      const target = await ensureTutorialTargetVisible(currentStep.target)
      if (cancelled) {
        return
      }
      targetRef.current = target
      if (target) {
        target.classList.add('tutorial-target--active')
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(scheduleSync)
          resizeObserver.observe(target)
          resizeObserver.observe(document.body)
        }
      }
      scheduleSync()
      // Smooth scrolling and layout animations move the target for a few hundred ms.
      window.setTimeout(scheduleSync, 120)
      window.setTimeout(scheduleSync, 420)
    })()

    window.addEventListener('resize', scheduleSync)
    window.addEventListener('scroll', scheduleSync, true)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', scheduleSync)
      window.removeEventListener('scroll', scheduleSync, true)
      resizeObserver?.disconnect()
      targetRef.current?.classList.remove('tutorial-target--active')
      targetRef.current = null
    }
  }, [currentStep, open, revealed, syncGeometry])

  // Place the card as soon as it has a size.
  useLayoutEffect(() => {
    if (!open || !revealed) {
      return
    }
    syncGeometry()
  }, [open, revealed, stepIndex, syncGeometry])

  // Keyboard focus lands on the card once, when the tour appears. Step actions that focus the
  // real control (action: "focus") must keep that focus, so later steps never pull it back.
  useEffect(() => {
    if (!open || !revealed) {
      return
    }
    const card = cardRef.current
    if (card && !card.contains(document.activeElement)) {
      card.focus({ preventScroll: true })
    }
  }, [open, revealed])

  // Keyboard shortcuts on the card itself: arrows move between steps, Escape skips the tour.
  useEffect(() => {
    const card = cardRef.current
    if (!open || !revealed || !card) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      const origin = event.target as HTMLElement | null
      if (origin !== card && origin?.tagName !== 'BUTTON') {
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        nextRef.current()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        backRef.current()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        skipRef.current()
      }
    }
    card.addEventListener('keydown', handleKeyDown)
    return () => card.removeEventListener('keydown', handleKeyDown)
  }, [open, revealed])

  if (!open || !revealed || !tutorial || !currentStep) {
    return null
  }

  const title = t(locale, tutorial.titleKey)
  const icon = isIconName(tutorial.icon) ? tutorial.icon : 'compass'

  function goBack(): void {
    if (!tutorial || isFirstStep) return
    const nextStepIndex = resolvePreviousTutorialStepIndex(stepIndex, tutorial.steps.length)
    setStepIndex(nextStepIndex)
    const paused = pauseTutorialSession(session, nextStepIndex, tutorial.steps.length)
    onProgress({ tutorialId: paused.tutorialId, stepIndex: paused.stepIndex, status: 'paused' })
  }

  function goNext(): void {
    if (!tutorial || !currentStep) return
    if (isLastStep) {
      completeTutorialSession(session)
      onDismiss('completed')
      return
    }
    void executeTutorialStep(currentStep).finally(() => {
      const nextStepIndex = resolveNextTutorialStepIndex(stepIndex, tutorial.steps.length)
      setStepIndex(nextStepIndex)
      const paused = pauseTutorialSession(session, nextStepIndex, tutorial.steps.length)
      onProgress({ tutorialId: paused.tutorialId, stepIndex: paused.stepIndex, status: 'paused' })
    })
  }

  function skip(): void {
    skipTutorialSession(session)
    onDismiss('skipped')
  }

  nextRef.current = goNext
  backRef.current = goBack
  skipRef.current = skip

  const cardStyle = placement ? { top: `${placement.top}px`, left: `${placement.left}px` } : { visibility: 'hidden' as const }

  return (
    <div className="tutorial-coach" data-tutorial-coach="">
      {targetRect ? (
        <div
          aria-hidden="true"
          className="tutorial-spotlight"
          style={{ top: `${targetRect.top}px`, left: `${targetRect.left}px`, width: `${targetRect.width}px`, height: `${targetRect.height}px` }}
        />
      ) : (
        <div aria-hidden="true" className="tutorial-coach__veil" />
      )}
      <section
        aria-label={title}
        aria-modal="false"
        className={`tutorial-coach__card tutorial-coach__card--${placement?.side ?? 'floating'}`}
        ref={cardRef}
        role="dialog"
        style={cardStyle}
        tabIndex={-1}
      >
        <header className="tutorial-coach__header">
          <span aria-hidden="true" className="tutorial-coach__badge">
            <Icon name={icon} />
          </span>
          <div className="tutorial-coach__heading">
            <p className="tutorial-coach__title">{title}</p>
            <p className="tutorial-coach__counter">
              {t(locale, 'tutorialStepCounter', { current: String(stepIndex + 1), total: String(tutorial.steps.length) })}
            </p>
          </div>
          <button aria-label={t(locale, 'close')} className="tutorial-coach__close" onClick={skip} title={t(locale, 'close')} type="button">
            <Icon name="x-lg" />
          </button>
        </header>
        <div
          aria-label={t(locale, 'tutorialProgressLabel')}
          aria-valuemax={tutorial.steps.length}
          aria-valuemin={1}
          aria-valuenow={stepIndex + 1}
          className="tutorial-coach__progress"
          role="progressbar"
        >
          {tutorial.steps.map((step, index) => (
            <span className={`tutorial-coach__segment${index <= stepIndex ? ' tutorial-coach__segment--done' : ''}`} key={step.id} />
          ))}
        </div>
        <p className="tutorial-coach__body">{t(locale, currentStep.bodyKey)}</p>
        <p className="tutorial-coach__target">
          <Icon name="bullseye" />
          <span className="tutorial-coach__sr">{t(locale, 'tutorialTargetLabel')} </span>
          <span>{t(locale, currentStep.targetLabelKey)}</span>
        </p>
        <div className="tutorial-coach__actions">
          <Button className="tutorial-coach__skip" onClick={skip} size="sm" type="button" variant="ghost">
            {t(locale, 'tutorialSkip')}
          </Button>
          <div className="tutorial-coach__nav">
            <Button disabled={isFirstStep} onClick={goBack} size="sm" type="button" variant="ghost">
              {t(locale, 'back')}
            </Button>
            <Button onClick={goNext} size="sm" type="button">
              {isLastStep ? t(locale, 'understood') : t(locale, 'next')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
