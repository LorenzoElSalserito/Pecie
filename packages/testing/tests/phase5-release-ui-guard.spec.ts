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
        expertModeEnabled: false,
        authorProfile: {
          name: 'Release UI Tester',
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

async function seedPlugin(appDataDirectory: string): Promise<void> {
  const pluginDirectory = path.join(appDataDirectory, 'plugins', 'release-ui-plugin')
  await mkdir(pluginDirectory, { recursive: true })
  await writeFile(
    path.join(pluginDirectory, 'plugin.json'),
    JSON.stringify(
      {
        id: 'release-ui-plugin',
        schemaVersion: 1,
        label: 'Release UI Plugin',
        version: '0.1.0',
        entryPoint: 'index.js',
        permissions: ['project.read', 'export.read'],
        hooks: ['onProjectOpen']
      },
      null,
      2
    ),
    'utf8'
  )
  await writeFile(path.join(pluginDirectory, 'index.js'), 'module.exports.hooks = {}', 'utf8')

  const brokenPluginDirectory = path.join(appDataDirectory, 'plugins', 'broken-release-ui-plugin')
  await mkdir(brokenPluginDirectory, { recursive: true })
  await writeFile(
    path.join(brokenPluginDirectory, 'plugin.json'),
    JSON.stringify(
      {
        id: 'broken-release-ui-plugin',
        schemaVersion: 1,
        label: 'Broken Release UI Plugin',
        version: '0.1.0',
        entryPoint: '../escape.js',
        permissions: ['project.write'],
        hooks: ['onDocumentSave']
      },
      null,
      2
    ),
    'utf8'
  )
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
  const homeDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-e2e-release-ui-'))
  const seeded = await seedSettings(homeDirectory)
  await seedPlugin(seeded.appDataDirectory)

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

test.describe('FASE 5 Release UI guard', () => {
  test('keeps technical plugin, runtime and local path details out of standard settings', async () => {
    const { electronApp, page, homeDirectory, appDataDirectory } = await launchDesktop()

    try {
      await page.getByRole('button', { name: 'Settings' }).click()
      const settingsDialog = page.getByRole('dialog', { name: 'Settings' })
      await expect(settingsDialog).toBeVisible()
      await expect(settingsDialog.getByRole('checkbox', { name: 'Enable expert mode' })).not.toBeChecked()

      await expect(settingsDialog.getByText('Release UI Plugin')).toBeVisible()
      await expect(settingsDialog.getByText('Local data folder configured.')).toBeVisible()
      await expect(settingsDialog.getByText('Local extensions stay controllable here.')).toBeVisible()

      const forbiddenTexts = [
        'release-ui-plugin',
        'project.read',
        'export.read',
        'onProjectOpen',
        'index.js',
        'plugins/broken-release-ui-plugin/plugin.json',
        'Invalid plugin manifest',
        'entryPoint',
        'bundled-sidecar',
        'Bundled sidecar',
        appDataDirectory
      ]

      for (const forbiddenText of forbiddenTexts) {
        await expect(settingsDialog.getByText(forbiddenText, { exact: true })).toHaveCount(0)
      }

      await settingsDialog.getByRole('checkbox', { name: 'Enable expert mode' }).check()
      await expect(settingsDialog.getByText('project.read, export.read')).toBeVisible()
      await expect(settingsDialog.getByText('onProjectOpen')).toBeVisible()
      await expect(settingsDialog.getByText('plugins/broken-release-ui-plugin/plugin.json')).toBeVisible()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })
})
