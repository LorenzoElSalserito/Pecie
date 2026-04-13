import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readFile } from 'node:fs/promises'

import { afterEach, describe, expect, it } from 'vitest'

import { ProjectFileSystem } from '../fs/project-file-system'
import { AppLoggerService } from '../logging/app-logger-service'
import { GitAdapter } from '../history/git-adapter'
import { HistoryService } from '../history/history-service'
import { ProjectService } from './project-service'

const noopIndexAdapter = {
  initialize: () => undefined,
  upsert: () => undefined,
  upsertAttachment: () => undefined,
  removeAttachment: () => undefined,
  remove: () => undefined,
  search: () => ({ nodes: [], content: [], attachments: [] })
}

function createMemoryIndexAdapter() {
  const documents = new Map<string, { nodeId: string; documentId: string; path: string; title: string; body: string }>()
  const attachments = new Map<string, { relativePath: string; absolutePath: string; name: string; extension: string; content: string }>()

  return {
    initialize: () => undefined,
    upsert: (_databasePath: string, input: { nodeId: string; documentId: string; path: string; title: string; body: string }) => {
      documents.set(input.documentId, input)
    },
    upsertAttachment: (
      _databasePath: string,
      input: { relativePath: string; absolutePath: string; name: string; extension: string; content: string }
    ) => {
      attachments.set(input.relativePath, input)
    },
    removeAttachment: (_databasePath: string, relativePath: string) => {
      attachments.delete(relativePath)
    },
    remove: (_databasePath: string, documentId: string) => {
      documents.delete(documentId)
    },
    search: (_databasePath: string, query: string) => {
      const needle = query.toLowerCase()
      return {
        nodes: [...documents.values()]
          .filter((entry) => entry.title.toLowerCase().includes(needle))
          .map((entry) => ({
            nodeId: entry.nodeId,
            documentId: entry.documentId,
            path: entry.path,
            title: entry.title,
            snippet: entry.title
          })),
        content: [...documents.values()]
          .filter((entry) => entry.body.toLowerCase().includes(needle))
          .map((entry) => ({
            nodeId: entry.nodeId,
            documentId: entry.documentId,
            path: entry.path,
            title: entry.title,
            snippet: entry.body
          })),
        attachments: [...attachments.values()]
          .filter((entry) => `${entry.name} ${entry.content}`.toLowerCase().includes(needle))
          .map((entry) => ({
            relativePath: entry.relativePath,
            absolutePath: entry.absolutePath,
            name: entry.name,
            extension: entry.extension,
            snippet: entry.content || entry.name
          }))
      }
    }
  }
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let index = 0; index < 8; index += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeStoredZipArchive(entries: Array<[string, Buffer]>): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const [fileName, content] of entries) {
    const fileNameBuffer = Buffer.from(fileName, 'utf8')
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0, 6)
    header.writeUInt16LE(0, 8)
    header.writeUInt16LE(0, 10)
    header.writeUInt16LE(0, 12)
    header.writeUInt32LE(crc32(content), 14)
    header.writeUInt32LE(content.length, 18)
    header.writeUInt32LE(content.length, 22)
    header.writeUInt16LE(fileNameBuffer.length, 26)
    header.writeUInt16LE(0, 28)
    localParts.push(header, fileNameBuffer, content)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc32(content), 16)
    central.writeUInt32LE(content.length, 20)
    central.writeUInt32LE(content.length, 24)
    central.writeUInt16LE(fileNameBuffer.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, fileNameBuffer)

    offset += header.length + fileNameBuffer.length + content.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, end])
}

function makeStoredZip(entryName: string, content: string): Buffer {
  return makeStoredZipArchive([[entryName, Buffer.from(content, 'utf8')]])
}

