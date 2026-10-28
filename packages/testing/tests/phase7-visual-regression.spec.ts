import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

const appEntryPath = path.resolve(__dirname, '../../../apps/desktop/out/main/index.js')
const FREEZE_CSS = '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }'

async function launch(theme: 'light' | 'dark'): Promise<{ app: ElectronApplication; page: Page; home: string }> {
  const home = await mkdtemp(path.join(tmpdir(), 'pecie-visual-'))
  const appData = path.join(home, '.pecie')
  const workspace = path.join(home, 'workspace')
  await mkdir(appData, { recursive: true })
  await mkdir(workspace, { recursive: true })
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
      authorProfile: { name: 'Visual Tester', role: 'writer', preferredLanguage: 'en-US' },
      preview: { mode: 'ultra-performance', disclosuresSeen: { 'ultra-performance': true }, pageMarkers: { byProjectAndProfile: {} } },
      tutorialProgress: { completedTutorialIds: ['launcher-basics'], skippedTutorialIds: [] },
      onboardingCompleted: true
    })
  )
  const app = await electron.launch({ args: ['--no-sandbox', appEntryPath], env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1', HOME: home } })
  let page: Page | undefined
  for (let attempt = 0; attempt < 60 && !page; attempt += 1) {
    page = (await app.windows()).find((entry) => !entry.url().startsWith('data:text/html'))
    if (!page) await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (!page) throw new Error('Main renderer window did not appear.')
  await page.waitForLoadState('domcontentloaded')
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.addStyleTag({ content: FREEZE_CSS })
  // Paths differ per run: hide the dynamic workspace path so the reference stays stable.
  await page.addStyleTag({ content: '.meta-list__mono, .launcher-side code, input[value*="/tmp/"] { color: transparent !important; }' })
  return { app, page, home }
}

/**
 * Visual references live in packages/testing/visual (committed). Regenerate on purpose with
 * `xvfb-run -a npx playwright test tests/phase7-visual-regression.spec.ts --update-snapshots`
 * after a reviewed restyle; an unreviewed change fails here.
 */
test.describe('FASE 6 visual regression', () => {
  test.use({ viewport: { width: 1400, height: 900 } })
  for (const theme of ['light', 'dark'] as const) {
    test(`matches the reference screenshots (${theme})`, async () => {
      test.setTimeout(180_000)
      const { app, page, home } = await launch(theme)
      try {
        await page.getByLabel('Project title').waitFor()
        await page.waitForTimeout(900)
        await expect(page).toHaveScreenshot(`launcher-${theme}.png`, { maxDiffPixelRatio: 0.01 })
        await page.getByLabel('Project title').fill('Visual Project')
        await page.getByRole('button', { name: 'Start writing' }).click()
        await page.getByRole('tab', { name: 'Timeline' }).waitFor()
        const tools = page.getByRole('button', { name: 'Writing assistance tools' })
        if ((await tools.getAttribute('aria-pressed')) !== 'true') await tools.click()
        await page.locator('.format-chip').first().waitFor()
        await page.waitForTimeout(900)
        await expect(page).toHaveScreenshot(`workspace-${theme}.png`, { maxDiffPixelRatio: 0.02, mask: [page.locator('.editor-monaco'), page.locator('.toast-viewport')] })
        await page.getByRole('button', { name: 'More actions' }).click()
        await page.getByRole('menuitem', { name: 'Settings' }).click()
        await page.getByRole('dialog', { name: 'Settings' }).waitFor()
        await page.waitForTimeout(600)
        // Only the workspace path is run-specific; masking every input would also paint the ones
        // scrolled out of the settings pane over the screenshot.
        await expect(page).toHaveScreenshot(`settings-${theme}.png`, { maxDiffPixelRatio: 0.02, mask: [page.locator('#settings-section-workspace input').first()] })
        await page.keyboard.press('Escape')
        await page.getByRole('button', { name: 'Export' }).click()
        await page.getByRole('dialog', { name: 'Export' }).waitFor()
        await page.waitForTimeout(600)
        await expect(page).toHaveScreenshot(`export-${theme}.png`, { maxDiffPixelRatio: 0.02, mask: [page.locator('input')] })
      } finally {
        await app.close()
        await rm(home, { recursive: true, force: true })
      }
    })
  }
})
