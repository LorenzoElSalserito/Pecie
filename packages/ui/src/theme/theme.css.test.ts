import { describe, expect, it } from 'vitest'

import { globalThemeStyles } from './theme.css'
import { semanticTokens } from './semantic-tokens'

describe('globalThemeStyles', () => {
  it('emits semantic, icon-size, elevation and motion variables for every theme', () => {
    expect(globalThemeStyles).toContain('--pecie-icon-size-md: 16px;')
    expect(globalThemeStyles).toContain('--pecie-icon-size-hero: 40px;')
    expect(globalThemeStyles).toContain('--pecie-elevation-0: none;')
    expect(globalThemeStyles).toContain('--pecie-palette-accent-deep: #8f431f;')
    expect(globalThemeStyles).toContain('--pecie-motion-fast: 120ms;')
    expect(globalThemeStyles).toContain('--pecie-ease-emphasized: cubic-bezier(0.2, 0.8, 0.2, 1);')

    const lightBlock = globalThemeStyles.split("[data-theme='light'] {")[1].split('}')[0]
    const darkBlock = globalThemeStyles.split("[data-theme='dark'] {")[1].split('}')[0]
    expect(lightBlock).toContain(`--pecie-surface-base: ${semanticTokens.light.surface.base};`)
    expect(lightBlock).toContain(`--pecie-feedback-danger-text: ${semanticTokens.light.feedback.danger.text};`)
    expect(darkBlock).toContain(`--pecie-surface-base: ${semanticTokens.dark.surface.base};`)
    expect(darkBlock).toContain(`--pecie-accent-subtle: ${semanticTokens.dark.accent.subtle};`)
    expect(globalThemeStyles.match(/--pecie-control-text-muted:|--pecie-control-textMuted:/g)?.length).toBe(4)
  })
})
