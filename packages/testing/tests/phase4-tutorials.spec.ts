import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

const appEntryPath = path.resolve(__dirname, '../../../apps/desktop/out/main/index.js')

type TutorialProgressSeed = {
  completedTutorialIds?: string[]
  skippedTutorialIds?: string[]
  lastTutorialId?: string
  activeSession?: {
    tutorialId: string
    stepIndex: number
    status: 'running' | 'paused'
  }
}

async function seedSettings(homeDirectory: string, options?: { onboardingCompleted?: boolean; tutorialProgress?: TutorialProgressSeed }) {
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
          name: 'Phase 4 Tutorial Tester',
          role: 'writer',
          preferredLanguage: 'en-US'
        },
        tutorialProgress: {
          completedTutorialIds: [],
          skippedTutorialIds: [],
          ...options?.tutorialProgress
        },
        onboardingCompleted: options?.onboardingCompleted ?? true
      },
      null,
      2
    ),
    'utf8'
  )
  return {
    appDataDirectory,
    settingsPath: path.join(appDataDirectory, 'app-settings.json'),
    workspaceDirectory
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

async function launchDesktop(options?: { onboardingCompleted?: boolean; tutorialProgress?: TutorialProgressSeed }): Promise<{
  electronApp: ElectronApplication
  page: Page
  homeDirectory: string
  workspaceDirectory: string
  settingsPath: string
}> {
  const homeDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-e2e-tutorials-'))
  const seeded = await seedSettings(homeDirectory, options)
  const electronApp = await electron.launch({
    args: ['--no-sandbox', appEntryPath],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SANDBOX: '1',
      HOME: homeDirectory
    }
  })

  const page = await waitForMainWindow(electronApp)
  return {
    electronApp,
    page,
    homeDirectory,
    workspaceDirectory: seeded.workspaceDirectory,
    settingsPath: seeded.settingsPath
  }
}

async function createProjectFromLauncher(page: Page, title: string) {
  await page.getByLabel('Project title').fill(title)
  await page.getByRole('button', { name: 'Start writing' }).click()
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible()
}

