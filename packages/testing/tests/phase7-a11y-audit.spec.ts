import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

const appEntryPath = path.resolve(__dirname, '../../../apps/desktop/out/main/index.js')
const axeSourcePath = path.resolve(__dirname, '../../../node_modules/axe-core/axe.min.js')
const reportPath = path.resolve(__dirname, '../../../docs/a11y/audit/axe-report.json')

type AxeViolation = { id: string; impact: string | null; help: string; nodes: Array<{ target: string[]; failureSummary?: string }> }

async function seed(home: string, theme: 'light' | 'dark', firstRun: boolean): Promise<void> {
  const appData = path.join(home, '.pecie')
  const workspace = path.join(home, 'workspace')
  await mkdir(appData, { recursive: true })
  await mkdir(workspace, { recursive: true })
  if (firstRun) return
  await writeFile(
    path.join(appData, 'app-settings.json'),
    JSON.stringify({
      workspaceDirectory: workspace,
      locale: 'en-US',
      theme,
      fontPreference: 'classic',
      uiZoom: 100,
      recentProjectPaths: [],
      archivedProjectPaths: [],
      expertModeEnabled: false,
      authorProfile: { name: 'Axe Auditor', role: 'writer', preferredLanguage: 'en-US' },
      preview: { mode: 'ultra-performance', disclosuresSeen: { 'ultra-performance': true }, pageMarkers: { byProjectAndProfile: {} } },
      tutorialProgress: { completedTutorialIds: ['launcher-basics'], skippedTutorialIds: [] },
      onboardingCompleted: true
    })
  )
}

async function launch(theme: 'light' | 'dark', firstRun = false): Promise<{ app: ElectronApplication; page: Page; home: string }> {
  const home = await mkdtemp(path.join(tmpdir(), 'pecie-axe-'))
  await seed(home, theme, firstRun)
  const app = await electron.launch({ args: ['--no-sandbox', appEntryPath], env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1', HOME: home } })
  let page: Page | undefined
  for (let attempt = 0; attempt < 60 && !page; attempt += 1) {
    page = (await app.windows()).find((entry) => !entry.url().startsWith('data:text/html'))
    if (!page) await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (!page) throw new Error('Main renderer window did not appear.')
  await page.waitForLoadState('domcontentloaded')
  await page.setViewportSize({ width: 1400, height: 900 })
  // Audit settled colours: enter animations blend foreground and background while they run.
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' })
  return { app, page, home }
}

async function audit(page: Page, state: string, results: Record<string, AxeViolation[]>): Promise<void> {
  await page.waitForTimeout(350)
  // The renderer CSP forbids inline scripts; evaluating the bundle through the DevTools protocol is not subject to it.
  const loaded = await page.evaluate(() => typeof (window as unknown as { axe?: unknown }).axe !== 'undefined')
  if (!loaded) {
    await page.evaluate(await readFile(axeSourcePath, 'utf8'))
  }
  const violations = (await page.evaluate(async () => {
    // Monaco's internal DOM is third-party and audited upstream; everything else is ours.
    const run = await (window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<{ violations: AxeViolation[] }> } }).axe.run(
      { exclude: [['.monaco-editor']] },
      { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }
    )
    return run.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.slice(0, 5).map((node) => ({ target: node.target as string[], failureSummary: node.failureSummary }))
    }))
  })) as AxeViolation[]
  results[state] = violations
}

test.describe('FASE 6 accessibility audit (axe-core)', () => {
  test('reports zero serious or critical violations on every screen, light and dark', async () => {
    test.setTimeout(240_000)
    const results: Record<string, AxeViolation[]> = {}
    for (const theme of ['light', 'dark'] as const) {
      const { app, page, home } = await launch(theme)
      try {
        await page.getByLabel('Project title').waitFor()
        await audit(page, `launcher-${theme}`, results)
        await page.getByRole('button', { name: 'Settings' }).first().click()
        await page.getByRole('dialog', { name: 'Settings' }).waitFor()
        await audit(page, `settings-${theme}`, results)
        await page.keyboard.press('Escape')
        await page.getByLabel('Project title').fill('Axe Project')
        await page.getByRole('button', { name: 'Start writing' }).click()
        await page.getByRole('tab', { name: 'Timeline' }).waitFor()
        const tools = page.getByRole('button', { name: 'Writing assistance tools' })
        if ((await tools.getAttribute('aria-pressed')) !== 'true') await tools.click()
        await page.locator('.format-chip').first().waitFor()
        await audit(page, `workspace-editor-${theme}`, results)
        await page.getByRole('button', { name: 'Export' }).click()
        await page.getByRole('dialog', { name: 'Export' }).waitFor()
        await audit(page, `export-${theme}`, results)
        await page.keyboard.press('Escape')
        await page.getByRole('button', { name: 'More actions' }).click()
        await page.getByRole('menuitem', { name: 'Guide Center' }).click()
        await page.getByRole('dialog', { name: 'Guide Center' }).waitFor()
        await audit(page, `guide-center-${theme}`, results)
        await page.keyboard.press('Escape')
        for (const view of ['Timeline', 'Research', 'Outliner', 'Corkboard']) {
          await page.getByRole('tab', { name: view }).click()
          await page.waitForTimeout(300)
          await audit(page, `view-${view.toLowerCase()}-${theme}`, results)
        }
      } finally {
        await app.close()
        await rm(home, { recursive: true, force: true })
      }
    }
    const first = await launch('light', true)
    try {
      await first.page.getByRole('button', { name: 'Change font' }).waitFor()
      await audit(first.page, 'wizard-light', results)
    } finally {
      await first.app.close()
      await rm(first.home, { recursive: true, force: true })
    }

    const summary = Object.fromEntries(
      Object.entries(results).map(([state, violations]) => [state, violations.map((violation) => `${violation.impact}: ${violation.id} (${violation.nodes.length} nodes)`)])
    )
    await writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, results }, null, 2))

    const blocking = Object.entries(results).flatMap(([state, violations]) =>
      violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical').map((violation) => `${state}: ${violation.id} — ${violation.help} — ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`)
    )
    expect(blocking, blocking.join('\n')).toEqual([])
  })
})
