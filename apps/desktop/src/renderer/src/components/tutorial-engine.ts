export type TutorialRunnerStatus = 'idle' | 'running' | 'paused' | 'completed' | 'skipped'

export type TutorialRunnerSession = {
  tutorialId: string
  stepIndex: number
  status: TutorialRunnerStatus
}

export type TutorialTargetDescriptor = {
  kind: string
  value: string
}

export type TutorialStepDescriptor = {
  action: string
  target: TutorialTargetDescriptor
}

export function clampTutorialStepIndex(stepIndex: number, stepCount: number): number {
  if (stepCount <= 0) {
    return 0
  }

  return Math.max(0, Math.min(stepIndex, stepCount - 1))
}

export function createTutorialSession(tutorialId: string, stepIndex: number, stepCount: number): TutorialRunnerSession {
  return {
    tutorialId,
    stepIndex: clampTutorialStepIndex(stepIndex, stepCount),
    status: 'running'
  }
}

export function pauseTutorialSession(session: TutorialRunnerSession, stepIndex: number, stepCount: number): TutorialRunnerSession {
  return {
    ...session,
    stepIndex: clampTutorialStepIndex(stepIndex, stepCount),
    status: 'paused'
  }
}

export function completeTutorialSession(session: TutorialRunnerSession): TutorialRunnerSession {
  return {
    ...session,
    status: 'completed'
  }
}

export function skipTutorialSession(session: TutorialRunnerSession): TutorialRunnerSession {
  return {
    ...session,
    status: 'skipped'
  }
}

export function resolveNextTutorialStepIndex(currentStepIndex: number, stepCount: number): number {
  return clampTutorialStepIndex(currentStepIndex + 1, stepCount)
}

export function resolvePreviousTutorialStepIndex(currentStepIndex: number, stepCount: number): number {
  return clampTutorialStepIndex(currentStepIndex - 1, stepCount)
}

export function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false
  }

  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

export function resolveTutorialTarget(target: TutorialTargetDescriptor): HTMLElement | null {
  if (target.kind === 'tutorial-id') {
    return document.querySelector<HTMLElement>(`[data-tutorial-id="${target.value}"]`)
  }

  if (target.kind === 'workspace-view') {
    return document.querySelector<HTMLElement>(`[data-tutorial-id="workspace-view-${target.value}"]`)
  }

  if (target.kind === 'selector') {
    return document.querySelector<HTMLElement>(target.value)
  }

  return null
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

export async function ensureTutorialTargetVisible(target: TutorialTargetDescriptor): Promise<HTMLElement | null> {
  let resolvedTarget = resolveTutorialTarget(target)
  if (resolvedTarget && isElementVisible(resolvedTarget)) {
    return resolvedTarget
  }

  if (target.kind === 'tutorial-id' && target.value.startsWith('workspace-open-')) {
    document.querySelector<HTMLElement>('[data-tutorial-id="workspace-overflow-menu"]')?.click()
    await waitForAnimationFrame()
    resolvedTarget = resolveTutorialTarget(target)
  }

  return resolvedTarget && isElementVisible(resolvedTarget) ? resolvedTarget : null
}

export async function executeTutorialStep(step: TutorialStepDescriptor): Promise<HTMLElement | null> {
  const target = await ensureTutorialTargetVisible(step.target)
  if (!target) {
    return null
  }

  target.scrollIntoView({
    block: 'center',
    inline: 'nearest',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  })

  if ((step.action === 'focus' || step.action === 'click') && typeof target.focus === 'function') {
    target.focus({ preventScroll: true })
  }

  if (step.action === 'click' || step.action === 'switch-workspace-view') {
    target.click()
  }

  return target
}
