import { access, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { ProjectService } from '../../../packages/infrastructure/src/project/project-service'

const appEntryPath = path.resolve(__dirname, '../../../apps/desktop/out/main/index.js')
const visualBlocksMarkdown = [
  '---',
  'title: Phase 5 Visual Blocks',
  '---',
  '',
  '# Phase 5 Visual Blocks',
  '',
  '```mermaid',
  'flowchart TD',
  '  A[Idea] --> B[Draft]',
  '  B --> C[Review]',
  '  C --> D[Export]',
  '```',
  '',
  '```markmap',
  '# Research map',
  '## Method',
  '### Sources',
  '## Results',
  '### Charts',
  '```',
  '',
  '```chart',
  '{',
  '  "kind": "chart",',
  '  "chartType": "bar",',
  '  "title": "Chapter word histogram",',
  '  "xKey": "chapter",',
  '  "yKeys": ["words"],',
  '  "data": [',
  '    { "chapter": "Intro", "words": 900 },',
  '    { "chapter": "Method", "words": 1400 },',
  '    { "chapter": "Results", "words": 1800 }',
  '  ]',
  '}',
  '```',
  '',
  '```chart',
  '{',
  '  "kind": "chart",',
  '  "chartType": "line",',
  '  "title": "Revision trend",',
  '  "xKey": "week",',
  '  "yKeys": ["pages"],',
  '  "data": [',
  '    { "week": "W1", "pages": 6 },',
  '    { "week": "W2", "pages": 11 },',
  '    { "week": "W3", "pages": 18 }',
  '  ]',
  '}',
  '```',
  '',
  '```chart',
  '{',
  '  "kind": "chart",',
  '  "chartType": "area",',
  '  "title": "Evidence coverage",',
  '  "xKey": "section",',
  '  "yKeys": ["notes"],',
  '  "data": [',
  '    { "section": "A", "notes": 12 },',
  '    { "section": "B", "notes": 21 },',
  '    { "section": "C", "notes": 16 }',
  '  ]',
  '}',
  '```',
  '',
  '```chart',
  '{',
  '  "kind": "chart",',
  '  "chartType": "pie",',
  '  "title": "Source mix pie chart",',
  '  "xKey": "source",',
  '  "yKeys": ["count"],',
  '  "data": [',
  '    { "source": "Books", "count": 8 },',
  '    { "source": "Papers", "count": 13 },',
  '    { "source": "Archives", "count": 5 }',
  '  ]',
  '}',
  '```'
].join('\n')

const noopIndexAdapter = {
  initialize: () => undefined,
  upsert: () => undefined,
  upsertAttachment: () => undefined,
  removeAttachment: () => undefined,
  remove: () => undefined,
  search: () => ({ nodes: [], content: [], attachments: [] })
}

async function seedSettings(
  homeDirectory: string,
  documentBody?: string
): Promise<{ workspaceDirectory: string; projectPath: string }> {
  const appDataDirectory = path.join(homeDirectory, '.pecie')
  const workspaceDirectory = path.join(homeDirectory, 'workspace')
  await mkdir(appDataDirectory, { recursive: true })
  await mkdir(workspaceDirectory, { recursive: true })
  const project = await new ProjectService(undefined, noopIndexAdapter).createProject({
    directory: workspaceDirectory,
    projectName: 'phase-5-visual-blocks',
    title: 'Phase 5 Visual Blocks',
    language: 'en-US',
    template: 'blank',
    authorProfile: {
      name: 'Visual Block Tester',
      role: 'writer',
      preferredLanguage: 'en-US'
    }
  })
  if (documentBody) {
    const documentNode = project.binder.nodes.find((node) => node.type === 'document' && node.path)
    if (!documentNode?.path) {
      throw new Error('Seed project does not contain a writable document node.')
    }
    await writeFile(path.join(project.projectPath, documentNode.path), documentBody, 'utf8')
  }
  await writeFile(
    path.join(appDataDirectory, 'app-settings.json'),
    JSON.stringify(
      {
        workspaceDirectory,
        locale: 'en-US',
        theme: 'light',
        fontPreference: 'classic',
        uiZoom: 100,
        recentProjectPaths: [project.projectPath],
        archivedProjectPaths: [],
        authorProfile: {
          name: 'Visual Block Tester',
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

  return { workspaceDirectory, projectPath: project.projectPath }
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

async function launchDesktop(documentBody?: string): Promise<{
  electronApp: ElectronApplication
  page: Page
  homeDirectory: string
  workspaceDirectory: string
  projectPath: string
}> {
  const homeDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-e2e-visual-blocks-'))
  const seeded = await seedSettings(homeDirectory, documentBody)

  const electronApp = await electron.launch({
    args: ['--no-sandbox', appEntryPath],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SANDBOX: '1',
      HOME: homeDirectory
    }
  })

  const page = await waitForMainWindow(electronApp)
  return { electronApp, page, homeDirectory, workspaceDirectory: seeded.workspaceDirectory, projectPath: seeded.projectPath }
}

async function openExportDialog(page: Page) {
  await page.getByRole('button', { name: 'Export' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export content' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function readPdfText(pdfPath: string): Promise<string> {
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as {
    getDocument: (input: {
      data: Uint8Array
      disableFontFace?: boolean
      useSystemFonts?: boolean
      useWorker?: boolean
    }) => {
      promise: Promise<{
        numPages: number
        destroy: () => Promise<void>
        getPage: (pageNumber: number) => Promise<{
          getTextContent: () => Promise<{ items: Array<{ str?: string }> }>
        }>
      }>
    }
  }
  const bytes = await readFile(pdfPath)
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: true,
    useWorker: false
  })
  const pdf = await loadingTask.promise
  const pages: string[] = []

  try {
    expect(pdf.numPages).toBeGreaterThanOrEqual(1)
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => item.str ?? '').join(' '))
    }
  } finally {
    await pdf.destroy()
  }

  return pages.join('\n')
}

test.describe('FASE 5 Visual Blocks', () => {
  test('inserts, previews and exports visual blocks as local image assets', async () => {
    const { electronApp, page, homeDirectory, projectPath } = await launchDesktop()

    try {
      const outputPath = path.join(projectPath, 'exports/out/phase-5-visual-blocks.md')
      await page.locator('.quick-resume-banner').click()
      await expect(page.getByRole('button', { name: 'Export' })).toBeVisible()

      await page.getByRole('button', { name: 'Diagram' }).click()
      await page.getByRole('button', { name: 'Mind map' }).click()
      await page.getByRole('button', { name: 'Chart' }).click()
      await page.keyboard.press('Control+S')

      await page.getByRole('tab', { name: 'Preview' }).click()
      await expect(page.locator('.markdown-render svg')).toHaveCount(3)
      await expect(page.locator('[data-visual-block-kind="mermaid"]')).toBeVisible()
      await expect(page.locator('[data-visual-block-kind="markmap"]')).toBeVisible()
      await expect(page.locator('[data-visual-block-kind="chart"]')).toBeVisible()

      const exportDialog = await openExportDialog(page)
      await exportDialog.locator('select').first().selectOption('md')
      await exportDialog.getByLabel('Output path').fill(outputPath)
      await exportDialog.getByLabel('Show preview before saving').uncheck()
      await exportDialog.getByRole('button', { name: 'Start export' }).click()
      await expect(exportDialog.getByText('Export state: export completed')).toBeVisible()

      await access(outputPath)
      const exported = await readFile(outputPath, 'utf8')
      expect(exported).toContain('/exports/visual-assets/')
      const imageFiles = await readdir(path.join(projectPath, 'exports/visual-assets'))
      expect(imageFiles.filter((name) => name.endsWith('.svg')).length).toBeGreaterThanOrEqual(3)
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('exports every visual block kind to a valid PDF through bundled Pandoc and WeasyPrint', async () => {
    const { electronApp, page, homeDirectory, projectPath } = await launchDesktop(visualBlocksMarkdown)

    try {
      const outputPath = path.join(projectPath, 'exports/out/phase-5-visual-blocks-weasyprint.pdf')
      await page.locator('.quick-resume-banner').click()
      await expect(page.getByRole('button', { name: 'Export' })).toBeVisible()

      await page.getByRole('tab', { name: 'Preview' }).click()
      await expect(page.locator('.markdown-render svg')).toHaveCount(6)
      await expect(page.locator('[data-visual-block-kind="mermaid"]')).toHaveCount(1)
      await expect(page.locator('[data-visual-block-kind="markmap"]')).toHaveCount(1)
      await expect(page.locator('[data-visual-block-kind="chart"]')).toHaveCount(4)

      const exportDialog = await openExportDialog(page)
      await exportDialog.locator('[data-tutorial-id="export-format"]').selectOption('pdf')
      await exportDialog.locator('[data-tutorial-id="export-profile"]').selectOption('blank-markdown-pdf')
      await exportDialog.getByLabel('Output path').fill(outputPath)
      await exportDialog.getByLabel('Show preview before saving').uncheck()
      await expect(exportDialog.getByText(/Required capabilities: pandoc, weasyprint/)).toBeVisible()
      await exportDialog.getByRole('button', { name: 'Start export' }).click()
      await expect(exportDialog.getByText('Export state: export completed')).toBeVisible({ timeout: 45_000 })

      const pdfStat = await stat(outputPath)
      expect(pdfStat.size).toBeGreaterThan(12_000)
      const pdfHeader = (await readFile(outputPath)).subarray(0, 8).toString('utf8')
      expect(pdfHeader).toContain('%PDF')

      const assetDirectory = path.join(projectPath, 'exports/visual-assets')
      const imageFiles = await readdir(assetDirectory)
      expect(imageFiles.filter((name) => name.endsWith('.svg')).length).toBeGreaterThanOrEqual(6)
      for (const expectedSuffix of ['-1-mermaid.svg', '-2-markmap.svg', '-3-chart.svg', '-4-chart.svg', '-5-chart.svg', '-6-chart.svg']) {
        expect(imageFiles.some((name) => name.endsWith(expectedSuffix))).toBe(true)
      }

      const pdfText = await readPdfText(outputPath)
      expect(pdfText).toContain('Phase 5 Visual Blocks')
      expect(pdfText).toContain('Diagramma 1')
      expect(pdfText).toContain('Mappa mentale 2')
      expect(pdfText).toContain('Grafico 3')
      expect(pdfText).not.toContain('```mermaid')
      expect(pdfText).not.toContain('```chart')
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })
})
