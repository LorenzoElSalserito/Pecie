import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ProjectFileSystem } from '../fs/project-file-system'
import { GitAdapter } from '../history/git-adapter'
import { HistoryService } from '../history/history-service'
import { AppLoggerService } from '../logging/app-logger-service'
import { ProjectService } from '../project/project-service'
import { ShareService } from './share-service'

const noopIndexAdapter = {
  initialize: () => undefined,
  upsert: () => undefined,
  upsertAttachment: () => undefined,
  removeAttachment: () => undefined,
  remove: () => undefined,
  search: () => ({ nodes: [], content: [], attachments: [] })
}

describe('ShareService', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { force: true, recursive: true })))
  })

  async function createFixtureProject(baseDirectory: string) {
    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(baseDirectory)
    const historyService = new HistoryService(fileSystem, new GitAdapter(), logger)
    const projectService = new ProjectService(fileSystem, noopIndexAdapter, logger, historyService)
    const shareService = new ShareService(fileSystem)

    const project = await projectService.createProject({
      directory: baseDirectory,
      projectName: 'share-fixture',
      title: 'Share Fixture',
      language: 'en-US',
      template: 'paper',
      authorProfile: {
        name: 'Fixture Author',
        role: 'researcher',
        preferredLanguage: 'en-US'
      }
    })

    return { fileSystem, logger, historyService, projectService, shareService, project }
  }

  it('builds privacy review manifests without writing archives', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-share-preview-'))
    cleanupPaths.push(baseDirectory)
    const { shareService, project } = await createFixtureProject(baseDirectory)

    const response = await shareService.previewPackage({
      projectPath: project.projectPath,
      include: 'current-plus-full-history'
    })

    expect(response.manifest.include).toBe('current-plus-full-history')
    expect(response.manifest.privacyWarnings.some((warning) => warning.severity === 'critical')).toBe(true)
    expect(response.manifest.excludedPaths).toContain('cache')
  })

  it('creates current-only share packages excluding git and derived paths', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-share-current-'))
    cleanupPaths.push(baseDirectory)
    const outputDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-share-current-out-'))
    cleanupPaths.push(outputDirectory)
    const { fileSystem, shareService, project } = await createFixtureProject(baseDirectory)

    await fileSystem.writeText(project.projectPath, 'cache/derived/test.txt', 'derived-cache')
    const packagePath = path.join(outputDirectory, 'fixture-current.pe-share')

    const response = await shareService.createPackage({
      projectPath: project.projectPath,
      include: 'current-only',
      outputPath: packagePath
    })

    const stats = await readFile(response.outputPath)
    expect(stats.length).toBeGreaterThan(0)
    expect(response.manifest.gitBundlePath).toBeUndefined()
  })

  it('imports current-only packages next to the original project as a fork', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-share-current-import-'))
    cleanupPaths.push(baseDirectory)
    const { shareService, project } = await createFixtureProject(baseDirectory)
    const packagePath = path.join(baseDirectory, 'fixture-current-import.pe-share')

    await shareService.createPackage({
      projectPath: project.projectPath,
      include: 'current-only',
      outputPath: packagePath
    })

    const imported = await shareService.importPackage({
      packagePath,
      workspaceDirectory: baseDirectory,
      mode: 'fork'
    })

    expect(imported.projectPath).toBe(path.join(baseDirectory, 'share-fixture-01.pe'))
    const importedManifest = await readFile(path.join(imported.projectPath, 'manifest.json'), 'utf8')
    expect(importedManifest).toContain('shared')
  })

  it('creates and imports share packages with git history', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-share-history-'))
    cleanupPaths.push(baseDirectory)
    const outputDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-share-history-out-'))
    cleanupPaths.push(outputDirectory)
    const workspaceDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-share-history-import-'))
    cleanupPaths.push(workspaceDirectory)
    const { projectService, shareService, project } = await createFixtureProject(baseDirectory)

    const firstDocumentId = project.binder.nodes.find((node) => node.type === 'document' && node.documentId)?.documentId
    expect(firstDocumentId).toBeTruthy()
    await projectService.saveDocument({
      projectPath: project.projectPath,
      documentId: firstDocumentId!,
      title: 'Updated document',
      body: '# Updated body',
      authorProfile: {
        name: 'Fixture Author',
        role: 'researcher',
        preferredLanguage: 'en-US'
      },
      saveMode: 'manual'
    })

    const packagePath = path.join(outputDirectory, 'fixture-history.pe-share')
    const created = await shareService.createPackage({
      projectPath: project.projectPath,
      include: 'current-plus-full-history',
      outputPath: packagePath
    })

    expect(created.manifest.gitBundlePath).toBeTruthy()

    const imported = await shareService.importPackage({
      packagePath,
      workspaceDirectory,
      mode: 'fork'
    })

    const importedManifest = await readFile(path.join(imported.projectPath, 'manifest.json'), 'utf8')
    expect(importedManifest).toContain('shared')
  })
})
