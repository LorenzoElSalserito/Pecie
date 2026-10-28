import { tokens } from './tokens'

/**
 * Semantic layer on top of the primitive palette in `tokens.ts`.
 *
 * Components must read these roles (surface, control, accent, feedback) instead of mixing
 * primitives with `color-mix()` on the spot. Every role has a value per theme, so the light
 * theme is a first-class palette and never an override of the dark one. The contrast matrix in
 * `tokens.test.ts` guards every text/background pair against WCAG AA.
 */

export type FeedbackTone = { bg: string; border: string; text: string }

export type SemanticPalette = {
  surface: {
    /** App canvas. */
    base: string
    /** Cards, panels, dialogs. */
    raised: string
    /** Popovers, menus, coach marks: the topmost layer. */
    overlay: string
    /** Wells and inset areas (inputs at rest, grouped toolbars). */
    sunken: string
  }
  control: {
    bg: string
    bgHover: string
    bgActive: string
    border: string
    borderStrong: string
    text: string
    textMuted: string
  }
  accent: {
    bg: string
    bgHover: string
    /** Text on the accent background. */
    text: string
    /** Tinted background for selected chips, badges and active toggles. */
    subtle: string
    /** Text on the subtle accent tint. */
    onSubtle: string
  }
  feedback: {
    info: FeedbackTone
    success: FeedbackTone
    warning: FeedbackTone
    danger: FeedbackTone
  }
  focusRing: string
  scrim: string
}

const light = tokens.color.light
const dark = tokens.color.dark
const hcLight = tokens.color.highContrast.light
const hcDark = tokens.color.highContrast.dark

export const semanticTokens = {
  light: {
    surface: { base: light.background, raised: light.surface, overlay: light.surface, sunken: light.surfaceStrong },
    control: {
      bg: light.surface,
      bgHover: light.surfaceHover,
      bgActive: light.surfaceStrong,
      border: light.border,
      borderStrong: light.textSubtle,
      text: light.text,
      textMuted: light.textMuted
    },
    accent: { bg: light.accent, bgHover: light.accentHover, text: light.accentText, subtle: '#f4e3d8', onSubtle: light.accentHover },
    feedback: {
      info: { bg: '#e6f0f8', border: '#9cc0dc', text: '#1d5b84' },
      success: { bg: light.successBg, border: '#9fd1ae', text: '#246a3c' },
      warning: { bg: '#fbefdc', border: '#d9b36c', text: '#7a4a10' },
      danger: { bg: light.dangerBg, border: '#ecb3ad', text: light.danger }
    },
    focusRing: light.focus,
    scrim: light.overlayBg
  },
  dark: {
    surface: { base: dark.background, raised: dark.surface, overlay: dark.surfaceHover, sunken: dark.surfaceStrong },
    control: {
      bg: dark.surface,
      bgHover: dark.surfaceHover,
      bgActive: dark.surfaceStrong,
      border: dark.border,
      borderStrong: dark.textSubtle,
      text: dark.text,
      textMuted: dark.textMuted
    },
    accent: { bg: dark.accent, bgHover: dark.accentHover, text: dark.accentText, subtle: '#3a2616', onSubtle: dark.accentHover },
    feedback: {
      info: { bg: '#16263a', border: '#2f5377', text: '#9ccbf0' },
      success: { bg: dark.successBg, border: '#2f5c38', text: '#8fd8a0' },
      warning: { bg: '#3a2a12', border: '#6e5224', text: '#f0c184' },
      danger: { bg: dark.dangerBg, border: '#6b2b2b', text: '#ffa3a3' }
    },
    focusRing: dark.focus,
    scrim: dark.overlayBg
  },
  highContrast: {
    light: {
      surface: { base: hcLight.background, raised: hcLight.surface, overlay: hcLight.surface, sunken: hcLight.surfaceStrong },
      control: {
        bg: hcLight.surface,
        bgHover: hcLight.surfaceHover,
        bgActive: hcLight.surfaceStrong,
        border: hcLight.border,
        borderStrong: hcLight.text,
        text: hcLight.text,
        textMuted: hcLight.textMuted
      },
      accent: { bg: hcLight.accent, bgHover: hcLight.accentHover, text: hcLight.accentText, subtle: '#f6e2d4', onSubtle: hcLight.accentHover },
      feedback: {
        info: { bg: '#e4eef8', border: '#4f7ea6', text: '#0f4a73' },
        success: { bg: hcLight.successBg, border: '#3f8a52', text: '#174f28' },
        warning: { bg: '#fbeed6', border: '#a67a32', text: '#5f3608' },
        danger: { bg: hcLight.dangerBg, border: '#c05c5c', text: hcLight.danger }
      },
      focusRing: hcLight.focus,
      scrim: hcLight.overlayBg
    },
    dark: {
      surface: { base: hcDark.background, raised: hcDark.surface, overlay: hcDark.surfaceHover, sunken: hcDark.surfaceStrong },
      control: {
        bg: hcDark.surface,
        bgHover: hcDark.surfaceHover,
        bgActive: hcDark.surfaceStrong,
        border: hcDark.border,
        borderStrong: hcDark.text,
        text: hcDark.text,
        textMuted: hcDark.textMuted
      },
      accent: { bg: hcDark.accent, bgHover: hcDark.accentHover, text: hcDark.accentText, subtle: '#3d2812', onSubtle: hcDark.accentHover },
      feedback: {
        info: { bg: '#122238', border: '#6fa6d6', text: '#bfe0ff' },
        success: { bg: hcDark.successBg, border: '#5fb874', text: '#a9efb6' },
        warning: { bg: '#3b2a0f', border: '#d3a35a', text: '#ffdca3' },
        danger: { bg: hcDark.dangerBg, border: '#e07070', text: '#ffb8b8' }
      },
      focusRing: hcDark.focus,
      scrim: hcDark.overlayBg
    }
  }
} as const satisfies { light: SemanticPalette; dark: SemanticPalette; highContrast: { light: SemanticPalette; dark: SemanticPalette } }

/** Icon box sizes in px; `<Icon size>` maps to `--pecie-icon-size-*`. */
export const iconSizeTokens = { sm: 14, md: 16, lg: 20, xl: 28, hero: 40 } as const
export type IconSize = keyof typeof iconSizeTokens

/** Elevation levels: 0 flat, 1 card, 2 floating panel, 3 dialog. */
export const elevationTokens = {
  0: 'none',
  1: tokens.shadow.sm,
  2: tokens.shadow.md,
  3: tokens.shadow.lg
} as const

/** Motion durations (ms) and easings; every transition in the app picks from here. */
export const motionTokens = {
  duration: { instant: 0, fast: 120, normal: 200, slow: 320 },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)'
  }
} as const

export function flattenSemanticPalette(palette: SemanticPalette): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (value: unknown, pathParts: string[]): void => {
    if (typeof value === 'string') {
      out[pathParts.join('-')] = value
      return
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walk(child, [...pathParts, key])
    }
  }
  walk(palette, [])
  return out
}
