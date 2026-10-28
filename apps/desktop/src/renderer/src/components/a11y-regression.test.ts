import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(process.cwd(), '../..')

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), 'utf8')
}

describe('desktop accessibility regressions', () => {
  it('keeps the versioned accessibility audit matrix in the repository', async () => {
    const auditMatrix = await readRepoFile('docs/a11y/audit/audit-matrix.md')

    expect(auditMatrix).toContain('Pecie Accessibility Audit Matrix')
    expect(auditMatrix).toContain('Dialog')
    expect(auditMatrix).toContain('Tablist')
    expect(auditMatrix).toContain('Manual Pass Queue')
  })

  it('keeps workspace and editor tablists on a single tab stop through the design-system primitives', async () => {
    const workspaceHeader = await readRepoFile('apps/desktop/src/renderer/src/components/WorkspaceHeader.tsx')
    const editorSurface = await readRepoFile('apps/desktop/src/renderer/src/components/editor/EditorStatusBar.tsx')
    const tabs = await readRepoFile('packages/ui/src/components/tabs.tsx')
    const segmented = await readRepoFile('packages/ui/src/components/segmented-control.tsx')

    expect(workspaceHeader).toContain('<Tabs')
    expect(workspaceHeader).toContain('value={workspaceView}')
    expect(editorSurface).toContain('<SegmentedControl')
    expect(editorSurface).toContain('value={viewMode}')
    for (const source of [tabs, segmented]) {
      expect(source).toContain('role="tablist"')
      expect(source).toContain('tabIndex={active ? 0 : -1}')
      expect(source).toMatch(/ArrowRight|ArrowLeft/)
    }
  })

  it('keeps collapsed binder icon controls named for screen readers', async () => {
    const binderPanel = await readRepoFile('apps/desktop/src/renderer/src/components/BinderPanel.tsx')

    expect(binderPanel).toContain("aria-label={collapsed ? t(locale, 'newNode') : undefined}")
    expect(binderPanel).toContain("aria-label={t(locale, 'moveUp')}")
    expect(binderPanel).toContain("aria-label={t(locale, 'moveDown')}")
    expect(binderPanel).toContain("aria-label={t(locale, 'deleteNode')}")
    expect(binderPanel).not.toContain('role="tree" tabIndex={0}')
  })
})
