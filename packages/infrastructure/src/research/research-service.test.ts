import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ProjectFileSystem } from '../fs/project-file-system'
import { GitAdapter } from '../history/git-adapter'
import { HistoryService } from '../history/history-service'
import { AppLoggerService } from '../logging/app-logger-service'
import { ProjectService } from '../project/project-service'
import { ResearchService } from './research-service'

const noopIndexAdapter = {
  initialize: () => undefined,
  upsert: () => undefined,
  upsertAttachment: () => undefined,
  removeAttachment: () => undefined,
  remove: () => undefined,
  search: () => ({ nodes: [], content: [], attachments: [] })
}

describe('ResearchService', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { force: true, recursive: true })))
  })

  it('creates research notes with canonical frontmatter and keeps them out of export', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-research-notes-'))
    cleanupPaths.push(baseDirectory)

    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(baseDirectory)
    const historyService = new HistoryService(fileSystem, new GitAdapter(), logger)
    const projectService = new ProjectService(fileSystem, noopIndexAdapter, logger, historyService)
    const researchService = new ResearchService(fileSystem)

    const project = await projectService.createProject({
      directory: baseDirectory,
      projectName: 'research-notes',
      title: 'Research Notes',
      language: 'en-US',
      template: 'paper',
      authorProfile: {
        name: 'Fixture Author',
        role: 'researcher',
        preferredLanguage: 'en-US'
      }
    })

    const created = await researchService.createResearchNote({
      projectPath: project.projectPath,
      title: 'Method note',
      kind: 'methodological',
      body: 'This is a private research note.'
    })

    expect(created.note.includeInExport).toBe(false)

    const listed = await researchService.listResearchNotes({
      projectPath: project.projectPath
    })
    expect(listed.notes).toHaveLength(1)
    expect(listed.notes[0]?.kind).toBe('methodological')
    expect(listed.notes[0]?.body).toContain('private research note')
  })

  it('imports pdf files with deduplication by content hash', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-research-pdf-'))
    cleanupPaths.push(baseDirectory)

    const sourceDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-research-pdf-source-'))
    cleanupPaths.push(sourceDirectory)

    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(baseDirectory)
    const historyService = new HistoryService(fileSystem, new GitAdapter(), logger)
    const projectService = new ProjectService(fileSystem, noopIndexAdapter, logger, historyService)
    const researchService = new ResearchService(fileSystem)

    const project = await projectService.createProject({
      directory: baseDirectory,
      projectName: 'research-pdf',
      title: 'Research PDF',
      language: 'en-US',
      template: 'paper',
      authorProfile: {
        name: 'Fixture Author',
        role: 'researcher',
        preferredLanguage: 'en-US'
      }
    })

    const firstPdfPath = path.join(sourceDirectory, 'sample-a.pdf')
    const secondPdfPath = path.join(sourceDirectory, 'sample-b.pdf')
    await writeFile(firstPdfPath, Buffer.from('%PDF-1.4 same content', 'utf8'))
    await writeFile(secondPdfPath, Buffer.from('%PDF-1.4 same content', 'utf8'))

    const firstImport = await researchService.importPdf({
      projectPath: project.projectPath,
      sourcePaths: [firstPdfPath]
    })
    const secondImport = await researchService.importPdf({
      projectPath: project.projectPath,
      sourcePaths: [secondPdfPath]
    })

    expect(firstImport.library.items).toHaveLength(1)
    expect(secondImport.library.items).toHaveLength(1)
    expect(firstImport.imported[0]?.id).toBe(secondImport.imported[0]?.id)
  })

  it('persists graph links between research notes, pdf items and binder documents', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-research-graph-'))
    cleanupPaths.push(baseDirectory)

    const sourceDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-research-graph-source-'))
    cleanupPaths.push(sourceDirectory)

    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(baseDirectory)
    const historyService = new HistoryService(fileSystem, new GitAdapter(), logger)
    const projectService = new ProjectService(fileSystem, noopIndexAdapter, logger, historyService)
    const researchService = new ResearchService(fileSystem)

    const project = await projectService.createProject({
      directory: baseDirectory,
      projectName: 'research-graph',
      title: 'Research Graph',
      language: 'en-US',
      template: 'paper',
      authorProfile: {
        name: 'Fixture Author',
        role: 'researcher',
        preferredLanguage: 'en-US'
      }
    })

    const note = await researchService.createResearchNote({
      projectPath: project.projectPath,
      title: 'Idea note',
      kind: 'idea',
      body: 'Connect this note to sources.'
    })
    const pdfPath = path.join(sourceDirectory, 'source.pdf')
    await writeFile(pdfPath, Buffer.from('%PDF-1.4 source content', 'utf8'))
    const pdfImport = await researchService.importPdf({
      projectPath: project.projectPath,
      sourcePaths: [pdfPath]
    })
    const binderDocumentId = project.binder.nodes.find((node) => node.type === 'document' && node.documentId)?.documentId
    expect(binderDocumentId).toBeTruthy()

    await researchService.createLink({
      projectPath: project.projectPath,
      sourceType: 'note',
      sourceId: note.note.id,
      targetType: 'pdf',
      targetId: pdfImport.imported[0]!.id,
      relation: 'supports'
    })
    await researchService.createLink({
      projectPath: project.projectPath,
      sourceType: 'note',
      sourceId: note.note.id,
      targetType: 'binder-document',
      targetId: binderDocumentId!,
      relation: 'draft-origin'
    })

    const graph = await researchService.getResearchGraph({
      projectPath: project.projectPath
    })

    expect(graph.graph.links).toHaveLength(2)
    expect(graph.graph.links.map((link) => link.relation)).toEqual(['supports', 'draft-origin'])
  })
})
