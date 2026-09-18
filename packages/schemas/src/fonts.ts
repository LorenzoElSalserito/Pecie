/**
 * Bundled typography catalog.
 *
 * Every family listed here ships inside the desktop renderer
 * (`apps/desktop/src/renderer/src/asset/fonts/<id>/`) with a query-less
 * `@font-face` declared in `styles/fonts.css`, so the app never depends on
 * system fonts, network fonts or npm font packages at runtime.
 */

export type FontCategory = 'serif' | 'sans' | 'slab' | 'display' | 'mono' | 'accessible'

export type FontDefinition = {
  /** Stable identifier persisted in app settings. */
  id: string
  /** Human readable label (the font's own name). */
  label: string
  /** CSS `font-family` name declared by the bundled `@font-face`. */
  family: string
  category: FontCategory
  /** Generic fallback stack appended after the bundled family. */
  fallback: string
  /** Optical size correction applied to the body size (1 = no change). */
  scale: number
  /** When true the family also drives the interface font (accessibility fonts). */
  ui: boolean
  /** Extra tracking for legibility-oriented faces. */
  letterSpacing?: string
  wordSpacing?: string
  /** Whether the bundled files expose an italic axis or faces. */
  italic: boolean
  license: 'OFL' | 'Apache-2.0' | 'Bitstream'
}

const SERIF_FALLBACK = "Georgia, 'Times New Roman', serif"
const SANS_FALLBACK = "'Segoe UI', system-ui, sans-serif"
const MONO_FALLBACK = "'SFMono-Regular', Consolas, monospace"

function serif(id: string, label: string, scale = 1, family = label): FontDefinition {
  return { id, label, family, category: 'serif', fallback: SERIF_FALLBACK, scale, ui: false, italic: true, license: 'OFL' }
}

function sans(id: string, label: string, scale = 1, family = label): FontDefinition {
  return { id, label, family, category: 'sans', fallback: SANS_FALLBACK, scale, ui: false, italic: true, license: 'OFL' }
}

function slab(id: string, label: string, scale = 1, family = label): FontDefinition {
  return { id, label, family, category: 'slab', fallback: SERIF_FALLBACK, scale, ui: false, italic: true, license: 'OFL' }
}

function display(id: string, label: string, scale = 1, family = label): FontDefinition {
  return { id, label, family, category: 'display', fallback: SERIF_FALLBACK, scale, ui: false, italic: true, license: 'OFL' }
}

function mono(id: string, label: string, scale = 0.94, family = label): FontDefinition {
  return { id, label, family, category: 'mono', fallback: MONO_FALLBACK, scale, ui: false, italic: true, license: 'OFL' }
}

