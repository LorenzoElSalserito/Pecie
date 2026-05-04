import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
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
          name: 'Phase 3 Export Tester',
          role: 'writer',
          preferredLanguage: 'en-US'
        },
        preview: {
          mode: 'performance',
          disclosuresSeen: { performance: true },
          pageMarkers: {
            byProjectAndProfile: {}
          },
          exportPreview: {
            byProfile: {},
            globalDefault: false
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
  const homeDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-e2e-export-preview-'))
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

async function openExportDialog(page: Page) {
  await page.getByRole('button', { name: 'Export' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export content' })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('FASE 3 Export Preview', () => {
  test('shows the full export format matrix for custom blank projects', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop()

    try {
      await createBlankProject(page, 'Phase 3 Export Matrix')
      const exportDialog = await openExportDialog(page)
      const formatSelect = exportDialog.locator('select').first()

      const formatValues = await formatSelect.evaluate((element) =>
        Array.from((element as HTMLSelectElement).options).map((option) => option.value)
      )

      expect(formatValues).toEqual(['pdf', 'docx', 'odt', 'rtf', 'epub', 'html', 'latex', 'jats', 'tei', 'md', 'txt'])
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('keeps export output unwritten until preview is confirmed', async () => {
    const { electronApp, page, homeDirectory, workspaceDirectory } = await launchDesktop()

    try {
      await createBlankProject(page, 'Phase 3 Export Preview')
      const projectPath = path.join(workspaceDirectory, 'phase-3-export-preview.pe')
      const outputPath = path.join(projectPath, 'exports/out/phase-3-export-preview.md')

      let exportDialog = await openExportDialog(page)
      await exportDialog.locator('select').first().selectOption('md')
      await exportDialog.getByLabel('Output path').fill(outputPath)
      await exportDialog.getByLabel('Show preview before saving').check()
      await exportDialog.getByRole('button', { name: 'Start export' }).click()

      await expect(exportDialog.getByRole('heading', { name: 'Export preview' })).toBeVisible()
      await expect(exportDialog.getByText('Text preview: exported content without graphical pagination.')).toBeVisible()
      await expect(exportDialog.getByRole('button', { name: 'Confirm and export' })).toBeVisible()

      await expect(async () => access(outputPath)).rejects.toThrow()

      await exportDialog.getByRole('button', { name: 'Modify' }).click()
      await expect(exportDialog).toBeHidden()

      exportDialog = await openExportDialog(page)
      await expect(exportDialog.locator('select').first()).toHaveValue('md')
      await expect(exportDialog.getByLabel('Show preview before saving')).toBeChecked()

      await exportDialog.getByRole('button', { name: 'Start export' }).click()
      await expect(exportDialog.getByRole('button', { name: 'Confirm and export' })).toBeVisible()
      await exportDialog.getByRole('button', { name: 'Confirm and export' }).click()

      await expect
        .poll(async () => {
          try {
            await access(outputPath)
            return true
          } catch {
            return false
          }
        })
        .toBe(true)
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('shows approximate preview warning for office document formats before writing', async () => {
    const { electronApp, page, homeDirectory, workspaceDirectory } = await launchDesktop()

    try {
      await createBlankProject(page, 'Phase 3 Approximate Preview')
      const projectPath = path.join(workspaceDirectory, 'phase-3-approximate-preview.pe')
      const outputPath = path.join(projectPath, 'exports/out/phase-3-approximate-preview.docx')

      const exportDialog = await openExportDialog(page)
      await exportDialog.locator('select').first().selectOption('docx')
      await exportDialog.getByLabel('Output path').fill(outputPath)
      await exportDialog.getByLabel('Show preview before saving').check()
      await exportDialog.getByRole('button', { name: 'Start export' }).click()

      await expect(exportDialog.getByRole('heading', { name: 'Export preview' })).toBeVisible()
      await expect(
        exportDialog.getByText('Approximate preview: final rendering depends on the reading client.')
      ).toBeVisible()
      await expect(exportDialog.locator('.attachment-preview-text--rich')).toBeVisible()
      await expect(exportDialog.getByRole('button', { name: 'Confirm and export' })).toBeVisible()

      await expect(async () => access(outputPath)).rejects.toThrow()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })
})