function makeMinimalDocx(text: string): Buffer {
  return makeStoredZipArchive([
    [
      '[Content_Types].xml',
      Buffer.from(
        `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
        'utf8'
      )
    ],
    [
      '_rels/.rels',
      Buffer.from(
        `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
        'utf8'
      )
    ],
    [
      'word/document.xml',
      Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${text}</w:t></w:r></w:p>
  </w:body>
</w:document>`,
        'utf8'
      )
    ]
  ])
}

function makeMinimalPdf(text: string): Buffer {
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${text.length + 29} >>
stream
BT
/F1 18 Tf
40 90 Td
(${text}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000063 00000 n 
0000000122 00000 n 
0000000248 00000 n 
0000000360 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
430
%%EOF`
  return Buffer.from(pdf, 'utf8')
}

describe('ProjectService', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { force: true, recursive: true })))
  })

  it('creates a valid .pe project and reopens it', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(baseDirectory)
    const historyService = new HistoryService(fileSystem, new GitAdapter(), logger)
    const service = new ProjectService(fileSystem, noopIndexAdapter, logger, historyService)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'thesis-demo',
      title: 'Thesis Demo',
      language: 'it-IT',
      template: 'thesis',
      authorProfile: {
        name: 'Fixture Author',
        role: 'student',
        preferredLanguage: 'it-IT'
      }
    })

    expect(createdProject.projectPath.endsWith('.pe')).toBe(true)

    const openedProject = await service.openProject({
      projectPath: createdProject.projectPath
    })

    expect(openedProject.manifest.title).toBe('Thesis Demo')
    expect(openedProject.binder.nodes.length).toBeGreaterThan(0)
  })

  it('creates blank projects with a neutral structure that stays fully customizable', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const service = new ProjectService(undefined, noopIndexAdapter)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'blank-demo',
      title: 'Progetto Libero',
      language: 'it-IT',
      template: 'blank',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      }
    })

    expect(createdProject.project.documentKind).toBe('blank')
    expect(createdProject.binder.nodes.find((node) => node.id === 'project-sheet')?.title).toBe('Scheda progetto')
    expect(createdProject.binder.nodes.find((node) => node.id === 'opening-document')?.title).toBe('Documento iniziale')

    const projectSheet = await service.loadDocument({
      projectPath: createdProject.projectPath,
      documentId: 'doc-000'
    })
    const openingDocument = await service.loadDocument({
      projectPath: createdProject.projectPath,
      documentId: 'doc-001'
    })

    expect(projectSheet.document.frontmatter.type).toBe('project-sheet')
    expect(projectSheet.document.body).toContain('## Come usare questo progetto')
    expect(openingDocument.document.frontmatter.type).toBe('chapter')
    expect(openingDocument.document.body).toContain('Inizia da qui oppure riorganizza liberamente il binder')
  })

  it('creates thesis projects with a prefilled editable frontespiece', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const service = new ProjectService(undefined, noopIndexAdapter)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'thesis-frontespiece',
      title: 'Tesi sulle Interfacce Calde',
      language: 'it-IT',
      template: 'thesis',
      authorProfile: {
        name: 'Lorenzo DM',
        role: 'student',
        institutionName: 'Universita Esempio',
        department: 'Dipartimento di Design',
        preferredLanguage: 'it-IT'
      }
    })

    const frontespiece = await service.loadDocument({
      projectPath: createdProject.projectPath,
      documentId: 'doc-000'
    })

    expect(frontespiece.document.title).toBe('Frontespizio')
    expect(frontespiece.document.frontmatter.type).toBe('frontespiece')
    expect(frontespiece.document.body).toContain('**Relatore:** [Inserisci nome relatore]')
    expect(frontespiece.document.body).toContain('**Correlatore:** [Inserisci nome correlatore]')
    expect(frontespiece.document.body).toContain('**Studente:** Lorenzo DM')
  })

  it('loads and saves a project document updating markdown and binder title', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const service = new ProjectService(undefined, noopIndexAdapter)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'thesis-editor',
      title: 'Editor Demo',
      language: 'it-IT',
      template: 'thesis',
      authorProfile: {
        name: 'Fixture Author',
        role: 'student',
        preferredLanguage: 'it-IT'
      }
    })

    const loadedDocument = await service.loadDocument({
      projectPath: createdProject.projectPath,
      documentId: 'doc-001'
    })

    expect(loadedDocument.document.title).toBe('Introduzione')

    const savedDocument = await service.saveDocument({
      projectPath: createdProject.projectPath,
      documentId: 'doc-001',
      title: 'Introduzione rivista',
      body: '# Titolo\n\nNuovo contenuto di prova.',
      authorProfile: {
        name: 'Second Author',
        role: 'author',
        preferredLanguage: 'it-IT'
      }
    })

    expect(savedDocument.document.title).toBe('Introduzione rivista')
    expect(savedDocument.document.body).toContain('Nuovo contenuto di prova')

    const reopenedProject = await service.openProject({
      projectPath: createdProject.projectPath
    })
    const binderNode = reopenedProject.binder.nodes.find((node) => node.documentId === 'doc-001')

    expect(binderNode?.title).toBe('Introduzione rivista')
    expect(reopenedProject.project.authors?.map((author) => author.name)).toContain('Second Author')

    const rawSavedDocument = await readFile(
      path.join(createdProject.projectPath, 'docs/chapters/introduzione.md'),
      'utf8'
    )
    expect(rawSavedDocument).toContain('lastModifiedByAuthorId')
    expect(rawSavedDocument).toContain('contributorAuthorIds')
  })

  it('diffs against committed history and restores a document from a checkpoint with tracked history', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(baseDirectory)
    const historyService = new HistoryService(fileSystem, new GitAdapter(), logger)
    const service = new ProjectService(fileSystem, noopIndexAdapter, logger, historyService)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'history-restore-demo',
      title: 'History Restore Demo',
      language: 'it-IT',
      template: 'blank',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      }
    })

    const firstDocument = createdProject.binder.nodes.find((node) => node.type === 'document' && node.documentId)
    expect(firstDocument?.documentId).toBeTruthy()

    await service.saveDocument({
      projectPath: createdProject.projectPath,
      documentId: firstDocument?.documentId ?? '',
      title: 'Storia documento',
      body: '# Storia documento\n\nVersione checkpoint.\n',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      },
      saveMode: 'manual'
    })

    await service.saveDocument({
      projectPath: createdProject.projectPath,
      documentId: firstDocument?.documentId ?? '',
      title: 'Storia documento',
      body: '# Storia documento\n\nVersione corrente non ancora committata.\n',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      },
      saveMode: 'autosave'
    })

    const diff = await service.diffDocument({
      projectPath: createdProject.projectPath,
      documentId: firstDocument?.documentId ?? '',
      baseline: { kind: 'previous-version' }
    })

    expect(diff.before.content).toContain('Versione checkpoint.')
    expect(diff.after.content).toContain('Versione corrente non ancora committata.')

    const repairedTimeline = await historyService.repairTimeline({
      projectPath: createdProject.projectPath
    })
    const checkpointEvent = repairedTimeline.snapshot.events.find((event) => event.kind === 'checkpoint')
    expect(checkpointEvent?.timelineEventId).toBeTruthy()

    const preview = await service.restoreDocument({
      projectPath: createdProject.projectPath,
      documentId: firstDocument?.documentId ?? '',
      sourceTimelineEventId: checkpointEvent?.timelineEventId ?? '',
      mode: 'preview',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      }
    })

    expect(preview.preview.before.content).toContain('Versione corrente non ancora committata.')
    expect(preview.preview.after.content).toContain('Versione checkpoint.')

    const restored = await service.restoreDocument({
      projectPath: createdProject.projectPath,
      documentId: firstDocument?.documentId ?? '',
      sourceTimelineEventId: checkpointEvent?.timelineEventId ?? '',
      mode: 'apply',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      }
    })

    expect(restored.restoredDocument?.body).toContain('Versione checkpoint.')
    expect(restored.restoreEvent?.kind).toBe('restore')

    await service.saveDocument({
      projectPath: createdProject.projectPath,
      documentId: firstDocument?.documentId ?? '',
      title: 'Storia documento',
      body: '# Storia documento\n\nBase locale.\n',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      },
      saveMode: 'autosave'
    })

    const selectionRestore = await service.restoreSelection({
      projectPath: createdProject.projectPath,
      documentId: firstDocument?.documentId ?? '',
      sourceTimelineEventId: checkpointEvent?.timelineEventId ?? '',
      sourceSelection: {
        startOffset: 20,
        endOffset: 39
      },
      insertAt: {
        kind: 'cursor',
        offset: '# Storia documento\n\nBase locale.\n'.length
      },
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      }
    })

    expect(selectionRestore.insertedText.length).toBeGreaterThan(0)
    expect(selectionRestore.restoredDocument.body).toContain(selectionRestore.insertedText)
  })

  it('creates writing hub notes as non-exportable support documents', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const service = new ProjectService(undefined, noopIndexAdapter)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'journal-support-hub',
      title: 'Journal Support Hub',
      language: 'it-IT',
      template: 'journal',
      authorProfile: {
        name: 'Fixture Author',
        role: 'author',
        preferredLanguage: 'it-IT'
      }
    })

    const notesDocument = await service.loadDocument({
      projectPath: createdProject.projectPath,
      documentId: 'journal-doc-notes'
    })

    expect(notesDocument.document.path).toContain('research/notes/')
    expect(notesDocument.document.frontmatter.includeInExport).toBe(false)
    expect(notesDocument.document.frontmatter.type).toBe('note')
    expect(notesDocument.document.body).toContain('- Punto chiave')
  })

  it('creates video script projects with project sheet, outline and script body', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const service = new ProjectService(undefined, noopIndexAdapter)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'video-script-demo',
      title: 'Launch Video',
      language: 'it-IT',
      template: 'videoScript',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      }
    })

    expect(createdProject.project.documentKind).toBe('videoScript')
    expect(createdProject.binder.nodes.find((node) => node.id === 'project-sheet')?.title).toBe('Scheda script video')

    const projectSheet = await service.loadDocument({
      projectPath: createdProject.projectPath,
      documentId: 'doc-000'
    })

    expect(projectSheet.document.frontmatter.type).toBe('project-sheet')
    expect(projectSheet.document.body).toContain('**Cliente / Brand:** [Inserisci cliente]')
    expect(projectSheet.document.body).toContain('## Obiettivo del video')
  })

  it('creates manual projects with operational sections aligned to technical documentation', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const service = new ProjectService(undefined, noopIndexAdapter)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'manual-demo',
      title: 'Manuale Operativo Pecie',
      language: 'it-IT',
      template: 'manual',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      }
    })

    expect(createdProject.project.documentKind).toBe('manual')
    expect(createdProject.binder.nodes.find((node) => node.id === 'project-sheet')?.title).toBe('Scheda manuale')
    expect(createdProject.binder.nodes.find((node) => node.id === 'procedures')?.title).toBe('Procedure operative')
    expect(createdProject.binder.nodes.find((node) => node.id === 'reference')?.path).toBe(
      'docs/appendices/riferimento-rapido.md'
    )

    const projectSheet = await service.loadDocument({
      projectPath: createdProject.projectPath,
      documentId: 'doc-000'
    })
    const procedures = await service.loadDocument({
      projectPath: createdProject.projectPath,
      documentId: 'doc-003'
    })

    expect(projectSheet.document.frontmatter.type).toBe('project-sheet')
    expect(projectSheet.document.body).toContain('**Audience primaria:** [Utenti finali, operatori, team tecnico, onboarding]')
    expect(projectSheet.document.body).toContain('## Obiettivo del manuale')
    expect(procedures.document.frontmatter.type).toBe('manual-procedures')
    expect(procedures.document.body).toContain('## Procedura passo-passo')
    expect(procedures.document.body).toContain('## Errori comuni e recovery')
  })

  it('creates screenplay projects with an editable title page and a ready scene scaffold', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const service = new ProjectService(undefined, noopIndexAdapter)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'screenplay-demo',
      title: 'La Citta e il Vento',
      language: 'it-IT',
      template: 'screenplay',
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      }
    })

    expect(createdProject.project.documentKind).toBe('screenplay')
    expect(createdProject.binder.nodes.find((node) => node.id === 'title-page')?.title).toBe(
      'Pagina titolo sceneggiatura'
    )

    const titlePage = await service.loadDocument({
      projectPath: createdProject.projectPath,
      documentId: 'doc-000'
    })
    const firstScene = await service.loadDocument({
      projectPath: createdProject.projectPath,
      documentId: 'doc-001'
    })

    expect(titlePage.document.frontmatter.type).toBe('title-page')
    expect(titlePage.document.body).toContain('**Scritto da:** Fixture Author')
    expect(titlePage.document.body).toContain('## Nota di sviluppo')
    expect(firstScene.document.frontmatter.type).toBe('screenplay-scene')
    expect(firstScene.document.body).toContain('## INT./EST. - LUOGO - TEMPO')
    expect(firstScene.document.body).toContain('## Dialoghi')
  })

  it('imports external attachments into the project and lists them for the writing hub UI', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const sourceDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-attachment-source-'))
    cleanupPaths.push(sourceDirectory)
    const sourceFilePath = path.join(sourceDirectory, 'brief.txt')
    await writeFile(sourceFilePath, 'attachment-content', 'utf8')

    const service = new ProjectService(undefined, noopIndexAdapter)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'article-attachments',
      title: 'Article Attachments',
      language: 'it-IT',
      template: 'article',
      authorProfile: {
        name: 'Fixture Author',
        role: 'author',
        preferredLanguage: 'it-IT'
      }
    })

    const importResponse = await service.importAttachments({
      projectPath: createdProject.projectPath,
      sourcePaths: [sourceFilePath]
    })

    expect(importResponse.imported).toHaveLength(1)
    expect(importResponse.imported[0]?.relativePath).toContain('assets/attachments/')
    expect(importResponse.skipped).toHaveLength(0)

    const listResponse = await service.listAttachments({
      projectPath: createdProject.projectPath
    })

    expect(listResponse.items).toHaveLength(1)
    expect(listResponse.items[0]?.name).toBe('brief.txt')
    expect(listResponse.attachmentsDirectoryPath).toContain('assets/attachments')
  })

  it('adds, moves and deletes binder nodes', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const service = new ProjectService(undefined, noopIndexAdapter)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'thesis-binder',
      title: 'Binder Demo',
      language: 'it-IT',
      template: 'thesis',
      authorProfile: {
        name: 'Fixture Author',
        role: 'student',
        preferredLanguage: 'it-IT'
      }
    })

    const folderResult = await service.addBinderNode({
      projectPath: createdProject.projectPath,
      parentId: 'root',
      nodeType: 'folder',
      title: 'Appendici'
    })

    const documentResult = await service.addBinderNode({
      projectPath: createdProject.projectPath,
      parentId: folderResult.createdNode.id,
      nodeType: 'document',
      title: 'Appendice A'
    })

    expect(folderResult.binder.nodes.find((node) => node.id === folderResult.createdNode.id)?.title).toBe('Appendici')
    expect(documentResult.createdNode.documentId).toBeTruthy()

    const movedBinder = await service.moveBinderNode({
      projectPath: createdProject.projectPath,
      nodeId: documentResult.createdNode.id,
      targetParentId: 'manuscript',
      targetIndex: 0
    })

    expect(movedBinder.binder.nodes.find((node) => node.id === 'manuscript')?.children?.[0]).toBe(documentResult.createdNode.id)

    const deletedBinder = await service.deleteBinderNode({
      projectPath: createdProject.projectPath,
      nodeId: folderResult.createdNode.id
    })

    expect(deletedBinder.deletedNodeIds).toContain(folderResult.createdNode.id)
  })

  it('archives, restores and deletes a project directory', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const service = new ProjectService(undefined, noopIndexAdapter)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'thesis-archive',
      title: 'Archive Demo',
      language: 'it-IT',
      template: 'thesis',
      authorProfile: {
        name: 'Fixture Author',
        role: 'student',
        preferredLanguage: 'it-IT'
      }
    })

    const archivedProject = await service.archiveProject({
      projectPath: createdProject.projectPath,
      workspaceDirectory: baseDirectory
    })

    expect(archivedProject.projectPath).toContain(`${path.sep}Archive${path.sep}`)

    const restoredProject = await service.restoreProject({
      projectPath: archivedProject.projectPath,
      workspaceDirectory: baseDirectory
    })

    expect(restoredProject.projectPath).not.toContain(`${path.sep}Archive${path.sep}`)

    const deletedProject = await service.deleteProject({
      projectPath: restoredProject.projectPath
    })

    expect(deletedProject.deleted).toBe(true)
  })

  it('absorbs a support note into the target document at the requested offset and deletes the source node', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const service = new ProjectService(undefined, noopIndexAdapter)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'thesis-absorb',
      title: 'Absorb Demo',
      language: 'it-IT',
      template: 'thesis',
      authorProfile: {
        name: 'Fixture Author',
        role: 'student',
        preferredLanguage: 'it-IT'
      }
    })

    const noteNode = createdProject.binder.nodes.find((node) => node.path?.endsWith('note-di-lavoro.md'))
    expect(noteNode?.documentId).toBeTruthy()

    await service.saveDocument({
      projectPath: createdProject.projectPath,
      documentId: 'doc-001',
      title: 'Introduzione',
      body: '# Introduzione\n\nPrima parte.\n\nSeconda parte.',
      authorProfile: {
        name: 'Fixture Author',
        role: 'student',
        preferredLanguage: 'it-IT'
      }
    })

    if (!noteNode?.documentId) {
      throw new Error('Support note not found in thesis fixture.')
    }

    await service.saveDocument({
      projectPath: createdProject.projectPath,
      documentId: noteNode.documentId,
      title: noteNode.title,
      body: '## Nota trasferita\n\nContenuto supporto.',
      authorProfile: {
        name: 'Fixture Author',
        role: 'student',
        preferredLanguage: 'it-IT'
      }
    })

    const absorbResponse = await service.absorbBinderNode({
      projectPath: createdProject.projectPath,
      sourceNodeId: noteNode.id,
      targetDocumentId: 'doc-001',
      insertion: 'offset',
      offset: '# Introduzione\n\nPrima parte.'.length
    })

    expect(absorbResponse.deletedNodeIds).toContain(noteNode.id)
    expect(absorbResponse.targetDocument.body).toContain('## Nota trasferita')
    expect(absorbResponse.targetDocument.body.indexOf('## Nota trasferita')).toBeGreaterThan(
      absorbResponse.targetDocument.body.indexOf('Prima parte.')
    )
    expect(absorbResponse.targetDocument.body.indexOf('## Nota trasferita')).toBeLessThan(
      absorbResponse.targetDocument.body.indexOf('Seconda parte.')
    )

    const reopened = await service.openProject({ projectPath: createdProject.projectPath })
    expect(reopened.binder.nodes.find((node) => node.id === noteNode.id)).toBeUndefined()
  })

  it('builds read-only previews for text and rtf attachments', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const sourceDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-attachment-source-'))
    cleanupPaths.push(sourceDirectory)

    const txtSourcePath = path.join(sourceDirectory, 'brief.txt')
    const rtfSourcePath = path.join(sourceDirectory, 'notes.rtf')
    await writeFile(txtSourcePath, 'Citazione utile dal brief.', 'utf8')
    await writeFile(rtfSourcePath, '{\\rtf1\\ansi Questo \\b e\\b0  un test\\par Seconda riga}', 'utf8')

    const service = new ProjectService(undefined, noopIndexAdapter)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'preview-demo',
      title: 'Preview Demo',
      language: 'it-IT',
      template: 'article',
      authorProfile: {
        name: 'Fixture Author',
        role: 'author',
        preferredLanguage: 'it-IT'
      }
    })

    const importResponse = await service.importAttachments({
      projectPath: createdProject.projectPath,
      sourcePaths: [txtSourcePath, rtfSourcePath]
    })

    const txtPreview = await service.getAttachmentPreview({
      projectPath: createdProject.projectPath,
      relativePath: importResponse.imported[0]!.relativePath
    })
    const rtfPreview = await service.getAttachmentPreview({
      projectPath: createdProject.projectPath,
      relativePath: importResponse.imported[1]!.relativePath
    })

    expect(txtPreview.preview.kind).toBe('text')
    expect(txtPreview.preview.textContent).toContain('Citazione utile')
    expect(rtfPreview.preview.kind).toBe('text')
    expect(rtfPreview.preview.textContent).toContain('Questo')
    expect(rtfPreview.preview.textContent).toContain('Seconda riga')
  })

  it('builds read-only previews for valid pdf and docx attachments', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const sourceDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-attachment-source-'))
    cleanupPaths.push(sourceDirectory)

    const pdfSourcePath = path.join(sourceDirectory, 'sample.pdf')
    const docxSourcePath = path.join(sourceDirectory, 'sample.docx')
    await writeFile(pdfSourcePath, makeMinimalPdf('Premium PDF Preview'))
    await writeFile(docxSourcePath, makeMinimalDocx('Premium DOCX Preview'))

    const service = new ProjectService(undefined, createMemoryIndexAdapter())
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'preview-binary-demo',
      title: 'Preview Binary Demo',
      language: 'it-IT',
      template: 'article',
      authorProfile: {
        name: 'Fixture Author',
        role: 'author',
        preferredLanguage: 'it-IT'
      }
    })

    const importResponse = await service.importAttachments({
      projectPath: createdProject.projectPath,
      sourcePaths: [pdfSourcePath, docxSourcePath]
    })

    const pdfPreview = await service.getAttachmentPreview({
      projectPath: createdProject.projectPath,
      relativePath: importResponse.imported[0]!.relativePath
    })
    const docxPreview = await service.getAttachmentPreview({
      projectPath: createdProject.projectPath,
      relativePath: importResponse.imported[1]!.relativePath
    })

    expect(pdfPreview.preview.kind).toBe('pdf')
    expect(pdfPreview.preview.textContent).toContain('Premium PDF Preview')
    expect(docxPreview.preview.kind).toBe('html')
    expect(docxPreview.preview.textContent).toContain('Premium DOCX Preview')
  })

  it('returns grouped global search results for node titles, markdown content, and attachments', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const sourceDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-attachment-source-'))
    cleanupPaths.push(sourceDirectory)
    const txtSourcePath = path.join(sourceDirectory, 'archive-note.txt')
    await writeFile(txtSourcePath, 'Nebula archive reference and comparison fragment.', 'utf8')

    const service = new ProjectService(undefined, createMemoryIndexAdapter())
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'search-demo',
      title: 'Search Demo',
      language: 'it-IT',
      template: 'article',
      authorProfile: {
        name: 'Fixture Author',
        role: 'author',
        preferredLanguage: 'it-IT'
      }
    })

    await service.saveDocument({
      projectPath: createdProject.projectPath,
      documentId: 'doc-000',
      title: 'Nebula Overview',
      body: '# Nebula Overview\n\nThis manuscript contains a nebula fragment.',
      authorProfile: {
        name: 'Fixture Author',
        role: 'author',
        preferredLanguage: 'it-IT'
      }
    })

    await service.importAttachments({
      projectPath: createdProject.projectPath,
      sourcePaths: [txtSourcePath]
    })

    const response = await service.searchDocuments({
      projectPath: createdProject.projectPath,
      query: 'nebula',
      limit: 8
    })

    expect(response.results.nodes.some((entry) => entry.title === 'Nebula Overview')).toBe(true)
    expect(response.results.content.some((entry) => entry.snippet.toLowerCase().includes('nebula'))).toBe(true)
    expect(response.results.attachments.some((entry) => entry.name === 'archive-note.txt')).toBe(true)
  })

  it('keeps read-only parity for export text formats plus epub and odt', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-project-service-'))
    cleanupPaths.push(baseDirectory)

    const sourceDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-attachment-source-'))
    cleanupPaths.push(sourceDirectory)

    const fixtures = [
      ['sample.md', '# Heading\n\nMarkdown body'],
      ['sample.txt', 'Plain text body'],
      ['sample.tex', '\\section{Intro}\nLatex body'],
      ['sample.latex', '\\textbf{Latex alias}'],
      ['sample.jats', '<article><body>JATS body</body></article>'],
      ['sample.tei', '<TEI><text>TEI body</text></TEI>']
    ] as const

    for (const [fileName, content] of fixtures) {
      await writeFile(path.join(sourceDirectory, fileName), content, 'utf8')
    }
    await writeFile(path.join(sourceDirectory, 'sample.epub'), 'placeholder-epub', 'utf8')
    await writeFile(
      path.join(sourceDirectory, 'sample.odt'),
      makeStoredZip('content.xml', '<office:text><text:p>ODT body</text:p></office:text>')
    )

    const service = new ProjectService(undefined, noopIndexAdapter)
    const createdProject = await service.createProject({
      directory: baseDirectory,
      projectName: 'format-parity',
      title: 'Format Parity',
      language: 'it-IT',
      template: 'article',
      authorProfile: {
        name: 'Fixture Author',
        role: 'author',
        preferredLanguage: 'it-IT'
      }
    })

    const importResponse = await service.importAttachments({
      projectPath: createdProject.projectPath,
      sourcePaths: [
        ...fixtures.map(([fileName]) => path.join(sourceDirectory, fileName)),
        path.join(sourceDirectory, 'sample.epub'),
        path.join(sourceDirectory, 'sample.odt')
      ]
    })

    const previews = await Promise.all(
      importResponse.imported.map((entry) =>
        service.getAttachmentPreview({
          projectPath: createdProject.projectPath,
          relativePath: entry.relativePath
        })
      )
    )

    const previewByName = new Map(previews.map((entry) => [entry.attachment.name, entry.preview]))
    expect(previewByName.get('sample.md')?.kind).toBe('text')
    expect(previewByName.get('sample.txt')?.kind).toBe('text')
    expect(previewByName.get('sample.tex')?.kind).toBe('text')
    expect(previewByName.get('sample.latex')?.kind).toBe('text')
    expect(previewByName.get('sample.jats')?.kind).toBe('text')
    expect(previewByName.get('sample.tei')?.kind).toBe('text')
    expect(previewByName.get('sample.epub')?.kind).toBe('epub')
    expect(previewByName.get('sample.odt')?.kind).toBe('html')
    expect(previewByName.get('sample.odt')?.textContent).toContain('ODT body')
  })
})
