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
        fontPreference: 'dyslexic',
        uiZoom: 100,
        recentProjectPaths: [],
        archivedProjectPaths: [],
        authorProfile: {
          name: 'Phase 2 Tester',
          role: 'writer',
          preferredLanguage: 'en-US'
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
  const homeDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-e2e-home-'))
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

async function createBlankProject(page: Page, projectTitle: string): Promise<void> {
  await page.getByLabel('Project title').fill(projectTitle)
  await page.getByRole('button', { name: 'Start writing' }).click()
  await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible()
}

async function openPrimaryDocument(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Show structure' }).click()
  await page.getByRole('treeitem', { name: /Scheda progetto/ }).click()
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

test.describe('FASE 2 Timeline', () => {
  test('opens Timeline as a central view and creates a milestone from real project history', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop()

    try {
      await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.font)).toBe('dyslexic')
      await createBlankProject(page, 'Phase 2 Timeline')
      await openPrimaryDocument(page)
      await replaceEditorBody(page, 'Alpha beta gamma.')
      await manualSave(page)

      await page.getByRole('tab', { name: 'Timeline' }).click()
      await expect(page.locator('.workspace-alt-view--timeline h2', { hasText: 'Timeline' })).toBeVisible()

      await page.getByLabel('Milestone label').fill('Phase 2 milestone')
      await page.getByRole('button', { name: 'Create milestone' }).click()

      await expect(page.getByText('Milestone created.')).toBeVisible()
      await expect(page.locator('.timeline-item').filter({ hasText: 'Phase 2 milestone' })).toBeVisible()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('compares a historical checkpoint and restores selected historical text into the current document', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop()

    try {
      await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.font)).toBe('dyslexic')
      await createBlankProject(page, 'Phase 2 Restore Selection')
      await openPrimaryDocument(page)

      await replaceEditorBody(page, 'Alpha beta gamma.')
      await manualSave(page)

      await replaceEditorBody(page, 'Delta')
      await manualSave(page)

      await page.getByRole('tab', { name: 'Timeline' }).click()
      const compareButtons = page.locator('.timeline-view-main').getByRole('button', { name: 'Compare' })
      await expect(compareButtons.first()).toBeVisible()
      await compareButtons.first().click()

      const historicalTextarea = page.locator('.history-diff-pane textarea').first()
      await expect(historicalTextarea).toBeVisible()
      await historicalTextarea.evaluate((element) => {
        const textarea = element as HTMLTextAreaElement
        textarea.focus()
        const startOffset = textarea.value.indexOf(' beta')
        const endOffset = startOffset + ' beta'.length
        textarea.setSelectionRange(startOffset, endOffset)
        textarea.dispatchEvent(new Event('select', { bubbles: true }))
      })

      await page.getByRole('button', { name: 'Recover selected text' }).click()
      await expect(page.getByText('Historical text inserted back into the current document.')).toBeVisible()

      await page.getByRole('tab', { name: 'Editor' }).click()
      await expect(page.locator('.view-lines').first()).toContainText('Delta beta')
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })
})
