import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProjectFileSystem } from '../fs/project-file-system'
import { AppLoggerService } from '../logging/app-logger-service'
import { ProjectService } from '../project/project-service'
import { PrivacyService } from './privacy-service'

const noopIndexAdapter = {
  initialize: () => undefined,
  upsert: () => undefined,
  upsertAttachment: () => undefined,
  removeAttachment: () => undefined,
  remove: () => undefined,
  search: () => ({ nodes: [], content: [], attachments: [] })
}

describe('PrivacyService', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { force: true, recursive: true })))
  })

  it('builds a privacy inventory for app and project storage', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-privacy-inventory-'))
    cleanupPaths.push(baseDirectory)
    const appDataDirectory = path.join(baseDirectory, '.pecie')
    await mkdir(path.join(appDataDirectory, 'logs'), { recursive: true })
    await writeFile(path.join(appDataDirectory, 'app-settings.json'), '{"locale":"en-US"}', 'utf8')
    await writeFile(path.join(appDataDirectory, 'logs', 'session.jsonl'), '{"event":"boot"}\n', 'utf8')

    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(appDataDirectory)
    const projectService = new ProjectService(fileSystem, noopIndexAdapter, logger)
    const project = await projectService.createProject({
      directory: baseDirectory,
      projectName: 'privacy-fixture',
      title: 'Privacy Fixture',
      language: 'en-US',
      template: 'blank',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'en-US'
      }
    })

    await fileSystem.writeText(project.projectPath, 'cache/index.sqlite', 'sqlite-bytes')
    await fileSystem.writeText(project.projectPath, 'cache/index.sqlite-shm', 'sqlite-shm')
    await fileSystem.writeText(project.projectPath, 'cache/index.sqlite-wal', 'sqlite-wal')
    await fileSystem.writeText(project.projectPath, 'cache/search/query.txt', 'search-cache')
    await fileSystem.writeText(project.projectPath, 'cache/derived/artifact.txt', 'derived-cache')
    await fileSystem.writeText(project.projectPath, 'cache/preview/result.html', '<p>preview</p>')
    await fileSystem.writeText(project.projectPath, 'cache/thumbnails/thumb.txt', 'thumb')
    await fileSystem.writeText(project.projectPath, 'logs/local-audit/session.log', 'audit')

    const service = new PrivacyService(appDataDirectory, fileSystem, projectService, logger)
    const inventory = await service.getInventory({
      workspaceDirectory: baseDirectory,
      projectPath: project.projectPath
    })

    expect(inventory.items.some((item) => item.category === 'settings')).toBe(true)
    expect(inventory.items.some((item) => item.category === 'sqlite' && item.maintenanceAction === 'rebuildIndex')).toBe(true)
    expect(inventory.items.some((item) => item.relativePath === 'cache/index.sqlite-shm')).toBe(true)
    expect(inventory.items.some((item) => item.relativePath === 'cache/index.sqlite-wal')).toBe(true)
    expect(
      inventory.items.some(
        (item) => item.relativePath === 'cache/search/' && item.maintenanceAction === 'rebuildIndex' && item.containsSensitiveData
      )
    ).toBe(true)
    expect(
      inventory.items.some(
        (item) => item.relativePath === 'cache/derived/' && item.maintenanceAction === 'rebuildIndex' && item.containsSensitiveData
      )
    ).toBe(true)
    expect(
      inventory.items.some(
        (item) => item.maintenanceAction === 'clearPreviewCache' && item.containsSensitiveData
      )
    ).toBe(true)
    expect(
      inventory.items.some(
        (item) => item.maintenanceAction === 'clearThumbnails' && item.containsSensitiveData
      )
    ).toBe(true)
    expect(inventory.items.some((item) => item.category === 'logs' && item.source === 'project')).toBe(true)
    expect(inventory.totals.sizeBytes).toBeGreaterThan(0)
  })

  it('runs maintenance actions across workspace projects', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-privacy-maintenance-'))
    cleanupPaths.push(baseDirectory)
    const appDataDirectory = path.join(baseDirectory, '.pecie')
    await mkdir(path.join(appDataDirectory, 'logs'), { recursive: true })
    await writeFile(path.join(appDataDirectory, 'logs', 'session.jsonl'), '{"event":"boot"}\n', 'utf8')

    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(appDataDirectory)
    const projectService = new ProjectService(fileSystem, noopIndexAdapter, logger)
    const project = await projectService.createProject({
      directory: baseDirectory,
      projectName: 'maintenance-fixture',
      title: 'Maintenance Fixture',
      language: 'en-US',
      template: 'blank',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'en-US'
      }
    })

    await fileSystem.writeText(project.projectPath, 'cache/preview/result.html', '<p>preview</p>')
    await fileSystem.writeText(project.projectPath, 'cache/search/query.txt', 'search-cache')
    await fileSystem.writeText(project.projectPath, 'cache/derived/artifact.txt', 'derived-cache')
    await fileSystem.writeText(project.projectPath, 'cache/thumbnails/thumb.txt', 'thumb')
    await fileSystem.writeText(project.projectPath, 'logs/local-audit/session.log', 'audit')

    const rebuildSpy = vi.spyOn(projectService, 'rebuildDerivedIndexForMaintenance')

    const service = new PrivacyService(appDataDirectory, fileSystem, projectService, logger)

    const previewResult = await service.runMaintenance({
      action: 'clearPreviewCache',
      workspaceDirectory: baseDirectory
    })
    expect(previewResult.success).toBe(true)
    expect(await fileSystem.statEntry(project.projectPath, 'cache/preview').catch(() => null)).toBeNull()

    const logsResult = await service.runMaintenance({
      action: 'clearLogs',
      workspaceDirectory: baseDirectory
    })
    expect(logsResult.affectedPaths.some((item) => item.includes('app:logs'))).toBe(true)

    await service.runMaintenance({
      action: 'rebuildIndex',
      workspaceDirectory: baseDirectory,
      projectPath: project.projectPath
    })
    expect(rebuildSpy).toHaveBeenCalledWith(project.projectPath)
    expect(await fileSystem.statEntry(project.projectPath, 'cache/search/query.txt').catch(() => null)).toBeNull()
    expect(await fileSystem.statEntry(project.projectPath, 'cache/derived/artifact.txt').catch(() => null)).toBeNull()
  })
})
