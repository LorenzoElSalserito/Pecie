import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(process.cwd(), '../..')
const rendererRoot = path.join(repoRoot, 'apps/desktop/src/renderer/src')
const uiRoot = path.join(repoRoot, 'packages/ui/src')

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

  it('ships no icon font: every icon is an embedded SVG glyph rendered by <Icon>', async () => {
    const rendererFiles = await listSourceFiles(rendererRoot)
    const uiFiles = await listSourceFiles(uiRoot)
    for (const file of [...rendererFiles, ...uiFiles]) {
      if (/\.test\.tsx?$/.test(file)) continue
      const source = await readFile(file, 'utf8')
      const relative = path.relative(repoRoot, file)
      if (file.endsWith('.css')) {
        expect(source, `${relative} declares an icon font`).not.toMatch(/font-family:\s*['"]?bootstrap-icons/)
        expect(source, `${relative} references the removed icon font`).not.toMatch(/bootstrap-icons\.(woff2?|css)/)
        continue
      }
      expect(source, `${relative} still renders an icon through a font class`).not.toMatch(/<i\b[^>]*className=["'`{][^>]*\bbi\b/)
      expect(source, `${relative} uses a bi- prefixed icon name`).not.toMatch(/['"`]bi-[a-z0-9-]+['"`]/)
      expect(source, `${relative} imports the removed icon stylesheet`).not.toContain('bootstrap-icons.css')
    }
    await expect(readdir(path.join(rendererRoot, 'asset/fonts/bootstrap-icons'))).rejects.toThrow()
  })

  it('references only icon names that exist in the embedded Bootstrap Icons subset', async () => {
    const iconsModule = await readFile(path.join(uiRoot, 'icons/bootstrap-icon-paths.ts'), 'utf8')
    const embedded = new Set([...iconsModule.matchAll(/^ {2}'([a-z0-9-]+)': \[/gm)].map((match) => match[1]))
    expect(embedded.size).toBeGreaterThanOrEqual(80)
    const iconsCode = iconsModule.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(iconsCode).not.toMatch(/url\(|import .* from '\.\.\/asset|https?:\/\//)

    const files = [...(await listSourceFiles(rendererRoot)), ...(await listSourceFiles(uiRoot))].filter(
      (file) => !file.endsWith('.css') && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx') && !file.endsWith('bootstrap-icon-paths.ts')
    )
    const referenced = new Map<string, string>()
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      for (const match of source.matchAll(/\b(?:name|icon)(?:=|:\s*)['"]([a-z0-9][a-z0-9-]*)['"]/g)) {
        referenced.set(match[1], path.relative(repoRoot, file))
      }
      for (const match of source.matchAll(/\bname=\{[^}]*\}/g)) {
        for (const literal of match[0].matchAll(/[?:]\s*'([a-z0-9][a-z0-9-]*)'/g)) referenced.set(literal[1], path.relative(repoRoot, file))
      }
    }
    for (const file of await readdir(path.join(rendererRoot, 'tutorials/local'))) {
      const tutorial = JSON.parse(await readFile(path.join(rendererRoot, 'tutorials/local', file), 'utf8')) as { icon?: string }
      if (tutorial.icon) referenced.set(tutorial.icon, `tutorials/local/${file}`)
    }
    expect(referenced.size).toBeGreaterThan(40)
    for (const [name, file] of referenced) {
      expect(embedded.has(name), `${name} (used in ${file}) is not part of the embedded icon subset`).toBe(true)
    }
  })

  it('embeds every editor toolbar icon as inline SVG path data', async () => {
    const editorSurface = await readFile(path.join(rendererRoot, 'components/EditorSurface.tsx'), 'utf8')
    const formattingBar = await readFile(path.join(rendererRoot, 'components/editor/EditorFormattingBar.tsx'), 'utf8')
    expect(editorSurface).not.toMatch(/\.svg['"]/)
    expect(formattingBar).toMatch(/import \{[^}]*\bIcon\b[^}]*\} from '@pecie\/ui'/)
    expect(formattingBar).toContain('<Icon className="format-chip__icon" name={entry.icon} />')
    const referenced = [...editorSurface.matchAll(/icon: '([a-z0-9-]+)'/g)].map((match) => match[1])
    expect(referenced.length).toBeGreaterThan(20)
    const iconsModule = await readFile(path.join(uiRoot, 'icons/bootstrap-icon-paths.ts'), 'utf8')
    for (const name of referenced) {
      expect(iconsModule, `${name} is missing from bootstrap-icon-paths.ts`).toContain(`'${name}': [`)
    }
  })

  it('does not load fonts from the network or with cache-busting queries in the stylesheet modules', async () => {
    const files = (await listSourceFiles(path.join(rendererRoot, 'styles'))).filter((file) => file.endsWith('.css') && !file.endsWith('fonts.css'))
    expect(files.length).toBeGreaterThan(20)
    let iconRule = false
    for (const file of files) {
      const css = await readFile(file, 'utf8')
      expect(css, file).not.toMatch(/@font-face\s*\{/)
      expect(css, file).not.toMatch(/url\((['"]?)https?:/)
      if (/\.pecie-icon\s*\{[^}]*width:\s*1em/.test(css)) iconRule = true
    }
    expect(iconRule).toBe(true)
  })
})
