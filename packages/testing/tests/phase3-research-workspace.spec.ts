import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
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
          name: 'Phase 3 Research Tester',
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
}> {
  const homeDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-e2e-research-'))
  await seedSettings(homeDirectory)
  const electronApp = await electron.launch({
    args: ['--no-sandbox', appEntryPath],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SANDBOX: '1',
      HOME: homeDirectory
    }
  })

  const page = await waitForMainWindow(electronApp)
  return { electronApp, page, homeDirectory }
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

async function writeTinyPdf(filePath: string): Promise<void> {
  await writeFile(
    filePath,
    [
      '%PDF-1.4',
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
      '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj',
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R>>endobj',
      '4 0 obj<</Length 44>>stream',
      'BT /F1 12 Tf 40 120 Td (Research Alpha) Tj ET',
      'endstream endobj',
      'xref',
      '0 5',
      '0000000000 65535 f ',
      '0000000009 00000 n ',
      '0000000058 00000 n ',
      '0000000115 00000 n ',
      '0000000202 00000 n ',
      'trailer<</Size 5/Root 1 0 R>>',
      'startxref',
      '296',
      '%%EOF'
    ].join('\n'),
    'utf8'
  )
}

test.describe('FASE 3 Research Workspace', () => {
  test('creates a research note and shows it in the notes list plus the detail pane', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop()

    try {
      await createBlankProject(page, 'Phase 3 Research')

      await page.getByRole('tab', { name: 'Research' }).click()
      await expect(page.getByRole('heading', { name: 'Research workspace' })).toBeVisible()

      const researchRoot = page.locator('.research-view')
      const titleField = researchRoot.getByLabel('Project title')
      await titleField.fill('Alpha observation')
      await researchRoot
        .getByLabel('Document')
        .fill('Notes from review of alpha sources.')

      await researchRoot.getByRole('button', { name: 'Create note' }).click()

      await expect(page.getByText('Research note created.')).toBeVisible()
      await expect(researchRoot.getByRole('button', { name: /Alpha observation/ })).toBeVisible()

      await researchRoot.getByRole('button', { name: /Alpha observation/ }).click()
      await expect(researchRoot.getByText('Notes from review of alpha sources.')).toBeVisible()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('keeps the link composer disabled until a note and a target exist', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop()

    try {
      await createBlankProject(page, 'Phase 3 Research Links')

      await page.getByRole('tab', { name: 'Research' }).click()
      await expect(page.getByRole('heading', { name: 'Research workspace' })).toBeVisible()

      const researchRoot = page.locator('.research-view')
      await expect(researchRoot.getByRole('button', { name: /Link note.*PDF/i })).toBeDisabled()
      await expect(researchRoot.getByRole('button', { name: /Link note.*document/i })).toBeDisabled()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('imports a PDF, opens the split pane and links a note to the PDF', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop()

    try {
      const pdfPath = path.join(homeDirectory, 'alpha-source.pdf')
      await writeTinyPdf(pdfPath)
      await createBlankProject(page, 'Phase 3 Research PDF')

      await page.getByRole('tab', { name: 'Research' }).click()
      await expect(page.getByRole('heading', { name: 'Research workspace' })).toBeVisible()

      const researchRoot = page.locator('.research-view')
      await researchRoot.getByLabel('Project title').fill('Alpha PDF note')
      await researchRoot.getByLabel('Document').fill('Evidence extracted from the imported PDF.')
      await researchRoot.getByRole('button', { name: 'Create note' }).click()
      await expect(page.getByText('Research note created.')).toBeVisible()

      await researchRoot.getByLabel('PDF paths').fill(pdfPath)
      await researchRoot.getByRole('button', { name: 'Import PDF paths' }).click()
      await expect(page.getByText('1 PDFs imported into the research library.')).toBeVisible()
      await expect(researchRoot.getByRole('button', { name: /alpha-source/ })).toBeVisible()

      await researchRoot.getByRole('button', { name: /Alpha PDF note/ }).click()
      await researchRoot.getByRole('button', { name: /alpha-source/ }).click()
      await expect(researchRoot.locator('iframe[title="alpha-source"]')).toBeVisible()
      await expect(researchRoot.getByRole('button', { name: /Link note.*PDF/i })).toBeEnabled()

      await researchRoot.getByRole('button', { name: /Link note.*PDF/i }).click()
      await expect(page.getByText('Research link saved.')).toBeVisible()
      await expect(researchRoot.getByRole('heading', { name: 'Backlinks and relations' })).toBeVisible()
      const backlink = researchRoot.locator('li').filter({ hasText: 'Alpha PDF note · alpha-source' })
      await expect(backlink).toBeVisible()
      await expect(backlink.getByText('Supports')).toBeVisible()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })
})
