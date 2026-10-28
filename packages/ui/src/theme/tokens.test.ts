import { describe, expect, it } from 'vitest'

import { contrastRatio, WCAG_AA } from './contrast'
import { elevationTokens, flattenSemanticPalette, iconSizeTokens, motionTokens, semanticTokens, type SemanticPalette } from './semantic-tokens'
import { tokens } from './tokens'

describe('tokens', () => {
  it('matches the minimum spacing and typography requirements from the PRD', () => {
    expect(tokens.spacing.xs).toBe(4)
    expect(tokens.spacing.xl).toBe(24)
    expect(tokens.typography.body.size).toBe(16)
    expect(tokens.typography.heading.size).toBe(24)
    // UI.md §10 type scale: display 32, h3 16, compact body 15, caption 13 (=small), eyebrow 11 (=caption), mono 13.
    expect(tokens.typography.display.size).toBe(32)
    expect(tokens.typography.h3.size).toBe(16)
    expect(tokens.typography.compact.size).toBe(15)
    expect(tokens.typography.mono.size).toBe(13)
  })

  it('exposes icon sizes, elevation and motion scales', () => {
    expect(Object.values(iconSizeTokens)).toEqual([14, 16, 20, 28, 40])
    expect(elevationTokens[0]).toBe('none')
    expect(elevationTokens[3]).toBe(tokens.shadow.lg)
    expect(motionTokens.duration.fast).toBe(120)
    expect(motionTokens.duration.slow).toBe(320)
    expect(motionTokens.easing.standard).toMatch(/^cubic-bezier\(/)
  })
})

const palettes: Array<[string, SemanticPalette]> = [
  ['light', semanticTokens.light],
  ['dark', semanticTokens.dark],
  ['high-contrast light', semanticTokens.highContrast.light],
  ['high-contrast dark', semanticTokens.highContrast.dark]
]

describe('semantic palette contrast (WCAG AA)', () => {
  for (const [name, palette] of palettes) {
    describe(name, () => {
      const textPairs: Array<[string, string, string]> = [
        ['control.text on surface.base', palette.control.text, palette.surface.base],
        ['control.text on surface.raised', palette.control.text, palette.surface.raised],
        ['control.text on surface.overlay', palette.control.text, palette.surface.overlay],
        ['control.text on surface.sunken', palette.control.text, palette.surface.sunken],
        ['control.text on control.bg', palette.control.text, palette.control.bg],
        ['control.text on control.bgHover', palette.control.text, palette.control.bgHover],
        ['control.text on control.bgActive', palette.control.text, palette.control.bgActive],
        ['control.textMuted on surface.base', palette.control.textMuted, palette.surface.base],
        ['control.textMuted on surface.raised', palette.control.textMuted, palette.surface.raised],
        ['control.textMuted on control.bg', palette.control.textMuted, palette.control.bg],
        ['accent.text on accent.bg', palette.accent.text, palette.accent.bg],
        ['accent.text on accent.bgHover', palette.accent.text, palette.accent.bgHover],
        ['accent.onSubtle on accent.subtle', palette.accent.onSubtle, palette.accent.subtle],
        ...(['info', 'success', 'warning', 'danger'] as const).flatMap((tone): Array<[string, string, string]> => [
          [`${tone}.text on ${tone}.bg`, palette.feedback[tone].text, palette.feedback[tone].bg],
          [`${tone}.text on surface.raised`, palette.feedback[tone].text, palette.surface.raised]
        ])
      ]
      for (const [label, foreground, background] of textPairs) {
        it(`${label} reaches ${WCAG_AA.text}:1`, () => {
          expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(WCAG_AA.text)
        })
      }

      const uiPairs: Array<[string, string, string]> = [
        ['accent.bg against surface.base', palette.accent.bg, palette.surface.base],
        ['accent.bg against surface.raised', palette.accent.bg, palette.surface.raised],
        ['focusRing against surface.base', palette.focusRing, palette.surface.base],
        ['focusRing against surface.raised', palette.focusRing, palette.surface.raised],
        ['control.borderStrong against control.bg', palette.control.borderStrong, palette.control.bg]
      ]
      for (const [label, foreground, background] of uiPairs) {
        it(`${label} reaches ${WCAG_AA.ui}:1`, () => {
          expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(WCAG_AA.ui)
        })
      }

      it('keeps feedback borders distinguishable from their background', () => {
        for (const tone of ['info', 'success', 'warning', 'danger'] as const) {
          expect(contrastRatio(palette.feedback[tone].border, palette.feedback[tone].bg), tone).toBeGreaterThanOrEqual(1.5)
        }
      })

      it('flattens to CSS variable names without collisions', () => {
        const flat = flattenSemanticPalette(palette)
        expect(Object.keys(flat).length).toBe(30)
        expect(flat['feedback-danger-text']).toBe(palette.feedback.danger.text)
        for (const value of Object.values(flat)) expect(value).toMatch(/^#[0-9a-f]{6}$|^rgba?\(/)
      })
    })
  }
})
