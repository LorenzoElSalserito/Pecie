import { describe, expect, it } from 'vitest'

import {
  clampTutorialStepIndex,
  computeTutorialCoachPlacement,
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

describe('computeTutorialCoachPlacement', () => {
  const card = { width: 360, height: 260 }
  const viewport = { width: 1400, height: 900 }

  it('places the card below the target when there is room', () => {
    const placement = computeTutorialCoachPlacement({ top: 200, left: 300, width: 400, height: 48 }, card, viewport)
    expect(placement).toEqual({ side: 'below', top: 264, left: 300 })
  })

  it('falls back above the target near the bottom edge', () => {
    const placement = computeTutorialCoachPlacement({ top: 780, left: 300, width: 400, height: 48 }, card, viewport)
    expect(placement.side).toBe('above')
    expect(placement.top).toBe(780 - 16 - 260)
  })

  it('moves beside tall targets and clamps inside the viewport', () => {
    const placement = computeTutorialCoachPlacement({ top: 40, left: 40, width: 500, height: 820 }, card, viewport)
    expect(placement.side).toBe('right')
    expect(placement.left).toBe(556)
    expect(placement.top).toBeGreaterThanOrEqual(16)
    expect(placement.top + card.height).toBeLessThanOrEqual(viewport.height - 16)
  })

  it('never lets the card overflow horizontally', () => {
    const placement = computeTutorialCoachPlacement({ top: 100, left: 1300, width: 80, height: 40 }, card, viewport)
    expect(placement.side).toBe('below')
    expect(placement.left + card.width).toBeLessThanOrEqual(viewport.width - 16)
  })

  it('floats in the corner without a target', () => {
    const placement = computeTutorialCoachPlacement(null, card, viewport)
    expect(placement.side).toBe('floating')
    expect(placement.left + card.width).toBeLessThanOrEqual(viewport.width - 16)
    expect(placement.top + card.height).toBeLessThanOrEqual(viewport.height - 16)
  })
})
