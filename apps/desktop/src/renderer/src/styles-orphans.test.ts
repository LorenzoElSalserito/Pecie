import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(process.cwd(), '../..')
const stylesRoot = path.join(repoRoot, 'apps/desktop/src/renderer/src/styles')
const sourceRoots = [path.join(repoRoot, 'apps/desktop/src/renderer/src'), path.join(repoRoot, 'packages/ui/src'), path.join(repoRoot, 'packages/domain/src')]

async function walk(directory: string, accept: (name: string) => boolean): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'asset' || entry.name === 'styles') continue
      files.push(...(await walk(fullPath, accept)))
    } else if (accept(entry.name)) files.push(fullPath)
  }
  return files
}

/**
 * Classes that are produced dynamically (template literals, BEM modifiers built from state, Monaco
 * and library hooks). A class listed here is allowed to appear only in CSS.
 */
const DYNAMIC_PREFIXES = ['monaco-', 'mtk', 'view-', 'margin', 'page-marker', 'fade-in-up', 'tutorial-target', 'save-indicator--', 'toast--', 'status-pill--', 'binder-tree__item--', 'binder-tree__marker--', 'binder-node-badge--', 'segmented-control__item--', 'editor-layout--', 'editor-pane--', 'editor-surface--', 'editor-monaco--', 'editor-footer__session--', 'workspace-grid--', 'workspace-binder--', 'workspace-context--', 'template-card--', 'context-section__body--', 'tutorial-coach__card--', 'tutorial-coach__segment--', 'setup-step--', 'wizard-progress__step--', 'wizard-progress__connector--', 'font-picker__option--', 'binder-tree__progress-fill--', 'empty-state__icon--', 'pecie-btn--', 'pecie-icon--', 'toggle-chip--', 'format-chip__', 'radio-group__option--', 'settings-nav__item--', 'timeline-item--', 'corkboard-card--', 'scrivenings-sheet--', 'outliner-table__row--', 'link-list-button--', 'message-box--', 'workspace-view-chip--', 'context-card--', 'attachment-preview-text--', 'dialog-card--', 'history-diff-pane__content--', 'quick-resume-banner', 'binder-search--', 'binder-attachments--', 'binder-actions--', 'context-metric-row--', 'dialog-actions--', 'field--', 'field-input-shell__placeholder--', 'stack-list--', 'section-heading--', 'guide-grid--', 'launcher-main__action-group--', 'launcher-hero__', 'workspace-header--', 'workspace-toggle__icon--', 'guide-center__nav-item--', 'binder-tree__section-divider--', 'binder-tree__section-divider-icon--', 'binder-tree__disclosure--', 'field-hint--', 'resize-handle--', 'workspace-header__action-group--', 'setup-overview__', 'pecie-tooltip-', 'global-search-', 'privacy-', 'meta-list__', 'context-pulse-', 'writing-hub-', 'editor-blueprint', 'metric-grid', 'welcome-', 'hero-commitments', 'template-gallery', 'template-preview', 'template-picker', 'attachment-row', 'support-library', 'contribution-', 'context-status-strip', 'timeline-view-', 'timeline-compact-event', 'research-view__', 'workspace-view-kpi', 'editor-toolbar', 'prose-block', 'citation-library-diagnostic__severity--']

describe('stylesheet selectors are backed by markup', () => {
  it('reports every class selector that no component or primitive renders', async () => {
    const cssFiles = await walk(stylesRoot, (name) => name.endsWith('.css') && name !== 'fonts.css')
    const sourceFiles = (await Promise.all(sourceRoots.map((root) => walk(root, (name) => /\.(tsx?|json)$/.test(name) && !/\.test\./.test(name))))).flat()
    const sources = (await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')))).join('\n')
    const declared = new Set<string>()
    for (const file of cssFiles) {
      const css = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '')
      for (const match of css.matchAll(/\.([a-zA-Z_][\w-]*)/g)) declared.add(match[1])
    }
    const orphans = [...declared].filter((className) => !sources.includes(className) && !DYNAMIC_PREFIXES.some((prefix) => className.startsWith(prefix)))
    expect(orphans.sort(), `orphan selectors: ${orphans.sort().join(', ')}`).toEqual([])
  })
})
