import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(process.cwd(), '../..')

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), 'utf8')
}

describe('desktop accessibility regressions', () => {
  it('keeps the versioned accessibility audit matrix in the repository', async () => {
    const auditMatrix = await readRepoFile('docs/a11y/audit-matrix.md')

    expect(auditMatrix).toContain('Pecie Accessibility Audit Matrix')
    expect(auditMatrix).toContain('Dialog')
    expect(auditMatrix).toContain('Tablist')
    expect(auditMatrix).toContain('Manual Pass Queue')
  })

  it('keeps workspace and editor tablists on a single tab stop', async () => {
    const workspaceHeader = await readRepoFile('apps/desktop/src/renderer/src/components/WorkspaceHeader.tsx')
    const editorSurface = await readRepoFile('apps/desktop/src/renderer/src/components/EditorSurface.tsx')

    expect(workspaceHeader).toContain('role="tablist"')
    expect(workspaceHeader).toContain('tabIndex={workspaceView === view ? 0 : -1}')
    expect(editorSurface).toContain('role="tablist"')
    expect(editorSurface).toContain('tabIndex={viewMode === mode ? 0 : -1}')
  })

  it('keeps collapsed binder icon controls named for screen readers', async () => {
    const binderPanel = await readRepoFile('apps/desktop/src/renderer/src/components/BinderPanel.tsx')

    expect(binderPanel).toContain("aria-label={collapsed ? t(locale, 'newNode') : undefined}")
    expect(binderPanel).toContain("aria-label={collapsed ? t(locale, 'moveUp') : undefined}")
    expect(binderPanel).toContain("aria-label={collapsed ? t(locale, 'moveDown') : undefined}")
    expect(binderPanel).toContain("aria-label={collapsed ? t(locale, 'deleteNode') : undefined}")
    expect(binderPanel).not.toContain('role="tree" tabIndex={0}')
  })
})
