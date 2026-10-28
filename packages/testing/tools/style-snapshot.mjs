/**
 * Computed-style snapshot for refactor certification.
 *
 *   node tools/style-snapshot.mjs capture <outDir>      # from packages/testing, under xvfb-run
 *   node tools/style-snapshot.mjs compare <dirA> <dirB>
 *
 * Capture launches the packaged renderer (apps/desktop/out) in several states and themes, freezes
 * animations, and dumps every element's computed style keyed by its DOM path. Compare prints each
 * property that differs between two captures, so a stylesheet refactor can prove it changed nothing.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { _electron as electron } from '@playwright/test'

const appEntryPath = path.resolve(process.env.PECIE_APP_ENTRY ?? '../../apps/desktop/out/main/index.js')
const FREEZE_CSS = '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }'

function settings(theme, extra = {}) {
  return {
    locale: 'en-US',
    theme,
    fontPreference: 'classic',
    uiZoom: 100,
    recentProjectPaths: [],
    archivedProjectPaths: [],
    expertModeEnabled: false,
    authorProfile: { name: 'Snapshot', role: 'writer', preferredLanguage: 'en-US' },
    preview: { mode: 'ultra-performance', disclosuresSeen: { 'ultra-performance': true }, pageMarkers: { byProjectAndProfile: {} } },
    tutorialProgress: { completedTutorialIds: ['launcher-basics'], skippedTutorialIds: [] },
    onboardingCompleted: true,
    ...extra
  }
}

async function launch(home, theme, firstRun) {
  await rm(home, { recursive: true, force: true })
  const appData = path.join(home, '.pecie')
  const workspace = path.join(home, 'workspace')
  await mkdir(appData, { recursive: true })
  await mkdir(workspace, { recursive: true })
  if (!firstRun) {
    await writeFile(path.join(appData, 'app-settings.json'), JSON.stringify(settings(theme, { workspaceDirectory: workspace }), null, 2))
  }
  const app = await electron.launch({ args: ['--no-sandbox', appEntryPath], env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1', HOME: home } })
  let page
  for (let attempt = 0; attempt < 60 && !page; attempt += 1) {
    page = (await app.windows()).find((entry) => !entry.url().startsWith('data:text/html'))
    if (!page) await new Promise((resolve) => setTimeout(resolve, 500))
  }
  await page.waitForLoadState('domcontentloaded')
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.addStyleTag({ content: FREEZE_CSS })
  return { app, page }
}

async function dump(page) {
  return page.evaluate(() => {
    const out = {}
    // Position-only path (tag + index): class renames and extra hooks must not move an element's key,
    // so a refactor that keeps computed styles identical compares clean.
    // Structural normalisation: an icon is one node whether it is a legacy <i class="bi"> or an
    // inline <svg class="pecie-icon">, its <path> children are not compared, and the visually
    // hidden tooltip copies (<span class="pecie-tooltip-sr">) do not shift sibling indices.
    const isIcon = (node) => node.classList.contains('bi') || node.classList.contains('pecie-icon')
    const isHiddenHelper = (node) => node.classList.contains('pecie-tooltip-sr')
    const pathOf = (element) => {
      const parts = []
      let node = element
      while (node && node !== document.documentElement) {
        const parent = node.parentElement
        const siblings = parent ? [...parent.children].filter((child) => !isHiddenHelper(child)) : [node]
        const index = siblings.indexOf(node)
        parts.unshift(`${isIcon(node) ? 'icon' : node.tagName.toLowerCase()}:${index}`)
        node = parent
      }
      return parts.join('>')
    }
    const skip = (element) =>
      (element.closest('.monaco-editor') !== null && !element.classList.contains('monaco-editor')) ||
      isHiddenHelper(element) ||
      (element.tagName.toLowerCase() === 'path' && element.parentElement && isIcon(element.parentElement))
    for (const element of document.querySelectorAll('body *')) {
      if (skip(element)) continue
      const style = getComputedStyle(element)
      const entry = {}
      const iconNode = isIcon(element)
      for (const property of style) {
        if (/^(-webkit-|inline-size|block-size|perspective-origin|transform-origin)/.test(property)) continue
        if (iconNode && !/^(width|height|color|opacity|visibility|display)$/.test(property)) continue
        entry[property] = style.getPropertyValue(property)
      }
      entry._class = element.className && typeof element.className === 'string' ? element.className : ''
      for (const pseudo of ['::before', '::after']) {
        // Tooltip bubbles are generated content keyed on data-tooltip: not part of the layout contract.
        if (pseudo === '::after' && element.classList.contains('pecie-tooltip-trigger')) continue
        const ps = getComputedStyle(element, pseudo)
        if (ps.content && ps.content !== 'none' && ps.content !== 'normal') {
          for (const property of ps) {
            if (/^(-webkit-)/.test(property)) continue
            entry[`${pseudo}${property}`] = ps.getPropertyValue(property)
          }
        }
      }
      out[pathOf(element)] = entry
    }
    return out
  })
}

async function capture(outDir) {
  await mkdir(outDir, { recursive: true })
  const home = path.resolve(outDir, '.home')
  const snapshots = []
  // A state that cannot be reached in one build is logged and skipped, so the other states still compare.
  const skipped = (process.env.PECIE_SKIP_STATES ?? '').split(',').filter(Boolean)
  const safe = async (name, run) => {
    if (skipped.some((prefix) => name.startsWith(prefix))) {
      console.log(`skipped ${name}: PECIE_SKIP_STATES`)
      return
    }
    try {
      await run()
    } catch (error) {
      console.log(`skipped ${name}: ${String(error).split('\n')[0]}`)
    }
  }
  for (const theme of ['light', 'dark']) {
    const { app, page } = await launch(home, theme, false)
    await page.getByLabel('Project title').waitFor()
    await page.waitForTimeout(600)
    snapshots.push([`launcher-${theme}`, await dump(page)])
    await safe(`settings-dialog-${theme}`, async () => {
      await page.getByRole('button', { name: 'Settings' }).first().click()
      await page.locator('[role="dialog"]').first().waitFor({ timeout: 10000 })
      await page.waitForTimeout(300)
      snapshots.push([`settings-dialog-${theme}`, await dump(page)])
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    })
    await page.getByLabel('Project title').fill('Snapshot Project')
    await page.getByRole('button', { name: 'Start writing' }).click()
    await page.getByRole('tab', { name: 'Timeline' }).waitFor()
    const tools = page.getByRole('button', { name: 'Writing assistance tools' })
    if ((await tools.getAttribute('aria-pressed')) !== 'true') await tools.click()
    await page.locator('.format-chip').first().waitFor()
    await page.waitForTimeout(800)
    snapshots.push([`workspace-editor-${theme}`, await dump(page)])
    await safe(`workspace-panels-${theme}`, async () => {
      const expand = page.getByRole('button', { name: 'Expand panel' }).first()
      const collapse = page.getByRole('button', { name: 'Collapse panel' }).first()
      if (await expand.count()) {
        await expand.click({ timeout: 10000 })
        await page.waitForTimeout(500)
        snapshots.push([`workspace-binder-expanded-${theme}`, await dump(page)])
        await page.getByRole('button', { name: 'Collapse panel' }).first().click({ timeout: 10000 })
      } else {
        await collapse.click({ timeout: 10000 })
        await page.waitForTimeout(500)
        snapshots.push([`workspace-binder-collapsed-${theme}`, await dump(page)])
        await page.getByRole('button', { name: 'Expand panel' }).first().click({ timeout: 10000 })
      }
      await page.waitForTimeout(500)
    })
    await safe(`workspace-focus-${theme}`, async () => {
      await page.getByRole('button', { name: 'Focus mode' }).click({ timeout: 10000 })
      await page.waitForTimeout(500)
      snapshots.push([`workspace-focus-${theme}`, await dump(page)])
      await page.getByRole('button', { name: 'Focus mode' }).click({ timeout: 10000 })
      await page.waitForTimeout(400)
    })
    await safe(`export-dialog-${theme}`, async () => {
      await page.getByRole('button', { name: 'Export' }).click({ timeout: 10000 })
      await page.locator('[role="dialog"]').first().waitFor({ timeout: 10000 })
      await page.waitForTimeout(300)
      snapshots.push([`export-dialog-${theme}`, await dump(page)])
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    })
    await safe(`guide-center-${theme}`, async () => {
      await page.getByRole('button', { name: 'More actions' }).click({ timeout: 10000 })
      await page.getByRole('menuitem', { name: 'Guide Center' }).click({ timeout: 10000 })
      await page.locator('[role="dialog"]').first().waitFor({ timeout: 10000 })
      await page.waitForTimeout(300)
      snapshots.push([`guide-center-${theme}`, await dump(page)])
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    })
    for (const view of ['Timeline', 'Research', 'Outliner', 'Corkboard']) {
      await safe(`view-${view}-${theme}`, async () => {
        await page.getByRole('tab', { name: view }).click({ timeout: 10000 })
        await page.waitForTimeout(400)
        snapshots.push([`view-${view.toLowerCase()}-${theme}`, await dump(page)])
      })
    }
    await app.close()
  }
  const { app, page } = await launch(home, 'light', true)
  await safe('wizard-light', async () => {
    await page.getByRole('button', { name: 'Change font' }).waitFor({ timeout: 10000 })
    await page.waitForTimeout(600)
    snapshots.push(['wizard-light', await dump(page)])
  })
  await app.close()
  await rm(home, { recursive: true, force: true })
  for (const [name, data] of snapshots) {
    await writeFile(path.join(outDir, `${name}.json`), JSON.stringify(data))
  }
  console.log(`captured ${snapshots.length} snapshots into ${outDir}`)
}

async function compare(dirA, dirB) {
  const files = (await readdir(dirA)).filter((name) => name.endsWith('.json'))
  let differences = 0
  for (const file of files) {
    const a = JSON.parse(await readFile(path.join(dirA, file), 'utf8'))
    let b
    try {
      b = JSON.parse(await readFile(path.join(dirB, file), 'utf8'))
    } catch {
      console.log(`${file}: missing in ${dirB}`)
      differences += 1
      continue
    }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    const limit = Number(process.env.PECIE_DIFF_LIMIT ?? 25)
    let fileDiffs = 0
    const say = (line) => {
      if (fileDiffs < limit) console.log(line)
    }
    for (const key of keys) {
      if (!a[key] || !b[key]) {
        say(`  ${file} ${a[key] ? 'removed' : 'added'} element ${key} [${(a[key] ?? b[key])._class ?? ''}]`)
        fileDiffs += 1
        continue
      }
      const changed = [...new Set([...Object.keys(a[key]), ...Object.keys(b[key])])].filter((property) => property !== '_class' && a[key][property] !== b[key][property])
      if (changed.length === 0) continue
      const pseudo = changed.filter((property) => property.startsWith('::'))
      const own = changed.filter((property) => !property.startsWith('::'))
      if (pseudo.length > 0) {
        say(`  ${file} ${key} [${b[key]._class}]\n    pseudo-element changed (${pseudo.length} properties)`)
        fileDiffs += 1
      }
      for (const property of own) {
        say(`  ${file} ${key} [${b[key]._class}]\n    ${property}: ${a[key][property]} -> ${b[key][property]}`)
        fileDiffs += 1
      }
    }
    console.log(`${file}: ${fileDiffs === 0 ? 'identical' : `${fileDiffs} differences`} (${keys.size} elements)`)
    differences += fileDiffs
  }
  process.exitCode = differences === 0 ? 0 : 1
}

const [mode, ...args] = process.argv.slice(2)
if (mode === 'capture') await capture(path.resolve(args[0]))
else if (mode === 'compare') await compare(path.resolve(args[0]), path.resolve(args[1]))
else {
  console.error('usage: style-snapshot.mjs capture <outDir> | compare <dirA> <dirB>')
  process.exitCode = 2
}
