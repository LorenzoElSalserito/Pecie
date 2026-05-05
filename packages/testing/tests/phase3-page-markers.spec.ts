import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

const appEntryPath = path.resolve(__dirname, '../../../apps/desktop/out/main/index.js')
const controlKey = process.platform === 'darwin' ? 'Meta' : 'Control'

async function seedSettings(homeDirectory: string): Promise<string> {
  const appDataDirectory = path.join(homeDirectory, '.pecie')
  const workspaceDirectory = path.join(homeDirectory, 'workspace')
  await mkdir(appDataDirectory, { recursive: true })
  await mkdir(workspaceDirectory, { recursive: true })
  await writeFile(
    path.join(appDataDirectory, 'app-settings.json'),
    JSON.stringify(
      {
        workspaceDirectory,
        locale: 'en-US',
        theme: 'light',
        fontPreference: 'classic',
        uiZoom: 100,
        recentProjectPaths: [],
        archivedProjectPaths: [],
        authorProfile: {
          name: 'Phase 3 Tester',
          role: 'writer',
          preferredLanguage: 'en-US'
        },
        preview: {
          mode: 'ultra-performance',
          disclosuresSeen: { 'ultra-performance': true },
          pageMarkers: {
            byProjectAndProfile: {}
          }
        },
        onboardingCompleted: true
      },
      null,
      2
    ),
    'utf8'
  )
  return workspaceDirectory
}

async function launchDesktop(): Promise<{
  electronApp: ElectronApplication
  page: Page
  homeDirectory: string
  workspaceDirectory: string
}> {
  const homeDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-e2e-page-markers-'))
  const workspaceDirectory = await seedSettings(homeDirectory)
  const electronApp = await electron.launch({
    args: ['--no-sandbox', appEntryPath],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SANDBOX: '1',
      HOME: homeDirectory
    }
  })

  const page = await waitForMainWindow(electronApp)
  return { electronApp, page, homeDirectory, workspaceDirectory }
}

async function waitForMainWindow(electronApp: ElectronApplication): Promise<Page> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const pages = await electronApp.windows()
    const mainPage = pages.find((entry) => !entry.url().startsWith('data:text/html'))
    if (mainPage) {
      await mainPage.waitForLoadState('domcontentloaded')
      return mainPage
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error('Main renderer window did not appear.')
}

async function createProjectWithTemplate(
  page: Page,
  projectTitle: string,
  templateLabel: 'Custom Blank' | 'Thesis'
): Promise<void> {
  await page.getByLabel('Project title').fill(projectTitle)
  await page.getByRole('radio', { name: new RegExp(`^${templateLabel}`) }).click()
  await page.getByRole('button', { name: 'Start writing' }).click()
  await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible()
}

async function openPrimaryDocument(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Show structure' }).click()
  await page
    .getByRole('treeitem')
    .filter({ hasText: /Scheda progetto|Project sheet|Introduzione|Introduction/ })
    .first()
    .click()
  await expect(page.getByLabel('Document title')).toBeVisible()
}

async function replaceEditorBody(page: Page, nextBody: string): Promise<void> {
  const editor = page.locator('.monaco-editor').first()
  await editor.click()
  await page.keyboard.press(`${controlKey}+a`)
  await page.keyboard.press('Backspace')
  await page.keyboard.type(nextBody)
}

async function manualSave(page: Page): Promise<void> {
  await page.keyboard.press(`${controlKey}+s`)
  await expect(page.getByText('Document saved.')).toBeVisible()
}

function longDocumentBody(): string {
  const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
  return Array.from({ length: 40 }, (_, index) => `Paragraph ${index + 1}. ${paragraph}`).join('\n\n')
}

test.describe('FASE 3 Page Boundary Markers', () => {
  test('renders estimated page markers on thesis projects even in ultra-performance mode', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop()

    try {
      await createProjectWithTemplate(page, 'Phase 3 Markers Thesis', 'Thesis')
      await openPrimaryDocument(page)
      await replaceEditorBody(page, longDocumentBody())
      await manualSave(page)

      const markerToggle = page.getByRole('button', { name: 'Show page end' })
      await expect(markerToggle).toHaveAttribute('aria-pressed', 'false')
      await markerToggle.click()
      await expect(markerToggle).toHaveAttribute('aria-pressed', 'true')

      const meta = page.locator('.editor-page-markers-meta')
      await expect(meta).toContainText('Estimated pagination')
      await expect(meta).toContainText('the final result depends on the export engine')
      await expect(meta).not.toContainText('This format does not have fixed pages')

      await expect(page.locator('.page-marker-glyph').first()).toBeVisible()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('keeps the toggle visible but suppresses markers on non-paginated formats', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop()

    try {
      await createProjectWithTemplate(page, 'Phase 3 Markers Blank', 'Custom Blank')
      await openPrimaryDocument(page)
      await replaceEditorBody(page, longDocumentBody())
      await manualSave(page)

      const markerToggle = page.getByRole('button', { name: 'Show page end' })
      await expect(markerToggle).toBeVisible()
      await markerToggle.click()
      await expect(markerToggle).toHaveAttribute('aria-pressed', 'true')

      const meta = page.locator('.editor-page-markers-meta')
      await expect(meta).toContainText('This format does not have fixed pages')
      await expect(page.locator('.page-marker-glyph')).toHaveCount(0)
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })
})
