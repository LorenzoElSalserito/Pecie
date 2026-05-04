import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ProjectFileSystem } from '../fs/project-file-system'
import { AppLoggerService } from '../logging/app-logger-service'
import { ProjectService } from '../project/project-service'
import { GitAdapter } from './git-adapter'
import { HistoryService } from './history-service'

const noopIndexAdapter = {
  initialize: () => undefined,
  upsert: () => undefined,
  upsertAttachment: () => undefined,
  removeAttachment: () => undefined,
  remove: () => undefined,
  search: () => ({ nodes: [], content: [], attachments: [] })
}

describe('HistoryService', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { force: true, recursive: true })))
  })

  it('creates checkpoints only on manual save and materializes milestones', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-history-service-'))
    cleanupPaths.push(baseDirectory)

    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(baseDirectory)
    const historyService = new HistoryService(fileSystem, new GitAdapter(), logger)
    const projectService = new ProjectService(fileSystem, noopIndexAdapter, logger, historyService)

    const createdProject = await projectService.createProject({
      directory: baseDirectory,
      projectName: 'history-demo',
      title: 'History Demo',
      language: 'it-IT',
      template: 'blank',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      }
    })

    const firstDocumentNode = createdProject.binder.nodes.find((node) => node.type === 'document' && node.documentId)
    expect(firstDocumentNode?.documentId).toBeTruthy()

    await projectService.saveDocument({
      projectPath: createdProject.projectPath,
      documentId: firstDocumentNode?.documentId ?? '',
      title: 'Capitolo 1',
      body: '# Capitolo 1\n\nPrima bozza.\n',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      },
      saveMode: 'manual'
    })

    await projectService.saveDocument({
      projectPath: createdProject.projectPath,
      documentId: firstDocumentNode?.documentId ?? '',
      title: 'Capitolo 1',
      body: '# Capitolo 1\n\nPrima bozza.\n\nAggiornamento automatico.\n',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      },
      saveMode: 'autosave'
    })

    const milestone = await historyService.createMilestone({
      projectPath: createdProject.projectPath,
      label: 'Prima stesura',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      }
    })

    expect(milestone.event.kind).toBe('milestone')

    const repaired = await historyService.repairTimeline({
      projectPath: createdProject.projectPath
    })

    expect(repaired.snapshot.events.some((event) => event.kind === 'bootstrap')).toBe(true)
    expect(repaired.snapshot.events.some((event) => event.kind === 'checkpoint')).toBe(true)
    expect(repaired.snapshot.events.some((event) => event.kind === 'milestone')).toBe(true)
    expect(repaired.milestones.milestones).toHaveLength(1)
  })

  it('diffs and restores selections against historical body content rather than raw frontmatter', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-history-body-'))
    cleanupPaths.push(baseDirectory)

    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(baseDirectory)
    const historyService = new HistoryService(fileSystem, new GitAdapter(), logger)
    const projectService = new ProjectService(fileSystem, noopIndexAdapter, logger, historyService)

    const createdProject = await projectService.createProject({
      directory: baseDirectory,
      projectName: 'history-body-demo',
      title: 'History Body Demo',
      language: 'it-IT',
      template: 'blank',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      }
    })

    const firstDocumentNode = createdProject.binder.nodes.find((node) => node.type === 'document' && node.documentId)
    expect(firstDocumentNode?.documentId).toBeTruthy()

    const historicalBody = 'Alpha beta gamma.\nSeconda riga.\n'
    await projectService.saveDocument({
      projectPath: createdProject.projectPath,
      documentId: firstDocumentNode?.documentId ?? '',
      title: 'Documento storico',
      body: historicalBody,
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      },
      saveMode: 'manual'
    })

    await projectService.saveDocument({
      projectPath: createdProject.projectPath,
      documentId: firstDocumentNode?.documentId ?? '',
      title: 'Documento storico',
      body: 'Versione locale corrente.\n',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      },
      saveMode: 'autosave'
    })

    const repairedTimeline = await historyService.repairTimeline({
      projectPath: createdProject.projectPath
    })
    const checkpointEvent = repairedTimeline.snapshot.events.find((event) => event.kind === 'checkpoint')
    expect(checkpointEvent?.timelineEventId).toBeTruthy()

    const diff = await projectService.diffDocument({
      projectPath: createdProject.projectPath,
      documentId: firstDocumentNode?.documentId ?? '',
      baseline: { kind: 'checkpoint', timelineEventId: checkpointEvent?.timelineEventId ?? '' }
    })

    expect(diff.before.content).toBe(historicalBody)
    expect(diff.before.content).not.toContain('---')
    expect(diff.before.content).not.toContain('title:')

    const selectedText = await historyService.readHistoricalBodySelection({
      projectPath: createdProject.projectPath,
      relativePath: firstDocumentNode?.path ?? '',
      sourceTimelineEventId: checkpointEvent?.timelineEventId ?? '',
      startOffset: historicalBody.indexOf('beta'),
      endOffset: historicalBody.indexOf('gamma') + 'gamma'.length
    })

    expect(selectedText).toBe('beta gamma')
  })
})
