import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FONT_PREFERENCE,
  FONT_CATALOG,
  FONT_CATEGORIES,
  fontFamilyStack,
  getFontDefinition,
  normalizeFontPreference
} from './fonts'

const repoRoot = path.resolve(process.cwd(), '../..')
const rendererRoot = path.join(repoRoot, 'apps/desktop/src/renderer/src')

describe('bundled font catalog', () => {
  it('has unique ids, valid categories and a resolvable default', () => {
    const ids = FONT_CATALOG.map((font) => font.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(DEFAULT_FONT_PREFERENCE)
    for (const font of FONT_CATALOG) {
      expect(FONT_CATEGORIES).toContain(font.category)
      expect(font.id).toMatch(/^[a-z0-9-]+$/)
      expect(font.scale).toBeGreaterThan(0.8)
      expect(font.scale).toBeLessThan(1.25)
    }
    expect(FONT_CATALOG.length).toBeGreaterThanOrEqual(50)
  })

  it('normalizes legacy and unknown preferences', () => {
    expect(normalizeFontPreference('classic')).toBe(DEFAULT_FONT_PREFERENCE)
    expect(normalizeFontPreference('dyslexic')).toBe('open-dyslexic')
    expect(normalizeFontPreference(' crimson-pro ')).toBe('crimson-pro')
    expect(normalizeFontPreference('comic-sans')).toBe(DEFAULT_FONT_PREFERENCE)
    expect(normalizeFontPreference(undefined)).toBe(DEFAULT_FONT_PREFERENCE)
    expect(getFontDefinition('dyslexic').ui).toBe(true)
    expect(fontFamilyStack(getFontDefinition('lora'))).toMatch(/^'Lora', /)
  })

  it('ships a query-less local @font-face for every catalog family', async () => {
    const css = await readFile(path.join(rendererRoot, 'styles/fonts.css'), 'utf8')
    for (const font of FONT_CATALOG) {
      expect(css, `missing @font-face for ${font.family}`).toContain(`font-family: '${font.family}';`)
    }
    const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map((match) => match[1])
    expect(urls.length).toBeGreaterThan(FONT_CATALOG.length)
    for (const url of urls) {
      expect(url, `remote or query URL in fonts.css: ${url}`).toMatch(/^\.\.\/asset\/fonts\/[^?#]+$/)
      const fileStat = await stat(path.join(rendererRoot, 'styles', url))
      expect(fileStat.size).toBeGreaterThan(1000)
    }
  })
})
