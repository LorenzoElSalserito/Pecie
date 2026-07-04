import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

const appEntryPath = path.resolve(__dirname, '../../../apps/desktop/out/main/index.js')

const templates = [
  { id: 'blank', label: 'Custom Blank' },
  { id: 'thesis', label: 'Thesis' },
  { id: 'paper', label: 'Paper' },
  { id: 'book', label: 'Book / Essay' },
  { id: 'manual', label: 'Manual' },
  { id: 'journal', label: 'Journal / Newspaper' },
  { id: 'article', label: 'Article' },
  { id: 'videoScript', label: 'Video Script' },
  { id: 'screenplay', label: 'Screenplay' }
] as const

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

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
          name: 'Template Certifier',
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

test.describe('FASE 5 project template creation', () => {
  for (const template of templates) {
    test(`creates a ${template.id} project from the desktop launcher`, async () => {
      const homeDirectory = await mkdtemp(path.join(tmpdir(), `pecie-e2e-template-${template.id}-`))
      const workspaceDirectory = await seedSettings(homeDirectory)
      let electronApp: ElectronApplication | undefined

      try {
        electronApp = await electron.launch({
          args: ['--no-sandbox', appEntryPath],
          env: {
            ...process.env,
            ELECTRON_DISABLE_SANDBOX: '1',
            HOME: homeDirectory
          }
        })
        const page = await waitForMainWindow(electronApp)
        const projectTitle = `Template ${template.label} Certification`
        const projectName = slugify(projectTitle)

        await page.getByLabel('Project title').fill(projectTitle)
        await page.getByRole('radio', { name: new RegExp(`^${template.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click()
        await page.getByRole('button', { name: 'Start writing' }).click()

        await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible()

        const projectPath = path.join(workspaceDirectory, `${projectName}.pe`)
        const manifest = JSON.parse(await readFile(path.join(projectPath, 'manifest.json'), 'utf8')) as { title: string }
        const project = JSON.parse(await readFile(path.join(projectPath, 'project.json'), 'utf8')) as { documentKind: string }
        const binder = JSON.parse(await readFile(path.join(projectPath, 'binder.json'), 'utf8')) as { nodes: unknown[] }

        expect(manifest.title).toBe(projectTitle)
        expect(project.documentKind).toBe(template.id)
        expect(binder.nodes.length).toBeGreaterThan(0)
      } finally {
        await electronApp?.close()
        await rm(homeDirectory, { recursive: true, force: true })
      }
    })
  }
})
