import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BOOTSTRAP_ICON_PATHS } from '../icons/bootstrap-icon-paths'
import { iconNames, isIconName } from '../icons/registry'
import { Icon } from './icon'

describe('Icon', () => {
  it('embeds every glyph as inline SVG path data with a 16x16 viewBox', () => {
    expect(iconNames.length).toBeGreaterThanOrEqual(80)
    for (const name of iconNames) {
      const markup = renderToStaticMarkup(<Icon name={name} />)
      expect(markup, name).toMatch(/^<svg aria-hidden="true" class="pecie-icon bi bi-[a-z0-9-]+" data-icon="[a-z0-9-]+" fill="currentColor" focusable="false" viewBox="0 0 16 16"/)
      expect(markup, name).not.toMatch(/url\(|<img|<use|href=/)
      const paths = markup.match(/<path /g) ?? []
      expect(paths.length, name).toBe(BOOTSTRAP_ICON_PATHS[name].length)
      expect(paths.length, name).toBeGreaterThan(0)
      for (const path of BOOTSTRAP_ICON_PATHS[name]) {
        expect(path.d.length, name).toBeGreaterThan(10)
        expect(path.d, name).toMatch(/^[Mm]/)
      }
    }
  })

  it('is decorative by default and labelled on request', () => {
    expect(renderToStaticMarkup(<Icon name="gear" />)).toContain('aria-hidden="true"')
    const labelled = renderToStaticMarkup(<Icon label="Settings" name="gear" />)
    expect(labelled).toContain('role="img"')
    expect(labelled).toContain('aria-label="Settings"')
    expect(labelled).toContain('<title>Settings</title>')
    expect(labelled).not.toContain('aria-hidden')
  })

  it('keeps extra classes and the legacy bi-* hook for stylesheet selectors', () => {
    const markup = renderToStaticMarkup(<Icon className="format-chip__icon" name="type-bold" />)
    expect(markup).toContain('class="pecie-icon bi bi-type-bold format-chip__icon"')
    expect(isIconName('type-bold')).toBe(true)
    expect(isIconName('bi-type-bold')).toBe(false)
    expect(isIconName('toString')).toBe(false)
  })

  it('maps size onto the icon size token classes and keeps 1em by default', () => {
    expect(renderToStaticMarkup(<Icon name="gear" />)).not.toContain('pecie-icon--')
    expect(renderToStaticMarkup(<Icon name="gear" size="lg" />)).toContain('class="pecie-icon bi bi-gear pecie-icon--lg"')
  })
})
