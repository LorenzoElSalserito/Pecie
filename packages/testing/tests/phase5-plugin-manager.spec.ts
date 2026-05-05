import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

const appEntryPath = path.resolve(__dirname, '../../../apps/desktop/out/main/index.js')

async function seedSettings(homeDirectory: string): Promise<{ appDataDirectory: string; workspaceDirectory: string }> {
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
          name: 'Phase 5 Plugin Tester',
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

  return { appDataDirectory, workspaceDirectory }
}

async function seedPlugin(input: {
  appDataDirectory: string
  directory: string
  manifest: Record<string, unknown>
  source?: string
}): Promise<void> {
  const pluginDirectory = path.join(input.appDataDirectory, 'plugins', input.directory)
  await mkdir(pluginDirectory, { recursive: true })
  await writeFile(path.join(pluginDirectory, 'plugin.json'), JSON.stringify(input.manifest, null, 2), 'utf8')
  if (input.source) {
    await writeFile(path.join(pluginDirectory, input.manifest.entryPoint as string), input.source, 'utf8')
  }
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

async function launchDesktop(): Promise<{
  electronApp: ElectronApplication
  page: Page
  homeDirectory: string
  appDataDirectory: string
}> {
  const homeDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-e2e-plugin-manager-'))
  const seeded = await seedSettings(homeDirectory)
  await seedPlugin({
    appDataDirectory: seeded.appDataDirectory,
    directory: 'alpha-plugin',
    manifest: {
      id: 'alpha-plugin',
      schemaVersion: 1,
      label: 'Alpha Plugin',
      version: '0.1.0',
      description: 'Reads project data for diagnostics.',
      entryPoint: 'index.js',
      permissions: ['project.read', 'export.read'],
      hooks: ['onProjectOpen']
    },
    source: 'module.exports.hooks = { onProjectOpen() { return { ok: true } } }'
  })
  await seedPlugin({
    appDataDirectory: seeded.appDataDirectory,
    directory: 'disabled-plugin',
    manifest: {
      id: 'disabled-plugin',
      schemaVersion: 1,
      label: 'Disabled Plugin',
      version: '0.1.0',
      entryPoint: 'index.js',
      permissions: ['project.read'],
      hooks: ['onProjectOpen'],
      enabledByDefault: false
    },
    source: 'module.exports.hooks = { onProjectOpen() { return { ok: true } } }'
  })
  await seedPlugin({
    appDataDirectory: seeded.appDataDirectory,
    directory: 'broken-plugin',
    manifest: {
      id: 'broken-plugin',
      schemaVersion: 1,
      label: 'Broken Plugin',
      version: '0.1.0',
      entryPoint: '../escape.js',
      permissions: ['project.write'],
      hooks: ['onDocumentSave']
    }
  })

  const electronApp = await electron.launch({
    args: ['--no-sandbox', appEntryPath],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SANDBOX: '1',
      HOME: homeDirectory
    }
  })

  const page = await waitForMainWindow(electronApp)
  return { electronApp, page, homeDirectory, appDataDirectory: seeded.appDataDirectory }
}

test.describe('FASE 5 Plugin Manager', () => {
  test('lists validated local plugins and isolates broken manifests in Settings', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop()

    try {
      await page.getByRole('button', { name: 'Settings' }).click()
      const settingsDialog = page.getByRole('dialog', { name: 'Settings' })
      await expect(settingsDialog).toBeVisible()
      await settingsDialog.getByRole('checkbox', { name: 'Enable expert mode' }).check()

      await expect(settingsDialog.getByRole('heading', { name: 'Plugins' })).toBeVisible()
      await expect(settingsDialog.getByText('Loading plugins...')).toBeHidden()
      await expect(settingsDialog.getByText('Installed plugins')).toBeVisible()
      await expect(settingsDialog.getByText('Enabled plugins')).toBeVisible()
      await expect(settingsDialog.locator('dt').filter({ hasText: 'Diagnostics' }).first()).toBeVisible()

      const alphaCard = settingsDialog.locator('article').filter({ hasText: 'Alpha Plugin' })
      await expect(alphaCard).toBeVisible()
      await expect(alphaCard.getByText('alpha-plugin', { exact: true })).toBeVisible()
      await expect(alphaCard.getByText('project.read, export.read')).toBeVisible()
      await expect(alphaCard.getByText('onProjectOpen')).toBeVisible()

      const disabledCard = settingsDialog.locator('article').filter({ hasText: 'Disabled Plugin' })
      await expect(disabledCard).toBeVisible()
      await expect(disabledCard.locator('strong').filter({ hasText: 'disabled' })).toBeVisible()
      await disabledCard.getByRole('button', { name: 'Enable plugin' }).click()
      await expect(disabledCard.locator('strong').filter({ hasText: 'enabled' })).toBeVisible()
      await expect(disabledCard.getByRole('button', { name: 'Disable plugin' })).toBeVisible()

      await expect(settingsDialog.getByRole('heading', { name: 'Invalid plugin manifest' })).toBeVisible()
      await expect(settingsDialog.getByText('plugins/broken-plugin/plugin.json')).toBeVisible()
      await expect(settingsDialog.getByText(/entryPoint/i)).toBeVisible()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })
})
