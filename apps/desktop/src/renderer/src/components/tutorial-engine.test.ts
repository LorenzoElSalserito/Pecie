import { describe, expect, it } from 'vitest'

import {
  clampTutorialStepIndex,
  completeTutorialSession,
  createTutorialSession,
  pauseTutorialSession,
  resolveNextTutorialStepIndex,
  resolvePreviousTutorialStepIndex,
  skipTutorialSession
} from './tutorial-engine'

describe('tutorial engine', () => {
  it('clamps step indexes to the tutorial bounds', () => {
    expect(clampTutorialStepIndex(-3, 4)).toBe(0)
    expect(clampTutorialStepIndex(2, 4)).toBe(2)
    expect(clampTutorialStepIndex(99, 4)).toBe(3)
    expect(clampTutorialStepIndex(99, 0)).toBe(0)
  })

  it('models runner status transitions explicitly', () => {
    const running = createTutorialSession('workspace-basics', 10, 4)
    expect(running).toEqual({
      tutorialId: 'workspace-basics',
      stepIndex: 3,
      status: 'running'
    })

    const paused = pauseTutorialSession(running, 1, 4)
    expect(paused.status).toBe('paused')
    expect(paused.stepIndex).toBe(1)
    expect(completeTutorialSession(paused).status).toBe('completed')
    expect(skipTutorialSession(paused).status).toBe('skipped')
  })

  it('resolves next and previous steps without escaping the script', () => {
    expect(resolveNextTutorialStepIndex(0, 3)).toBe(1)
    expect(resolveNextTutorialStepIndex(2, 3)).toBe(2)
    expect(resolvePreviousTutorialStepIndex(2, 3)).toBe(1)
    expect(resolvePreviousTutorialStepIndex(0, 3)).toBe(0)
  })
})