export const FONT_CATALOG: readonly FontDefinition[] = [
  // ── Book & editorial serifs ──
  serif('source-serif-4', 'Source Serif 4'),
  serif('crimson-pro', 'Crimson Pro', 1.04),
  serif('eb-garamond', 'EB Garamond', 1.08),
  serif('libre-baskerville', 'Libre Baskerville', 0.94),
  serif('merriweather', 'Merriweather', 0.94),
  serif('lora', 'Lora'),
  serif('literata', 'Literata'),
  serif('spectral', 'Spectral', 1.02),
  serif('cormorant-garamond', 'Cormorant Garamond', 1.14),
  serif('libre-caslon-text', 'Libre Caslon Text', 0.96),
  serif('gentium-book-plus', 'Gentium Book Plus', 1.04),
  serif('pt-serif', 'PT Serif'),
  serif('noto-serif', 'Noto Serif', 0.96),
  serif('vollkorn', 'Vollkorn', 0.98),
  serif('alegreya', 'Alegreya', 1.04),
  serif('cardo', 'Cardo', 1.06),
  serif('newsreader', 'Newsreader', 1.04),
  serif('brygada-1918', 'Brygada 1918', 1.02),
  serif('faustina', 'Faustina'),
  serif('petrona', 'Petrona'),
  serif('piazzolla', 'Piazzolla'),
  serif('stix-two-text', 'STIX Two Text'),
  serif('old-standard-tt', 'Old Standard TT', 1.02),
  serif('sorts-mill-goudy', 'Sorts Mill Goudy', 1.06),
  // ── Display & headline serifs ──
  display('fraunces', 'Fraunces', 0.98),
  display('playfair-display', 'Playfair Display', 0.98),
  display('bodoni-moda', 'Bodoni Moda', 1.02),
  // ── Slab serifs ──
  slab('bitter', 'Bitter', 0.96),
  slab('zilla-slab', 'Zilla Slab', 1.02),
  { ...slab('roboto-slab', 'Roboto Slab', 0.96), italic: false, license: 'Apache-2.0' },
  slab('ibm-plex-serif', 'IBM Plex Serif', 0.97),
  // ── Humanist & grotesque sans ──
  sans('ibm-plex-sans', 'IBM Plex Sans', 0.96),
  sans('inter', 'Inter', 0.95),
  sans('source-sans-3', 'Source Sans 3', 1.02),
  sans('work-sans', 'Work Sans', 0.96),
  sans('public-sans', 'Public Sans', 0.96),
  sans('fira-sans', 'Fira Sans', 0.96),
  sans('noto-sans', 'Noto Sans', 0.95),
  sans('lato', 'Lato'),
  sans('alegreya-sans', 'Alegreya Sans', 1.04),
  sans('pt-sans', 'PT Sans'),
  sans('open-sans', 'Open Sans', 0.95),
  sans('nunito-sans', 'Nunito Sans', 0.98),
  { ...sans('manrope', 'Manrope', 0.96), italic: false },
  sans('dm-sans', 'DM Sans', 0.97),
  sans('cabin', 'Cabin'),
  // ── Legibility & accessibility ──
  {
    id: 'atkinson-hyperlegible',
    label: 'Atkinson Hyperlegible',
    family: 'Atkinson Hyperlegible',
    category: 'accessible',
    fallback: SANS_FALLBACK,
    scale: 0.97,
    ui: true,
    letterSpacing: '0.01em',
    italic: true,
    license: 'OFL'
  },
  {
    id: 'lexend',
    label: 'Lexend',
    family: 'Lexend',
    category: 'accessible',
    fallback: SANS_FALLBACK,
    scale: 0.94,
    ui: true,
    letterSpacing: '0.01em',
    wordSpacing: '0.05em',
    italic: false,
    license: 'OFL'
  },
  {
    id: 'open-dyslexic',
    label: 'OpenDyslexic',
    family: 'OpenDyslexic',
    category: 'accessible',
    fallback: "'Atkinson Hyperlegible', Arial, sans-serif",
    scale: 0.88,
    ui: true,
    letterSpacing: '0.02em',
    wordSpacing: '0.08em',
    italic: true,
    license: 'Bitstream'
  },
  // ── Monospace (code, screenplays, typewriter drafts) ──
  mono('courier-prime', 'Courier Prime', 0.98),
  mono('ibm-plex-mono', 'IBM Plex Mono'),
  mono('jetbrains-mono', 'JetBrains Mono', 0.93),
  mono('source-code-pro', 'Source Code Pro', 0.94)
]

export const FONT_CATEGORIES: readonly FontCategory[] = ['serif', 'display', 'slab', 'sans', 'accessible', 'mono']

export const DEFAULT_FONT_PREFERENCE = 'source-serif-4'

/** Interface font: bundled, fixed, independent from the writing font. */
export const UI_FONT_DEFINITION = FONT_CATALOG.find((font) => font.id === 'ibm-plex-sans') as FontDefinition
export const MONO_FONT_DEFINITION = FONT_CATALOG.find((font) => font.id === 'ibm-plex-mono') as FontDefinition
export const HEADING_FONT_DEFINITION = FONT_CATALOG.find((font) => font.id === 'source-serif-4') as FontDefinition

/** Settings written by Pecie ≤ 0.1.9 used two symbolic values. */
const LEGACY_FONT_PREFERENCES: Record<string, string> = {
  classic: DEFAULT_FONT_PREFERENCE,
  dyslexic: 'open-dyslexic'
}

export function normalizeFontPreference(candidate: unknown): string {
  if (typeof candidate !== 'string') {
    return DEFAULT_FONT_PREFERENCE
  }
  const trimmed = candidate.trim()
  const aliased = LEGACY_FONT_PREFERENCES[trimmed] ?? trimmed
  return FONT_CATALOG.some((font) => font.id === aliased) ? aliased : DEFAULT_FONT_PREFERENCE
}

export function getFontDefinition(preference: unknown): FontDefinition {
  const id = normalizeFontPreference(preference)
  return FONT_CATALOG.find((font) => font.id === id) ?? (FONT_CATALOG[0] as FontDefinition)
}

export function fontFamilyStack(font: FontDefinition): string {
  return `'${font.family}', ${font.fallback}`
}

export function isAccessibilityFont(preference: unknown): boolean {
  return getFontDefinition(preference).category === 'accessible'
}
