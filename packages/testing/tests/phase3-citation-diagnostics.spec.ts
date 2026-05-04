import { access, mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises'
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
          name: 'Phase 3 Citation Tester',
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
  const homeDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-e2e-citations-'))
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

async function createThesisProject(page: Page, projectTitle: string): Promise<void> {
  await page.getByLabel('Project title').fill(projectTitle)
  await page.getByLabel('Folder name .pe').fill(
    projectTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
  await page.getByRole('radio', { name: /^Thesis/ }).click()
  await page.getByRole('button', { name: 'Start writing' }).click()
  await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible()
}

async function findSingleProjectPath(workspaceDirectory: string): Promise<string> {
  const entries = await readdir(workspaceDirectory, { withFileTypes: true })
  const project = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.pe'))
  if (!project) {
    throw new Error(`No .pe project found in ${workspaceDirectory}`)
  }
  return path.join(workspaceDirectory, project.name)
}

async function expandCitationProfilesSection(page: Page): Promise<void> {
  const hideContextToggle = page.getByRole('button', { name: 'Hide context' }).first()
  if (await hideContextToggle.count()) {
    await hideContextToggle.click()
    await expect(page.getByRole('button', { name: 'Show context' }).first()).toBeVisible()
  }
  const contextToggle = page.getByRole('button', { name: 'Show context' }).first()
  if (await contextToggle.count()) {
    await contextToggle.click()
    await expect(page.getByRole('button', { name: 'Hide context' }).first()).toBeVisible()
  }
  const toggle = page.getByRole('button', { expanded: false, name: /Citation profiles/ }).first()
  if (await toggle.count()) {
    await toggle.click()
  }
  await expect(page.getByRole('heading', { level: 4, name: 'Citation profiles' })).toBeVisible()
}

async function openPrimaryDocument(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Show structure' }).click()
  await page.getByRole('treeitem').filter({ hasText: /Scheda progetto|Project sheet|Introduzione|Introduction/ }).first().click()
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

test.describe('FASE 3 Citation Diagnostics', () => {
  test('surfaces the empty library diagnostics state after project creation', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop()

    try {
      await createThesisProject(page, 'Phase 3 Citations Empty')
      await expandCitationProfilesSection(page)

      await expect(
        page.getByRole('heading', { level: 4, name: 'Library diagnostics' })
      ).toBeVisible()
      await expect(
        page.getByText('No citation library issues detected.')
      ).toBeVisible()
      await expect(
        page.getByText('No citation profile issues detected.')
      ).toBeVisible()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('reports parser diagnostics when the bibliography is malformed', async () => {
    const { electronApp, page, homeDirectory, workspaceDirectory } = await launchDesktop()

    try {
      await createThesisProject(page, 'Phase 3 Citations Malformed')

      const projectPath = await findSingleProjectPath(workspaceDirectory)
      const bibPath = path.join(projectPath, 'citations', 'references.bib')
      await writeFile(
        bibPath,
        [
          '@article{alpha',
          ''
        ].join('\n'),
        'utf8'
      )

      await expect.poll(() => readFile(bibPath, 'utf8')).toContain('@article{alpha')
      await expandCitationProfilesSection(page)
      await page.getByRole('button', { name: 'Refresh diagnostics' }).click()

      await expect(
        page.getByRole('heading', { level: 4, name: 'Library diagnostics' })
      ).toBeVisible()
      await expect(
        page.locator('.citation-library-diagnostic__severity--warning').first()
      ).toBeVisible()
      await expect(page.getByText(/Skipping malformed BibTeX entry/)).toBeVisible()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('inserts a citekey from keyboard suggestions and exports with bibliography', async () => {
    const { electronApp, page, homeDirectory, workspaceDirectory } = await launchDesktop()

    try {
      await createThesisProject(page, 'Phase 3 Citation Insert')
      const projectPath = await findSingleProjectPath(workspaceDirectory)
      const bibPath = path.join(projectPath, 'citations', 'references.bib')
      await writeFile(
        bibPath,
        [
          '@article{alpha,',
          '  author = {Doe, Jane},',
          '  title = {Alpha Source},',
          '  journal = {Journal of Phase Three},',
          '  year = {2024}',
          '}',
          ''
        ].join('\n'),
        'utf8'
      )
      await expect.poll(() => readFile(bibPath, 'utf8')).toContain('Alpha Source')

      await openPrimaryDocument(page)
      await replaceEditorBody(page, 'This paragraph cites ')
      await page.keyboard.type('@al')
      await expect(page.locator('.suggest-widget').getByText('@alpha')).toBeVisible()
      await expect(page.locator('.suggest-widget').getByText(/Doe.*2024/)).toBeVisible()
      await page.keyboard.press('Enter')
      await manualSave(page)

      const outputPath = path.join(projectPath, 'exports/out/phase-3-citation-insert.md')
      await page.getByRole('button', { name: 'Export' }).click()
      const exportDialog = page.getByRole('dialog', { name: 'Export content' })
      await expect(exportDialog).toBeVisible()
      await exportDialog.locator('select').first().selectOption('md')
      await exportDialog.getByLabel('Output path').fill(outputPath)
      await exportDialog.getByRole('button', { name: 'Start export' }).click()
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

      const exported = await readFile(outputPath, 'utf8')
      expect(exported).toContain('Alpha Source')
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })
})