test.describe('FASE 4 Tutorials', () => {
  test('first launch: the coach mark spotlights the real launcher controls and leaves the launcher usable', async () => {
    const { electronApp, page, homeDirectory, settingsPath } = await launchDesktop({ onboardingCompleted: false })

    try {
      const tutorialDialog = page.getByRole('dialog', { name: 'Getting started' })
      await expect(tutorialDialog).toBeVisible()
      await expect(tutorialDialog.getByText('Step 1 of 4')).toBeVisible()
      // Non-modal: no scrim blur, no focus trap, the launcher stays interactive underneath.
      expect(await page.locator('.dialog-scrim').count()).toBe(0)
      await expect(tutorialDialog).toHaveAttribute('aria-modal', 'false')

      const titleField = page.getByLabel('Project title')
      const spotlight = page.locator('.tutorial-spotlight')
      await expect(spotlight).toBeVisible()
      const overlaps = async (target: ReturnType<Page['locator']>): Promise<boolean> => {
        const [spot, box] = await Promise.all([spotlight.boundingBox(), target.boundingBox()])
        if (!spot || !box) return false
        return spot.x <= box.x + 1 && spot.y <= box.y + 1 && spot.x + spot.width >= box.x + box.width - 1 && spot.y + spot.height >= box.y + box.height - 1
      }
      await expect.poll(() => overlaps(titleField)).toBe(true)

      // The card never covers the control it points at.
      const [cardBox, titleBox] = await Promise.all([tutorialDialog.boundingBox(), titleField.boundingBox()])
      expect(cardBox && titleBox && (cardBox.y >= titleBox.y + titleBox.height || cardBox.y + cardBox.height <= titleBox.y || cardBox.x >= titleBox.x + titleBox.width || cardBox.x + cardBox.width <= titleBox.x)).toBe(true)

      await titleField.fill('Tour Project')
      await expect(titleField).toHaveValue('Tour Project')

      await tutorialDialog.getByRole('button', { name: 'Next' }).click()
      await expect(titleField).toBeFocused()
      await expect(tutorialDialog.getByText('Step 2 of 4')).toBeVisible()
      await expect.poll(() => overlaps(page.getByRole('radiogroup', { name: 'Template' }))).toBe(true)

      await tutorialDialog.getByRole('button', { name: 'Next' }).click()
      await expect(tutorialDialog.getByText('Step 3 of 4')).toBeVisible()
      const destinationField = page.getByLabel('Destination folder')
      await expect.poll(() => overlaps(destinationField)).toBe(true)

      await tutorialDialog.getByRole('button', { name: 'Back' }).click()
      await expect(tutorialDialog.getByText('Step 2 of 4')).toBeVisible()
      await tutorialDialog.focus()
      await page.keyboard.press('ArrowRight')
      await expect(tutorialDialog.getByText('Step 3 of 4')).toBeVisible()

      await tutorialDialog.getByRole('button', { name: 'Next' }).click()
      await expect(destinationField).toBeFocused()
      await expect(tutorialDialog.getByText('Step 4 of 4')).toBeVisible()
      await expect.poll(() => overlaps(page.getByRole('button', { name: 'Settings' }))).toBe(true)
      expect(await page.getByRole('dialog', { name: 'Settings' }).count()).toBe(0)

      await tutorialDialog.getByRole('button', { name: 'Understood' }).click()
      await expect(tutorialDialog).toBeHidden()
      expect(await page.locator('.tutorial-spotlight').count()).toBe(0)
      expect(await page.locator('.tutorial-target--active').count()).toBe(0)
      expect(await page.getByRole('dialog', { name: 'Settings' }).count()).toBe(0)
      await expect(titleField).toHaveValue('Tour Project')

      await expect
        .poll(async () => JSON.parse(await readFile(settingsPath, 'utf8')).onboardingCompleted as boolean)
        .toBe(true)
      const persistedSettings = JSON.parse(await readFile(settingsPath, 'utf8'))
      expect(persistedSettings.tutorialProgress?.completedTutorialIds).toContain('launcher-basics')
      expect(persistedSettings.tutorialProgress?.activeSession).toBeUndefined()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('Escape on the coach mark skips the tour and the close control is distinct from skip', async () => {
    const { electronApp, page, homeDirectory, settingsPath } = await launchDesktop({ onboardingCompleted: false })

    try {
      const tutorialDialog = page.getByRole('dialog', { name: 'Getting started' })
      await expect(tutorialDialog).toBeVisible()
      await expect(tutorialDialog.getByRole('button', { name: 'Skip tutorial' })).toHaveCount(1)
      await expect(tutorialDialog.getByRole('button', { name: 'Close' })).toHaveCount(1)
      await tutorialDialog.focus()
      await page.keyboard.press('Escape')
      await expect(tutorialDialog).toBeHidden()
      await expect
        .poll(async () => JSON.parse(await readFile(settingsPath, 'utf8')).tutorialProgress?.skippedTutorialIds as string[])
        .toContain('launcher-basics')
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('restores the launcher tutorial from persisted progress at the final step', async () => {
    const { electronApp, page, homeDirectory, settingsPath } = await launchDesktop({
      onboardingCompleted: false,
      tutorialProgress: {
        completedTutorialIds: [],
        skippedTutorialIds: [],
        activeSession: {
          tutorialId: 'launcher-basics',
          stepIndex: 3,
          status: 'paused'
        },
        lastTutorialId: 'launcher-basics'
      }
    })

    try {
      const tutorialDialog = page.getByRole('dialog', { name: 'Getting started' })
      await expect(tutorialDialog).toBeVisible()
      const completeAction = tutorialDialog.getByRole('button', { name: 'Understood' })
      await expect(completeAction).toBeVisible()
      await expect(tutorialDialog.getByRole('button', { name: 'Skip tutorial' })).toBeVisible()
      await completeAction.click()
      await expect(tutorialDialog).toBeHidden()
      await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0)

      const persistedSettings = JSON.parse(await readFile(settingsPath, 'utf8')) as {
        onboardingCompleted?: boolean
        tutorialProgress?: { completedTutorialIds?: string[]; activeSession?: unknown }
      }
      expect(persistedSettings.onboardingCompleted).toBe(true)
      expect(persistedSettings.tutorialProgress?.completedTutorialIds).toContain('launcher-basics')
      expect(persistedSettings.tutorialProgress?.activeSession).toBeUndefined()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('skips the launcher tutorial without reopening it', async () => {
    const { electronApp, page, homeDirectory, settingsPath } = await launchDesktop({
      onboardingCompleted: false,
      tutorialProgress: {
        completedTutorialIds: [],
        skippedTutorialIds: []
      }
    })

    try {
      const tutorialDialog = page.getByRole('dialog', { name: 'Getting started' })
      await expect(tutorialDialog).toBeVisible()
      await tutorialDialog.getByRole('button', { name: 'Skip tutorial' }).click()
      await expect(tutorialDialog).toBeHidden()
      await expect(page.getByRole('dialog', { name: 'Getting started' })).toHaveCount(0)

      const persistedSettings = JSON.parse(await readFile(settingsPath, 'utf8')) as {
        onboardingCompleted?: boolean
        tutorialProgress?: { skippedTutorialIds?: string[]; activeSession?: unknown }
      }
      expect(persistedSettings.onboardingCompleted).toBe(true)
      expect(persistedSettings.tutorialProgress?.skippedTutorialIds).toContain('launcher-basics')
      expect(persistedSettings.tutorialProgress?.activeSession).toBeUndefined()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })

  test('resumes the workspace tutorial and executes timeline plus overflow targets', async () => {
    const { electronApp, page, homeDirectory } = await launchDesktop({
      onboardingCompleted: true,
      tutorialProgress: {
        completedTutorialIds: [],
        skippedTutorialIds: [],
        activeSession: {
          tutorialId: 'workspace-basics',
          stepIndex: 2,
          status: 'paused'
        },
        lastTutorialId: 'workspace-basics'
      }
    })

    try {
      await createProjectFromLauncher(page, 'Phase 4 Workspace Tutorial')

      await page.getByRole('button', { name: 'More actions' }).click()
      await page.getByRole('menuitem', { name: 'Guide Center' }).click()

      const guideCenterDialog = page.getByRole('dialog', { name: 'Guide Center' })
      await expect(guideCenterDialog).toBeVisible()
      await guideCenterDialog.getByRole('button', { name: 'UI Tour' }).click()
      await guideCenterDialog.getByRole('button', { name: 'Resume' }).click()

      const tutorialDialog = page.getByRole('dialog', { name: 'Workspace essentials' })
      await expect(tutorialDialog).toBeVisible()
      await expect(tutorialDialog.getByText('Step 3 of 4')).toBeVisible()
      await tutorialDialog.getByRole('button', { name: 'Next' }).click()

      const activeTimelineTab = page.locator('.workspace-view-chip--active')
      await expect(activeTimelineTab).toHaveText('Timeline')
      await expect(tutorialDialog.getByText('Step 4 of 4')).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible()

      await tutorialDialog.getByRole('button', { name: 'Understood' }).click()
      await expect(tutorialDialog).toBeHidden()
    } finally {
      await electronApp.close()
      await rm(homeDirectory, { recursive: true, force: true })
    }
  })
})
