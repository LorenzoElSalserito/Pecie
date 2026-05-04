import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

const appEntryPath = path.resolve(__dirname, '../../../apps/desktop/out/main/index.js')

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
          name: 'Phase 3 Share Tester',
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
  const homeDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-e2e-share-'))
  const workspaceDirectory = await seedSettings(homeDirectory)
  const electronApp = await electron.launch({
    args: [appEntryPath],
    env: {
      ...process.env,
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

async function openShareDialog(page: Page) {
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Secure sharing' }).click()
  await expect(page.getByRole('dialog', { name: 'Secure sharing' })).toBeVisible()
  return page.getByRole('dialog', { name: 'Secure sharing' })
}

test.describe('FASE 3 Share Workspace', () => {
  test('shows the privacy review for packages that include full history', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop()

    try {
      await createBlankProject(page, 'Phase 3 Share Preview')
      const shareDialog = await openShareDialog(page)

      await shareDialog.getByRole('combobox').first().selectOption('current-plus-full-history')
      await shareDialog.getByRole('button', { name: 'Preview privacy' }).click()

      await expect(shareDialog.getByRole('heading', { name: 'Privacy review' })).toBeVisible()
      await expect(shareDialog.getByRole('definition').filter({ hasText: 'Current snapshot + full history' })).toBeVisible()
      await expect(
        shareDialog.getByText('Local Git history is included: content removed in the past may still be recoverable.')
      ).toBeVisible()
      await expect(shareDialog.getByText('critical')).toHaveCount(2)
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('creates a share package and writes the archive to disk', async () => {
    const { electronApp, page, homeDirectory, workspaceDirectory } = await launchDesktop()

    try {
      await createBlankProject(page, 'Phase 3 Share Import')

      const shareDialog = await openShareDialog(page)
      const packagePath = path.join(workspaceDirectory, 'phase-3-share-import-package.pe-share')

      await shareDialog.locator('input').nth(1).fill(packagePath)
      await shareDialog.getByRole('button', { name: 'Create package' }).click()

      await expect(shareDialog.getByText('Share package created.')).toBeVisible()
      await expect(shareDialog.getByRole('listitem').filter({ hasText: packagePath })).toBeVisible()
      await access(packagePath)
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('imports a share package as a derived project in the workspace', async () => {
    const { electronApp, page, homeDirectory, workspaceDirectory } = await launchDesktop()

    try {
      await createBlankProject(page, 'Phase 3 Share Roundtrip')

      const shareDialog = await openShareDialog(page)
      const packagePath = path.join(workspaceDirectory, 'phase-3-share-roundtrip-package.pe-share')
      const importedProjectPath = path.join(workspaceDirectory, 'phase-3-share-roundtrip-01.pe')

      await shareDialog.getByLabel('Output path').fill(packagePath)
      await shareDialog.getByRole('button', { name: 'Create package' }).click()
      await expect(shareDialog.getByText('Share package created.')).toBeVisible()
      await access(packagePath)

      await shareDialog.getByLabel('.pe-share file').fill(packagePath)
      await shareDialog.getByRole('button', { name: 'Import package' }).click()

      await expect(shareDialog.getByText('Share package imported.')).toBeVisible()
      await expect(shareDialog.getByRole('listitem').filter({ hasText: importedProjectPath })).toBeVisible()
      await expect
        .poll(async () => {
          try {
            await access(path.join(importedProjectPath, 'manifest.json'))
            return true
          } catch {
            return false
          }
        })
        .toBe(true)

      const importedManifest = await readFile(path.join(importedProjectPath, 'manifest.json'), 'utf8')
      expect(importedManifest).toContain('shared')
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })
})
