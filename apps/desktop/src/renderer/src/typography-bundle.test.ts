import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(process.cwd(), '../..')
const rendererRoot = path.join(repoRoot, 'apps/desktop/src/renderer/src')

async function listSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'asset') continue
      files.push(...(await listSourceFiles(fullPath)))
    } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }
  return files
}

describe('zero-dependency typography and icons', () => {
  it('never imports icon or font assets from npm packages', async () => {
    const files = await listSourceFiles(rendererRoot)
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      expect(source, `${path.relative(repoRoot, file)} imports a font/icon package`).not.toMatch(
        /from ['"](bootstrap-icons|open-dyslexic|@fontsource|typeface-)|import ['"](bootstrap-icons|open-dyslexic)/
      )
    }
    const rootPackage = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const allDependencies = { ...rootPackage.dependencies, ...rootPackage.devDependencies }
    expect(Object.keys(allDependencies)).not.toContain('bootstrap-icons')
    expect(Object.keys(allDependencies)).not.toContain('open-dyslexic')
  })

  it('bundles Bootstrap Icons with query-less local font URLs and the full glyph map', async () => {
    const css = await readFile(path.join(rendererRoot, 'styles/bootstrap-icons.css'), 'utf8')
    const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map((match) => match[1])
    expect(urls).toEqual([
      '../asset/fonts/bootstrap-icons/bootstrap-icons.woff2',
      '../asset/fonts/bootstrap-icons/bootstrap-icons.woff'
    ])
    for (const url of urls) {
      expect((await stat(path.join(rendererRoot, 'styles', url))).size).toBeGreaterThan(100_000)
    }
    expect((css.match(/^\.bi-[a-z0-9-]+::before/gm) ?? []).length).toBeGreaterThan(2000)

    // Every `bi-*` class referenced by the UI must exist in the vendored map.
    const files = await listSourceFiles(rendererRoot)
    const referenced = new Set<string>()
    for (const file of files) {
      if (file.endsWith('.css')) continue
      const source = await readFile(file, 'utf8')
      for (const match of source.matchAll(/\bbi-[a-z0-9-]+/g)) {
        referenced.add(match[0])
      }
    }
    for (const iconClass of referenced) {
      expect(css, `${iconClass} is not part of the vendored Bootstrap Icons map`).toContain(`.${iconClass}::before`)
    }
  })

  it('embeds every editor toolbar icon as inline SVG path data', async () => {
    const editorSurface = await readFile(path.join(rendererRoot, 'components/EditorSurface.tsx'), 'utf8')
    expect(editorSurface).not.toMatch(/\.svg['"]/)
    expect(editorSurface).toContain("import { ToolbarIcon, type ToolbarIconName } from './ToolbarIcons'")
    const referenced = [...editorSurface.matchAll(/icon: '([a-z0-9-]+)'/g)].map((match) => match[1])
    expect(referenced.length).toBeGreaterThan(20)
    const iconsModule = await readFile(path.join(rendererRoot, 'components/ToolbarIcons.tsx'), 'utf8')
    for (const name of referenced) {
      expect(iconsModule, `${name} is missing from ToolbarIcons.tsx`).toContain(`'${name}': [`)
    }
    expect(iconsModule).not.toMatch(/url\(|import .* from '\.\.\/asset/)
  })

  it('does not load fonts from the network or with cache-busting queries in the main stylesheet', async () => {
    const css = await readFile(path.join(rendererRoot, 'styles/app.css'), 'utf8')
    expect(css).not.toMatch(/@font-face\s*\{/)
    expect(css).not.toMatch(/url\((['"]?)https?:/)
  })
})
