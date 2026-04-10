import { describe, expect, it } from 'vitest'

import { tokens } from './tokens'

describe('tokens', () => {
  it('matches the minimum spacing and typography requirements from the PRD', () => {
    expect(tokens.spacing.xs).toBe(4)
    expect(tokens.spacing.xl).toBe(24)
    expect(tokens.typography.body.size).toBe(16)
    expect(tokens.typography.heading.size).toBe(24)
  })
})
