import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { AppSettingsService } from './app-settings-service'

describe('AppSettingsService', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { recursive: true, force: true })))
  })

  it('normalizes and persists export preview preferences per profile', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'pecie-app-settings-'))
    cleanupPaths.push(root)
    const userDataDirectory = path.join(root, 'user-data')
    const documentsDirectory = path.join(root, 'documents')
    const service = new AppSettingsService(userDataDirectory, documentsDirectory, 'it-IT')

    const bootstrap = await service.bootstrap()
    const response = await service.saveSettings({
      settings: {
        ...bootstrap.settings,
        preview: {
          ...bootstrap.settings.preview,
          exportPreview: {
            byProfile: {
              'thesis-pdf': {
                profileId: 'thesis-pdf',
                showPreviewBeforeSave: true,
                lastDisclosureShownForMode: 'performance'
              },
              broken: {
                profileId: '   ',
                showPreviewBeforeSave: true,
                lastDisclosureShownForMode: 'invalid-mode' as never
              }
            },
            globalDefault: false
          }
        }
      }
    })

    expect(response.settings.preview.exportPreview.byProfile['thesis-pdf']).toEqual({
      profileId: 'thesis-pdf',
      showPreviewBeforeSave: true,
      lastDisclosureShownForMode: 'performance'
    })
    expect(response.settings.preview.exportPreview.byProfile.broken).toBeUndefined()
    expect(response.settings.preview.exportPreview.globalDefault).toBe(false)

    const raw = JSON.parse(await readFile(path.join(userDataDirectory, 'app-settings.json'), 'utf8')) as {
      preview?: { exportPreview?: { byProfile?: Record<string, unknown> } }
    }
    expect(raw.preview?.exportPreview?.byProfile?.['thesis-pdf']).toBeDefined()
  })

  it('normalizes and persists tutorial progress in app settings', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'pecie-app-settings-tutorials-'))
    cleanupPaths.push(root)
    const userDataDirectory = path.join(root, 'user-data')
    const documentsDirectory = path.join(root, 'documents')
    const service = new AppSettingsService(userDataDirectory, documentsDirectory, 'en-US')

    const bootstrap = await service.bootstrap()
    const response = await service.saveSettings({
      settings: {
        ...bootstrap.settings,
        tutorialProgress: {
          completedTutorialIds: ['workspace-basics', '', 12 as never],
          skippedTutorialIds: ['history-basics'],
          lastTutorialId: ' workspace-basics ',
          activeSession: {
            tutorialId: ' workspace-basics ',
            stepIndex: 2,
            status: 'running'
          }
        }
      }
    })

    expect(response.settings.tutorialProgress.completedTutorialIds).toEqual(['workspace-basics'])
    expect(response.settings.tutorialProgress.skippedTutorialIds).toEqual(['history-basics'])
    expect(response.settings.tutorialProgress.lastTutorialId).toBe('workspace-basics')
    expect(response.settings.tutorialProgress.activeSession).toEqual({
      tutorialId: 'workspace-basics',
      stepIndex: 2,
      status: 'running'
    })

    const raw = JSON.parse(await readFile(path.join(userDataDirectory, 'app-settings.json'), 'utf8')) as {
      tutorialProgress?: {
        completedTutorialIds?: string[]
        skippedTutorialIds?: string[]
        lastTutorialId?: string
        activeSession?: { tutorialId?: string; stepIndex?: number; status?: string }
      }
    }
    expect(raw.tutorialProgress?.completedTutorialIds).toEqual(['workspace-basics'])
    expect(raw.tutorialProgress?.skippedTutorialIds).toEqual(['history-basics'])
    expect(raw.tutorialProgress?.lastTutorialId).toBe('workspace-basics')
    expect(raw.tutorialProgress?.activeSession).toEqual({
      tutorialId: 'workspace-basics',
      stepIndex: 2,
      status: 'running'
    })
  })

  it('defaults expert mode to false and persists explicit opt-in', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'pecie-app-settings-expert-mode-'))
    cleanupPaths.push(root)
    const userDataDirectory = path.join(root, 'user-data')
    const documentsDirectory = path.join(root, 'documents')
    const service = new AppSettingsService(userDataDirectory, documentsDirectory, 'en-US')

    const bootstrap = await service.bootstrap()
    expect(bootstrap.settings.expertModeEnabled).toBe(false)

    const response = await service.saveSettings({
      settings: {
        ...bootstrap.settings,
        expertModeEnabled: true
      }
    })

    expect(response.settings.expertModeEnabled).toBe(true)

    const raw = JSON.parse(await readFile(path.join(userDataDirectory, 'app-settings.json'), 'utf8')) as {
      expertModeEnabled?: boolean
    }
    expect(raw.expertModeEnabled).toBe(true)
  })
})
