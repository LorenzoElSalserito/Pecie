import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

const appEntryPath = path.resolve(__dirname, '../../../apps/desktop/out/main/index.js')

type LaunchOptions = {
  fontPreference?: string
  firstRun?: boolean
  locale?: 'en-US' | 'it-IT'
}

async function seedSettings(homeDirectory: string, options: LaunchOptions): Promise<{ appDataDirectory: string; workspaceDirectory: string }> {
  const appDataDirectory = path.join(homeDirectory, '.pecie')
  const workspaceDirectory = path.join(homeDirectory, 'workspace')
  await mkdir(appDataDirectory, { recursive: true })
  await mkdir(workspaceDirectory, { recursive: true })
  if (options.firstRun) {
    return { appDataDirectory, workspaceDirectory }
  }
  await writeFile(
    path.join(appDataDirectory, 'app-settings.json'),
    JSON.stringify(
      {
        workspaceDirectory,
        locale: options.locale ?? 'en-US',
        theme: 'light',
        fontPreference: options.fontPreference ?? 'classic',
        uiZoom: 100,
        recentProjectPaths: [],
        archivedProjectPaths: [],
        expertModeEnabled: false,
        authorProfile: { name: 'Typography Tester', role: 'writer', preferredLanguage: options.locale ?? 'en-US' },
        preview: { mode: 'ultra-performance', disclosuresSeen: { 'ultra-performance': true }, pageMarkers: { byProjectAndProfile: {} } },
        onboardingCompleted: true
      },
      null,
      2
    ),
    'utf8'
  )
  return { appDataDirectory, workspaceDirectory }
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

async function launchDesktop(options: LaunchOptions = {}): Promise<{
  electronApp: ElectronApplication
  page: Page
  homeDirectory: string
  appDataDirectory: string
  failedRequests: string[]
  consoleErrors: string[]
}> {
  const homeDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-e2e-typography-'))
  const seeded = await seedSettings(homeDirectory, options)
  const electronApp = await electron.launch({
    args: ['--no-sandbox', appEntryPath],
    env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1', HOME: homeDirectory }
  })
  const page = await waitForMainWindow(electronApp)
  const failedRequests: string[] = []
  const consoleErrors: string[] = []
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? ''}`))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  return { electronApp, page, homeDirectory, appDataDirectory: seeded.appDataDirectory, failedRequests, consoleErrors }
}

type FontFaceSnapshot = { family: string; status: string; style: string; weight: string }

async function fontSnapshot(page: Page): Promise<{ faces: FontFaceSnapshot[]; renderedUrl: string; dataFont: string | undefined; body: string; ui: string }> {
  return page.evaluate(async () => {
    await document.fonts.ready
    return {
      faces: [...document.fonts].map((face) => ({ family: face.family, status: face.status, style: face.style, weight: face.weight })),
      renderedUrl: location.href,
      dataFont: document.documentElement.dataset.font,
      body: getComputedStyle(document.body).fontFamily,
      ui: getComputedStyle(document.documentElement).getPropertyValue('--pecie-font-ui').trim()
    }
  })
}

async function createProject(page: Page, title: string): Promise<void> {
  await page.getByLabel('Project title').fill(title)
  await page.getByRole('radio', { name: /^Book \/ Essay/ }).click()
  await page.getByRole('button', { name: 'Start writing' }).click()
  await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible()
}

test.describe('FASE 6 bundled typography and icons', () => {
  test('renders every visible Bootstrap icon from the bundled webfont with no network or query-string assets', async () => {
    const { electronApp, page, homeDirectory, failedRequests, consoleErrors } = await launchDesktop()

    try {
      await expect(page.getByLabel('Project title')).toBeVisible()
      const snapshot = await fontSnapshot(page)
      expect(snapshot.renderedUrl).toMatch(/^file:\/\//)
      const iconFaces = snapshot.faces.filter((face) => face.family.replace(/['"]/g, '') === 'bootstrap-icons')
      expect(iconFaces).toHaveLength(1)
      expect(iconFaces[0].status).toBe('loaded')

      const iconReport = await page.evaluate(() => {
        const icons = [...document.querySelectorAll<HTMLElement>('i.bi')]
        const visible = icons.filter((icon) => {
          const rect = icon.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && getComputedStyle(icon).visibility !== 'hidden'
        })
        const broken = visible
          .map((icon) => {
            const before = getComputedStyle(icon, '::before')
            const content = before.content.replace(/["']/g, '')
            return {
              className: icon.className,
              fontFamily: before.fontFamily,
              codePoint: content.codePointAt(0) ?? 0,
              glyphWidth: icon.getBoundingClientRect().width
            }
          })
          .filter((entry) => !entry.fontFamily.includes('bootstrap-icons') || entry.codePoint < 0xf000 || entry.glyphWidth < 6)
        return { total: icons.length, visible: visible.length, broken }
      })
      expect(iconReport.visible).toBeGreaterThan(8)
      expect(iconReport.broken).toEqual([])

      // Force every bundled face to load: all of them must resolve from local files.
      const loadReport = await page.evaluate(async () => {
        const failures: string[] = []
        for (const face of [...document.fonts]) {
          try {
            await face.load()
            if (face.status !== 'loaded') failures.push(`${face.family} ${face.style} ${face.weight}: ${face.status}`)
          } catch (error) {
            failures.push(`${face.family}: ${String(error)}`)
          }
        }
        return { families: new Set([...document.fonts].map((face) => face.family)).size, failures }
      })
      expect(loadReport.failures).toEqual([])
      expect(loadReport.families).toBeGreaterThanOrEqual(50)

      const stylesheetUrls = await page.evaluate(() =>
        [...document.styleSheets].flatMap((sheet) => {
          try {
            return [...sheet.cssRules]
              .filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
              .map((rule) => rule.style.getPropertyValue('src'))
          } catch {
            return []
          }
        })
      )
      expect(stylesheetUrls.length).toBeGreaterThan(50)
      for (const src of stylesheetUrls) {
        expect(src).not.toMatch(/https?:\/\//)
        expect(src).not.toMatch(/\?[A-Za-z0-9]/)
      }

      expect(failedRequests.filter((entry) => /\.(woff2?|ttf|otf|svg)/.test(entry))).toEqual([])
      expect(consoleErrors.filter((entry) => /font|woff|Failed to load resource/i.test(entry))).toEqual([])
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('renders the editor formatting toolbar from embedded SVG glyphs', async () => {
    const { electronApp, page, homeDirectory, failedRequests } = await launchDesktop()

    try {
      await createProject(page, 'Toolbar Icons Project')
      const toolsToggle = page.getByRole('button', { name: 'Writing assistance tools' })
      if ((await toolsToggle.getAttribute('aria-pressed')) !== 'true') {
        await toolsToggle.click()
      }
      await expect(page.locator('.format-chip').first()).toBeVisible()
      const report = await page.evaluate(() => {
        const chips = [...document.querySelectorAll<HTMLButtonElement>('.format-chip')]
        return chips.map((chip) => {
          const svg = chip.querySelector('svg')
          const paths = svg ? [...svg.querySelectorAll('path')] : []
          const box = svg?.getBoundingClientRect()
          const painted = paths.reduce((total, pathElement) => {
            const pathBox = (pathElement as SVGGraphicsElement).getBBox()
            return total + pathBox.width * pathBox.height
          }, 0)
          return {
            title: chip.title,
            hasSvg: Boolean(svg),
            width: box?.width ?? 0,
            height: box?.height ?? 0,
            paths: paths.length,
            painted,
            fill: svg ? getComputedStyle(svg).fill : '',
            images: chip.querySelectorAll('img').length
          }
        })
      })
      expect(report.length).toBeGreaterThanOrEqual(20)
      for (const chip of report) {
        expect(chip.hasSvg, `${chip.title} has no inline svg`).toBe(true)
        expect(chip.images).toBe(0)
        expect(chip.width, `${chip.title} icon has no width`).toBeGreaterThan(8)
        expect(chip.height, `${chip.title} icon has no height`).toBeGreaterThan(8)
        expect(chip.paths, `${chip.title} has no path data`).toBeGreaterThan(0)
        expect(chip.painted, `${chip.title} paints nothing`).toBeGreaterThan(10)
        expect(chip.fill).not.toBe('none')
      }
      const titles = report.map((chip) => chip.title)
      expect(titles.some((title) => /Bold/i.test(title))).toBe(true)
      expect(titles.some((title) => /Citation/i.test(title))).toBe(true)

      // Workspace icons (binder, header, status bar) still come from the bundled webfont.
      const workspaceIcons = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.workspace-shell i.bi')]
          .filter((icon) => icon.getBoundingClientRect().width > 0)
          .map((icon) => {
            const before = getComputedStyle(icon, '::before')
            return { className: icon.className, fontFamily: before.fontFamily, codePoint: before.content.replace(/["']/g, '').codePointAt(0) ?? 0 }
          })
      )
      expect(workspaceIcons.length).toBeGreaterThan(10)
      expect(workspaceIcons.filter((icon) => !icon.fontFamily.includes('bootstrap-icons') || icon.codePoint < 0xf000)).toEqual([])
      expect(failedRequests.filter((entry) => /\.(woff2?|ttf|otf|svg)/.test(entry))).toEqual([])
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('maps legacy font preferences onto the bundled catalog', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop({ fontPreference: 'dyslexic' })

    try {
      await expect(page.getByLabel('Project title')).toBeVisible()
      await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.font)).toBe('open-dyslexic')
      const snapshot = await fontSnapshot(page)
      expect(snapshot.body).toContain('OpenDyslexic')
      expect(snapshot.ui).toContain('OpenDyslexic')
      expect(snapshot.faces.some((face) => face.family.replace(/['"]/g, '') === 'OpenDyslexic' && face.status === 'loaded')).toBe(true)
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }

    const classic = await launchDesktop({ fontPreference: 'classic' })
    try {
      await expect(classic.page.getByLabel('Project title')).toBeVisible()
      await expect.poll(async () => classic.page.evaluate(() => document.documentElement.dataset.font)).toBe('source-serif-4')
      const snapshot = await fontSnapshot(classic.page)
      expect(snapshot.body).toContain('Source Serif 4')
      expect(snapshot.ui).toContain('IBM Plex Sans')
    } finally {
      await classic.electronApp.close()
      await rm(classic.homeDirectory, { recursive: true, force: true })
    }
  })

  test('lets the writer browse, search and pick a bundled font with live preview and persistence', async () => {
    const { electronApp, page, homeDirectory, appDataDirectory } = await launchDesktop()

    try {
      await createProject(page, 'Typography Project')
      await page.getByRole('button', { name: 'More actions' }).click()
      await page.getByRole('menuitem', { name: 'Settings' }).click()
      const settingsDialog = page.getByRole('dialog', { name: 'Settings' })
      await expect(settingsDialog).toBeVisible()
      await expect(settingsDialog.getByTestId('font-picker-current')).toHaveText('Source Serif 4')

      await settingsDialog.getByRole('button', { name: 'Change font' }).click()
      const radios = settingsDialog.getByRole('radiogroup', { name: 'Writing font' }).getByRole('radio')
      await expect.poll(async () => radios.count()).toBeGreaterThanOrEqual(50)

      await settingsDialog.getByRole('button', { name: 'Monospace' }).click()
      await expect(settingsDialog.getByRole('radio', { name: 'Courier Prime' })).toBeVisible()
      await expect(settingsDialog.getByRole('radio', { name: 'Crimson Pro' })).toHaveCount(0)

      await settingsDialog.getByRole('button', { name: 'All', exact: true }).click()
      await settingsDialog.getByLabel('Search fonts').fill('garamond')
      await expect(settingsDialog.getByRole('radio', { name: 'EB Garamond' })).toBeVisible()
      await expect(settingsDialog.getByRole('radio', { name: 'Cormorant Garamond' })).toBeVisible()
      await expect(settingsDialog.getByRole('radio', { name: 'Lora' })).toHaveCount(0)
      await settingsDialog.getByLabel('Search fonts').fill('zzzz')
      await expect(settingsDialog.getByText('No font matches your search.')).toBeVisible()
      await settingsDialog.getByLabel('Search fonts').fill('')

      await settingsDialog.getByRole('radio', { name: 'Crimson Pro' }).check()
      await expect(settingsDialog.getByTestId('font-picker-current')).toHaveText('Crimson Pro')
      await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.font)).toBe('crimson-pro')
      await expect.poll(async () => page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Crimson Pro')
      await expect.poll(async () =>
        page.evaluate(() => [...document.fonts].some((face) => face.family.replace(/['"]/g, '') === 'Crimson Pro' && face.status === 'loaded'))
      ).toBe(true)
      // Interface chrome keeps the bundled UI face for non-accessibility fonts.
      const uiFamily = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pecie-font-ui'))
      expect(uiFamily).toContain('IBM Plex Sans')

      await settingsDialog.getByRole('radio', { name: 'Atkinson Hyperlegible' }).check()
      await expect.poll(async () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pecie-font-ui'))).toContain('Atkinson Hyperlegible')
      await settingsDialog.getByRole('radio', { name: 'Crimson Pro' }).check()

      await settingsDialog.getByRole('button', { name: 'Save' }).click()
      await expect(settingsDialog).toHaveCount(0)
      await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.font)).toBe('crimson-pro')
      await expect.poll(async () => {
        const raw = await readFile(path.join(appDataDirectory, 'app-settings.json'), 'utf8')
        return (JSON.parse(raw) as { fontPreference: string }).fontPreference
      }).toBe('crimson-pro')

      // The Monaco writing surface follows the writing font.
      const editorFont = await page.evaluate(() => getComputedStyle(document.querySelector('.monaco-editor .view-lines') as HTMLElement).fontFamily)
      expect(editorFont).toContain('Crimson Pro')
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('keeps the workspace viewport-locked so the document never scrolls the page', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop()

    try {
      await electronApp.evaluate(({ BrowserWindow }) => {
        const mainWindow = BrowserWindow.getAllWindows().find((window) => !window.webContents.getURL().startsWith('data:text/html'))
        mainWindow?.setSize(1280, 800)
      })
      await createProject(page, 'Viewport Project')
      await page.locator('.monaco-editor').first().click()
      await page.keyboard.press('Control+End')
      await page.keyboard.type('\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(60))
      await page.waitForTimeout(500)
      const metrics = await page.evaluate(() => ({
        scrollTop: document.documentElement.scrollTop,
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        headerTop: document.querySelector('.workspace-header')?.getBoundingClientRect().top ?? -1,
        sheetBottom: document.querySelector('.editor-sheet')?.getBoundingClientRect().bottom ?? -1
      }))
      expect(metrics.scrollTop).toBe(0)
      expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.innerHeight)
      expect(metrics.headerTop).toBeGreaterThanOrEqual(0)
      expect(metrics.sheetBottom).toBeLessThanOrEqual(metrics.innerHeight)
      await expect(page.locator('.editor-title-input')).toBeInViewport()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('offers the font picker during first-run setup', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop({ firstRun: true })

    try {
      await expect(page.getByTestId('font-picker-current')).toHaveText('Source Serif 4')
      await page.getByRole('button', { name: 'Change font' }).click()
      await page.getByRole('radio', { name: 'Lora' }).check()
      await expect(page.getByTestId('font-picker-current')).toHaveText('Lora')
      await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.font)).toBe('lora')
      await expect(page.locator('.setup-overview__card').filter({ hasText: 'Writing font' })).toContainText('Lora')
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })
})
