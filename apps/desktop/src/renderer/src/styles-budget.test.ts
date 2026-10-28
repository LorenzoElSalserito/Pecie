import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const stylesRoot = path.resolve(process.cwd(), 'src/renderer/src/styles')
const MAX_LINES = 400

async function listCssFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await listCssFiles(fullPath)))
    else if (entry.name.endsWith('.css')) files.push(fullPath)
  }
  return files.sort()
}

describe('stylesheet budget (UI restructuring plan, Fase 2)', () => {
  it('keeps app.css as an import index only', async () => {
    const index = await readFile(path.join(stylesRoot, 'app.css'), 'utf8')
    const lines = index.split('\n').filter((line) => line.trim() && !line.trim().startsWith('/*') && !line.trim().startsWith('*'))
    expect(lines.length).toBeLessThan(60)
    for (const line of lines) expect(line, line).toMatch(/^@import '\.\/[a-z0-9-]+(\/[a-z0-9-]+)?\.css';$/)
  })

  it('imports every module exactly once and in the order the modules were certified', async () => {
    const index = await readFile(path.join(stylesRoot, 'app.css'), 'utf8')
    const imported = [...index.matchAll(/@import '\.\/([^']+)';/g)].map((match) => match[1])
    const modules = (await listCssFiles(stylesRoot))
      .map((file) => path.relative(stylesRoot, file))
      .filter((file) => file !== 'app.css' && file !== 'fonts.css')
    expect([...imported].sort()).toEqual(modules.sort())
    expect(new Set(imported).size).toBe(imported.length)
    expect(imported[0]).toBe('base/reset.css')
    expect(imported.at(-1)).toBe('base/a11y.css')
  })

  it('keeps every module under budget: no file above 400 lines, no !important outside a11y, no raw hex colors', async () => {
    for (const file of await listCssFiles(stylesRoot)) {
      const relative = path.relative(stylesRoot, file)
      if (relative === 'fonts.css') continue
      const source = await readFile(file, 'utf8')
      expect(source.split('\n').length, `${relative} exceeds ${MAX_LINES} lines`).toBeLessThanOrEqual(MAX_LINES)
      const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '')
      if (relative !== 'base/a11y.css') {
        expect(withoutComments, `${relative} uses !important`).not.toContain('!important')
      }
      expect(withoutComments, `${relative} uses a raw hex color`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })
})
