import { access, mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'
import mammoth from 'mammoth'

import {
  type AbsorbBinderNodeRequest,
  type AbsorbBinderNodeResponse,
  binderSchema,
  citationLibrarySchema,
  citationProfileSchema,
  exportProfileSchema,
  pageBreakMapSchema,
  paginatedPreviewSchema,
  previewProfileBindingSchema,
  type CreateProjectRequest,
  type CreateProjectResponse,
  type DiffDocumentRequest,
  type DiffDocumentResponse,
  type DeleteBinderNodeRequest,
  type DeleteBinderNodeResponse,
  type DeleteProjectRequest,
  type DeleteProjectResponse,
  type AttachmentRecord,
  type AttachmentPreviewRequest,
  type AttachmentPreviewResponse,
  type ImportAttachmentsRequest,
  type ImportAttachmentsResponse,
  type ListAttachmentsRequest,
  type ListAttachmentsResponse,
  type DocumentRecord,
  type ImportImageAssetRequest,
  type ImportImageAssetResponse,
  type LoadDocumentRequest,
  type LoadDocumentResponse,
  manifestSchema,
  type MediaAssetRecord,
  type MoveBinderNodeRequest,
  type MoveBinderNodeResponse,
  type OpenProjectRequest,
  type OpenProjectResponse,
  type ProjectManifest,
  type ProjectMetadata,
  projectSchema,
  pdfLibrarySchema,
  researchLinkMapSchema,
  researchNoteSchema,
  sharePackageManifestSchema,
  type ArchiveProjectRequest,
  type ArchiveProjectResponse,
  type AddBinderNodeRequest,
  type AddBinderNodeResponse,
  type RestoreProjectRequest,
  type RestoreProjectResponse,
  type RestoreDocumentRequest,
  type RestoreDocumentResponse,
  type RestoreSelectionRequest,
  type RestoreSelectionResponse,
  type SaveDocumentRequest,
  type SaveDocumentResponse,
  type SearchDocumentsRequest,
  type SearchDocumentsResponse,
  schemaRegistry,
  type BinderNode,
  type LogEventRequest,
  validateBinderDocument,
  validateManifest,
  validateProjectMetadata
} from '@pecie/schemas'
import {
  addBinderNode,
  createProjectMetadata,
  deleteBinderNode,
  defaultExportProfileAssets,
  getDefaultExportProfiles,
  moveBinderNode,
  projectTemplates,
  type ProjectTemplateDocumentBlueprint,
  type ProjectTemplateId
} from '@pecie/domain'

import { ProjectFileSystem } from '../fs/project-file-system'
import { AppLoggerService } from '../logging/app-logger-service'
import { applyAuthorshipStats, normalizeProjectMetadata, syncProjectContributor } from './project-authorship'
import {
  initializeDerivedIndexDatabase,
  removeDerivedIndexAttachment,
  removeDerivedIndexDocument,
  searchDerivedIndex,
  upsertDerivedIndexAttachment,
  upsertDerivedIndexDocument
} from '../sqlite/index-database'
import { HistoryService } from '../history/history-service'
import { GitAdapter } from '../history/git-adapter'

const execFileAsync = promisify(execFile)

const PROJECT_DIRECTORIES = [
  'docs/chapters',
  'docs/frontmatter',
  'docs/appendices',
  'docs/fragments',
  'research/notes',
  'research/sources',
  'research/discarded',
  'research/supervision',
  'assets/images',
  'assets/pdf',
  'assets/tables',
  'assets/media',
  'assets/attachments',
  'citations/csl',
  'citations/styles',
  'citations/profiles',
  'history/snapshots',
  'history/exchange',
  'exports/profiles',
  'exports/templates',
  'exports/themes',
  'exports/out',
  'tutorials/local',
  'cache/search',
  'cache/thumbnails',
  'cache/derived',
  'cache/preview/fast',
  'cache/preview/accurate',
  'cache/preview/page-breaks',
  'cache/preview/export-step',
  'logs/local-audit',
  'schemas'
]

const PROJECT_GITIGNORE_ENTRIES = [
  'cache/index.sqlite*',
  'cache/search/',
  'cache/thumbnails/',
  'cache/derived/',
  'cache/preview/',
  'exports/out/',
  'logs/local-audit/*.log'
]

const APP_MIN_VERSION = '0.1.0'
const ATTACHMENTS_RELATIVE_DIRECTORY = 'assets/attachments'
const MAX_ATTACHMENT_SIZE_BYTES = 500 * 1024 * 1024
const MEDIA_RELATIVE_DIRECTORY = 'assets/media'
const MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024
const ALLOWED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])
const EXTENSION_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif'
}

type ProjectIndexAdapter = {
  initialize: (databasePath: string) => void
  upsert: typeof upsertDerivedIndexDocument
  upsertAttachment: typeof upsertDerivedIndexAttachment
  removeAttachment: typeof removeDerivedIndexAttachment
  remove: typeof removeDerivedIndexDocument
  search: typeof searchDerivedIndex
}

const defaultIndexAdapter: ProjectIndexAdapter = {
  initialize: initializeDerivedIndexDatabase,
  upsert: upsertDerivedIndexDocument,
  upsertAttachment: upsertDerivedIndexAttachment,
  removeAttachment: removeDerivedIndexAttachment,
  remove: removeDerivedIndexDocument,
  search: searchDerivedIndex
}

export class ProjectService {
  private readonly fileSystem: ProjectFileSystem
  private readonly indexAdapter: ProjectIndexAdapter
  private readonly logger?: AppLoggerService
  private readonly historyService: HistoryService

  public constructor(
    fileSystem: ProjectFileSystem = new ProjectFileSystem(),
    indexAdapter: ProjectIndexAdapter = defaultIndexAdapter,
    logger?: AppLoggerService,
    historyService?: HistoryService
  ) {
    this.fileSystem = fileSystem
    this.indexAdapter = indexAdapter
    this.logger = logger
    this.historyService = historyService ?? new HistoryService(fileSystem, new GitAdapter(), logger)
  }

  public async createProject(input: CreateProjectRequest): Promise<CreateProjectResponse> {
    const projectPath = path.join(input.directory, `${input.projectName}.pe`)
    const template = projectTemplates[input.template]
    const createdAt = new Date().toISOString()
    const manifest: ProjectManifest = {
      format: 'pecie-project',
      formatVersion: '1.0.0',
      projectId: `${input.projectName}-${createdAt}`,
      title: input.title,
      createdAt,
      appMinVersion: APP_MIN_VERSION,
      historyMode: 'git-local',
      contentModel: 'markdown-frontmatter',
      cacheModel: 'sqlite-derived',
      defaultExportProfile: template.exportProfile,
      language: input.language,
      privacyMode: 'local-first',
      embeddedHistory: true,
      a11yProfile: 'wcag22-aa',
      schemaUris: schemaRegistry
    }
    const project = createProjectMetadata(input, createdAt)
    const binder = template.binder

    this.fileSystem.assertProjectPath(projectPath)
    const projectAlreadyExists = await access(projectPath)
      .then(() => true)
      .catch(() => false)
    if (projectAlreadyExists) {
      throw new Error(`Esiste gia un progetto in ${projectPath}`)
    }

    await this.ensureProjectDirectories(projectPath)
    await this.fileSystem.writeJson(projectPath, 'manifest.json', manifest)
    await this.fileSystem.writeJson(projectPath, 'project.json', project)
    await this.fileSystem.writeJson(projectPath, 'binder.json', binder)
    await this.fileSystem.writeJson(projectPath, schemaRegistry.manifest, manifestSchema)
    await this.fileSystem.writeJson(projectPath, schemaRegistry.project, projectSchema)
    await this.fileSystem.writeJson(projectPath, schemaRegistry.binder, binderSchema)
    await this.fileSystem.writeJson(projectPath, schemaRegistry.exportProfile, exportProfileSchema)
    await this.fileSystem.writeJson(projectPath, schemaRegistry.previewProfileBinding, previewProfileBindingSchema)
    await this.fileSystem.writeJson(projectPath, schemaRegistry.paginatedPreview, paginatedPreviewSchema)
    await this.fileSystem.writeJson(projectPath, schemaRegistry.pageBreakMap, pageBreakMapSchema)
    await this.fileSystem.writeJson(projectPath, schemaRegistry.citationProfile, citationProfileSchema)
    await this.fileSystem.writeJson(projectPath, schemaRegistry.citationLibrary, citationLibrarySchema)
    await this.fileSystem.writeJson(projectPath, schemaRegistry.researchNote, researchNoteSchema)
    await this.fileSystem.writeJson(projectPath, schemaRegistry.researchLinkMap, researchLinkMapSchema)
    await this.fileSystem.writeJson(projectPath, schemaRegistry.pdfLibrary, pdfLibrarySchema)
    await this.fileSystem.writeJson(projectPath, schemaRegistry.sharePackageManifest, sharePackageManifestSchema)
    await this.fileSystem.writeJson(projectPath, 'workspace.json', {
      theme: 'system',
      editor: {
        focusMode: false,
        typewriterMode: false
      }
    })
    await this.fileSystem.writeJson(projectPath, 'tutorials/progress.json', {
      completedTutorialIds: []
    })
    await this.fileSystem.writeJson(projectPath, 'history/timeline.json', {
      version: '1.0.0',
      generatedAt: createdAt,
      events: [],
      groups: [],
      integrityReport: {
        totalCommits: 0,
        eventsOk: 0,
        eventsRepaired: 0,
        eventsMissingCommit: 0,
        eventsMissingMetadata: 0,
        warnings: []
      }
    })
    await this.fileSystem.writeJson(projectPath, 'history/milestones.json', {
      version: '1.0.0',
      generatedAt: createdAt,
      milestones: []
    })
    await this.fileSystem.writeJson(projectPath, 'research/pdf-library.json', {
      version: '1.0.0',
      generatedAt: createdAt,
      items: []
    })
    await this.fileSystem.writeJson(projectPath, 'research/link-map.json', {
      version: '1.0.0',
      generatedAt: createdAt,
      links: []
    })
    await this.writeProjectGitignore(projectPath)
    await this.fileSystem.writeText(projectPath, 'citations/references.bib', '')
    await this.fileSystem.writeJson(projectPath, 'citations/profiles/default.json', {
      id: 'default',
      schemaVersion: 1,
      label: 'Default citation profile',
      bibliographySources: ['citations/references.bib'],
      citationStyle: 'citations/csl/apa.csl',
      locale: input.language,
      linkCitations: false,
      suppressBibliography: false,
      bibliographyTitle: {
        'it-IT': 'Bibliografia',
        'en-US': 'References'
      }
    })
    await this.fileSystem.writeText(projectPath, 'citations/csl/apa.csl', '')
    await this.ensureDefaultExportProfiles(projectPath, input.template)

    for (const node of binder.nodes) {
      if (node.type === 'document' && node.path) {
        const initialBlueprint = template.initialDocuments?.[node.id]
        const initialTemplate = initialBlueprint?.template ?? (node.path.startsWith('research/notes/') ? 'notes' : 'blank')
        const initialDocument = this.createInitialDocument(
          node,
          createdAt,
          initialTemplate,
          project.authors?.[0]?.id,
          initialBlueprint,
          {
            projectTitle: input.title,
            language: input.language,
            authorProfile: input.authorProfile
          }
        )
        initialDocument.frontmatter.referencesProfile = template.exportProfile
        await this.fileSystem.writeText(projectPath, node.path, this.serializeDocument(initialDocument))
      }
    }

    const indexPath = this.getIndexPath(projectPath)
    this.indexAdapter.initialize(indexPath)
    for (const node of binder.nodes) {
      if (node.type !== 'document' || !node.path) {
        continue
      }

      const rawDocument = await this.fileSystem.readText(projectPath, node.path)
      const parsedDocument = this.parseDocument(node, rawDocument)
      this.indexAdapter.upsert(indexPath, {
        nodeId: node.id,
        documentId: parsedDocument.documentId,
        path: parsedDocument.path,
        title: parsedDocument.title,
        body: parsedDocument.body,
        updatedAt: createdAt
      })
    }
    const projectWithStats = await this.refreshProjectAuthorship(projectPath, binder, project)
    await this.fileSystem.writeJson(projectPath, 'project.json', projectWithStats)
    await this.initializeGitRepository(projectPath)
    await this.historyService.initialize(projectPath)
    await this.log({
      level: 'info',
      category: 'project',
      event: 'project-created',
      message: 'Project created successfully.',
      context: {
        projectPath,
        template: input.template,
        language: input.language
      }
    })

    return { projectPath, manifest, project: projectWithStats, binder }
  }

  public async openProject(input: OpenProjectRequest): Promise<OpenProjectResponse> {
    this.fileSystem.assertProjectPath(input.projectPath)

    const manifest = validateManifest(await this.fileSystem.readJson(input.projectPath, 'manifest.json'))
    const binder = validateBinderDocument(await this.fileSystem.readJson(input.projectPath, 'binder.json'))
    const rawProject = validateProjectMetadata(await this.fileSystem.readJson(input.projectPath, 'project.json'))
    await this.ensureProjectDirectories(input.projectPath)
    await this.ensureProjectGitignore(input.projectPath)
    await this.ensureDefaultExportProfiles(input.projectPath, rawProject.documentKind as ProjectTemplateId)
    await this.rebuildDerivedIndex(input.projectPath, binder)
    const project = await this.refreshProjectAuthorship(
      input.projectPath,
      binder,
      rawProject
    )
    await this.log({
      level: 'info',
      category: 'project',
      event: 'project-opened',
      message: 'Project opened successfully.',
      context: {
        projectPath: input.projectPath
      }
    })

    return {
      projectPath: input.projectPath,
      manifest,
      project,
      binder
    }
  }

  private async ensureProjectDirectories(projectPath: string): Promise<void> {
    await Promise.all(PROJECT_DIRECTORIES.map((directory) => this.fileSystem.ensureDir(projectPath, directory)))
  }

  private async writeProjectGitignore(projectPath: string): Promise<void> {
    await this.fileSystem.writeText(projectPath, '.gitignore', `${PROJECT_GITIGNORE_ENTRIES.join('\n')}\n`)
  }

  private async ensureProjectGitignore(projectPath: string): Promise<void> {
    const current = await this.fileSystem.readText(projectPath, '.gitignore').catch(() => '')
    const existing = new Set(
      current
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    )
    const missing = PROJECT_GITIGNORE_ENTRIES.filter((entry) => !existing.has(entry))

    if (missing.length === 0) {
      return
    }

    const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : ''
    await this.fileSystem.writeText(projectPath, '.gitignore', `${current}${separator}${missing.join('\n')}\n`)
  }

  public async loadDocument(input: LoadDocumentRequest): Promise<LoadDocumentResponse> {
    const binder = validateBinderDocument(await this.fileSystem.readJson(input.projectPath, 'binder.json'))
    const node = this.findDocumentNode(binder.nodes, input.documentId)

    const rawDocument = await this.fileSystem.readText(input.projectPath, node.path ?? '')
    await this.log({
      level: 'info',
      category: 'project',
      event: 'document-loaded',
      message: 'Document loaded successfully.',
      context: {
        projectPath: input.projectPath,
        documentId: input.documentId
      }
    })
    return {
      document: this.parseDocument(node, rawDocument)
    }
  }

  public async saveDocument(input: SaveDocumentRequest): Promise<SaveDocumentResponse> {
    const binder = validateBinderDocument(await this.fileSystem.readJson(input.projectPath, 'binder.json'))
    const node = this.findDocumentNode(binder.nodes, input.documentId)
    const project = normalizeProjectMetadata(
      validateProjectMetadata(await this.fileSystem.readJson(input.projectPath, 'project.json')),
      new Date().toISOString()
    )
    const currentDocument = this.parseDocument(
      node,
      await this.fileSystem.readText(input.projectPath, node.path ?? '')
    )

    const savedAt = new Date().toISOString()
    const { contributor, project: nextProject } = syncProjectContributor(project, input.authorProfile, savedAt)
    const primaryAuthorId =
      typeof currentDocument.frontmatter.authorId === 'string'
        ? currentDocument.frontmatter.authorId
        : project.authors[0]?.id ?? contributor.id
    const contributorAuthorIds = Array.from(
      new Set([
        ...(Array.isArray(currentDocument.frontmatter.contributorAuthorIds)
          ? currentDocument.frontmatter.contributorAuthorIds.filter((value): value is string => typeof value === 'string')
          : []),
        primaryAuthorId,
        contributor.id
      ])
    )
    const authoredBlocks = this.mergeAuthoredBlocks(currentDocument, input.body, contributor.id, primaryAuthorId)
    const nextDocument: DocumentRecord = {
      ...currentDocument,
      title: input.title.trim() || currentDocument.title,
      body: input.body,
      frontmatter: {
        ...currentDocument.frontmatter,
        title: input.title.trim() || currentDocument.title,
        updatedAt: savedAt,
        authorId: primaryAuthorId,
        contributorAuthorIds,
        lastModifiedByAuthorId: contributor.id,
        authoredBlocksJson: JSON.stringify(authoredBlocks)
      }
    }

    await this.fileSystem.writeText(input.projectPath, node.path ?? '', this.serializeDocument(nextDocument))

    const updatedNodes = binder.nodes.map((candidate) =>
      candidate.documentId === input.documentId ? { ...candidate, title: nextDocument.title } : candidate
    )
    await this.fileSystem.writeJson(input.projectPath, 'binder.json', {
      ...binder,
      nodes: updatedNodes
    })
    this.indexAdapter.upsert(this.getIndexPath(input.projectPath), {
      nodeId: node.id,
      documentId: nextDocument.documentId,
      path: nextDocument.path,
      title: nextDocument.title,
      body: nextDocument.body,
      updatedAt: savedAt
    })
    const refreshedProject = await this.refreshProjectAuthorship(input.projectPath, { ...binder, nodes: updatedNodes }, nextProject)
    await this.fileSystem.writeJson(input.projectPath, 'project.json', refreshedProject)
    await this.log({
      level: 'info',
      category: 'project',
      event: 'document-saved',
      message: 'Document saved successfully.',
      context: {
        projectPath: input.projectPath,
        documentId: input.documentId,
        title: nextDocument.title
      }
    })

    if ((input.saveMode ?? 'manual') === 'manual') {
      await this.historyService.createCheckpoint({
        projectPath: input.projectPath,
        reason: 'manual-save',
        documentId: input.documentId,
        documentTitle: nextDocument.title,
        binderPath: this.buildBinderPath(updatedNodes, node.id),
        authorProfile: input.authorProfile
      })
    }

    return {
      document: nextDocument,
      savedAt
    }
  }

  public async diffDocument(input: DiffDocumentRequest): Promise<DiffDocumentResponse> {
    const binder = validateBinderDocument(await this.fileSystem.readJson(input.projectPath, 'binder.json'))
    const node = this.findDocumentNode(binder.nodes, input.documentId)
    const currentRawDocument = await this.fileSystem.readText(input.projectPath, node.path ?? '')
    return this.historyService.diffDocument({
      projectPath: input.projectPath,
      relativePath: node.path ?? '',
      currentContent: this.parseDocument(node, currentRawDocument).body,
      baseline:
        input.baseline.kind === 'previous-version'
          ? { kind: 'previous-version' }
          : { kind: 'timeline-event', timelineEventId: input.baseline.timelineEventId }
    })
  }

  public async restoreDocument(input: RestoreDocumentRequest): Promise<RestoreDocumentResponse> {
    const binder = validateBinderDocument(await this.fileSystem.readJson(input.projectPath, 'binder.json'))
    const node = this.findDocumentNode(binder.nodes, input.documentId)
    const currentRawDocument = await this.fileSystem.readText(input.projectPath, node.path ?? '')
    const preview = await this.historyService.previewRestoreDocument({
      projectPath: input.projectPath,
      relativePath: node.path ?? '',
      currentContent: this.parseDocument(node, currentRawDocument).body,
      sourceTimelineEventId: input.sourceTimelineEventId
    })

    if (input.mode === 'preview') {
      return preview
    }

    const restoredRawDocument = await this.historyService.readHistoricalDocument({
      projectPath: input.projectPath,
      relativePath: node.path ?? '',
      sourceTimelineEventId: input.sourceTimelineEventId
    })
    await this.fileSystem.writeText(input.projectPath, node.path ?? '', restoredRawDocument)
    const restoredDocument = await this.synchronizeDocumentState(input.projectPath, input.documentId, new Date().toISOString())
    const restoreEvent = await this.historyService.commitRestore({
      projectPath: input.projectPath,
      sourceTimelineEventId: input.sourceTimelineEventId,
      authorProfile: input.authorProfile
    })

    return {
      preview: preview.preview,
      restoredDocument,
      restoreEvent
    }
  }

  public async restoreSelection(input: RestoreSelectionRequest): Promise<RestoreSelectionResponse> {
    const binder = validateBinderDocument(await this.fileSystem.readJson(input.projectPath, 'binder.json'))
    const node = this.findDocumentNode(binder.nodes, input.documentId)
    const currentRawDocument = await this.fileSystem.readText(input.projectPath, node.path ?? '')
    const currentDocument = this.parseDocument(node, currentRawDocument)
    const historicalBody = await this.historyService.readHistoricalBodySelection({
      projectPath: input.projectPath,
      relativePath: node.path ?? '',
      sourceTimelineEventId: input.sourceTimelineEventId,
      startOffset: input.sourceSelection.startOffset,
      endOffset: input.sourceSelection.endOffset
    })

    const nextBody =
      input.insertAt.kind === 'cursor'
        ? `${currentDocument.body.slice(0, input.insertAt.offset)}${historicalBody}${currentDocument.body.slice(input.insertAt.offset)}`
        : `${currentDocument.body.slice(0, input.insertAt.startOffset)}${historicalBody}${currentDocument.body.slice(input.insertAt.endOffset)}`

    const restoredDocumentRecord: DocumentRecord = {
      ...currentDocument,
      body: nextBody,
      frontmatter: {
        ...currentDocument.frontmatter,
        updatedAt: new Date().toISOString()
      }
    }
    await this.fileSystem.writeText(input.projectPath, node.path ?? '', this.serializeDocument(restoredDocumentRecord))
    const restoredDocument = await this.synchronizeDocumentState(input.projectPath, input.documentId, new Date().toISOString())
    const restoreEvent = await this.historyService.commitRestore({
      projectPath: input.projectPath,
      sourceTimelineEventId: input.sourceTimelineEventId,
      authorProfile: input.authorProfile
    })

    return {
      restoredDocument,
      insertedText: historicalBody,
      restoreEvent
    }
  }

  public async addBinderNode(input: AddBinderNodeRequest): Promise<AddBinderNodeResponse> {
    const binder = validateBinderDocument(await this.fileSystem.readJson(input.projectPath, 'binder.json'))
    const parentNode = this.findNode(binder.nodes, input.parentId)

    if (parentNode.type !== 'folder') {
      throw new Error('Il nuovo nodo puo essere creato solo dentro una cartella.')
    }

    const createdAt = new Date().toISOString()
    const title = input.title?.trim() || (input.nodeType === 'folder' ? 'Nuova cartella' : 'Nuovo documento')
    const uniqueSuffix = createdAt.replace(/[^0-9]/g, '').slice(-10)
    const nodeId = `${input.nodeType}-${uniqueSuffix}`
    const createdNode: BinderNode =
      input.nodeType === 'folder'
        ? {
            id: nodeId,
            type: 'folder',
            title,
            description: input.description?.trim() || undefined,
            children: []
          }
        : {
            id: nodeId,
            type: 'document',
            title,
            description: input.description?.trim() || undefined,
            documentId: `doc-${uniqueSuffix}`,
            path: `docs/fragments/${this.slugify(title) || 'nuovo-documento'}-${uniqueSuffix}.md`
          }

    const nextBinder = addBinderNode(binder, input.parentId, createdNode, input.targetIndex)
    await this.fileSystem.writeJson(input.projectPath, 'binder.json', nextBinder)

    if (createdNode.type === 'document' && createdNode.path) {
      const document = input.duplicateFromDocumentId
        ? await this.createDuplicatedDocument(input.projectPath, binder.nodes, createdNode, createdAt, input.duplicateFromDocumentId)
        : this.createInitialDocument(createdNode, createdAt, input.template ?? 'blank')
      await this.fileSystem.writeText(input.projectPath, createdNode.path, this.serializeDocument(document))
      this.indexAdapter.upsert(this.getIndexPath(input.projectPath), {
        nodeId: createdNode.id,
        documentId: document.documentId,
        path: document.path,
        title: document.title,
        body: document.body,
        updatedAt: createdAt
      })
    }

    await this.log({
      level: 'info',
      category: 'project',
      event: 'binder-node-added',
      message: 'Binder node added successfully.',
      context: {
        projectPath: input.projectPath,
        parentId: input.parentId,
        nodeId: createdNode.id,
        nodeType: createdNode.type
      }
    })

    return {
      binder: nextBinder,
      createdNode
    }
  }

  public async moveBinderNode(input: MoveBinderNodeRequest): Promise<MoveBinderNodeResponse> {
    const binder = validateBinderDocument(await this.fileSystem.readJson(input.projectPath, 'binder.json'))
    const nextBinder = moveBinderNode(binder, input.nodeId, input.targetParentId, input.targetIndex)
    await this.fileSystem.writeJson(input.projectPath, 'binder.json', nextBinder)
    await this.log({
      level: 'info',
      category: 'project',
      event: 'binder-node-moved',
      message: 'Binder node moved successfully.',
      context: {
        projectPath: input.projectPath,
        nodeId: input.nodeId,
        targetParentId: input.targetParentId,
        targetIndex: input.targetIndex
      }
    })

    return {
      binder: nextBinder
    }
  }

  public async deleteBinderNode(input: DeleteBinderNodeRequest): Promise<DeleteBinderNodeResponse> {
    const binder = validateBinderDocument(await this.fileSystem.readJson(input.projectPath, 'binder.json'))
    const nodeMap = new Map(binder.nodes.map((node) => [node.id, node]))
    const deletion = deleteBinderNode(binder, input.nodeId)
    await this.fileSystem.writeJson(input.projectPath, 'binder.json', deletion.binder)

    for (const deletedNodeId of deletion.deletedNodeIds) {
      const deletedNode = nodeMap.get(deletedNodeId)
      if (deletedNode?.type === 'document' && deletedNode.path && deletedNode.documentId) {
        await this.fileSystem.deleteEntry(input.projectPath, deletedNode.path)
        this.indexAdapter.remove(this.getIndexPath(input.projectPath), deletedNode.documentId)
      }
    }

    await this.log({
      level: 'info',
      category: 'project',
      event: 'binder-node-deleted',
      message: 'Binder node deleted successfully.',
      context: {
        projectPath: input.projectPath,
        nodeId: input.nodeId,
        deletedCount: deletion.deletedNodeIds.length
      }
    })

    return deletion
  }

  public async searchDocuments(input: SearchDocumentsRequest): Promise<SearchDocumentsResponse> {
    const results = this.indexAdapter.search(this.getIndexPath(input.projectPath), input.query, input.limit ?? 8)
    await this.log({
      level: 'info',
      category: 'project',
      event: 'search-query',
      message: 'Project search query executed.',
      context: {
        projectPath: input.projectPath,
        queryLength: input.query.trim().length,
        resultCount: results.nodes.length + results.content.length + results.attachments.length
      }
    })

    return { results }
  }

  public async archiveProject(input: ArchiveProjectRequest): Promise<ArchiveProjectResponse> {
    const archiveDirectory = path.join(input.workspaceDirectory, 'Archive')
    await mkdir(archiveDirectory, { recursive: true })
    const nextProjectPath = await this.getAvailableProjectPath(archiveDirectory, path.basename(input.projectPath))
    await rename(input.projectPath, nextProjectPath)
    await this.log({
      level: 'info',
      category: 'project',
      event: 'project-archived',
      message: 'Project archived successfully.',
      context: {
        projectPath: input.projectPath,
        archivedPath: nextProjectPath
      }
    })

    return {
      projectPath: nextProjectPath
    }
  }

  public async restoreProject(input: RestoreProjectRequest): Promise<RestoreProjectResponse> {
    await mkdir(input.workspaceDirectory, { recursive: true })
    const nextProjectPath = await this.getAvailableProjectPath(input.workspaceDirectory, path.basename(input.projectPath))
    await rename(input.projectPath, nextProjectPath)
    await this.log({
      level: 'info',
      category: 'project',
      event: 'project-restored',
      message: 'Project restored successfully.',
      context: {
        projectPath: input.projectPath,
        restoredPath: nextProjectPath
      }
    })

    return {
      projectPath: nextProjectPath
    }
  }

  public async deleteProject(input: DeleteProjectRequest): Promise<DeleteProjectResponse> {
    await rm(input.projectPath, { force: true, recursive: true })
    await this.log({
      level: 'warn',
      category: 'project',
      event: 'project-deleted',
      message: 'Project deleted permanently.',
      context: {
        projectPath: input.projectPath
      }
    })

    return {
      deleted: true
    }
  }

  public async listAttachments(input: ListAttachmentsRequest): Promise<ListAttachmentsResponse> {
    const attachmentsDirectoryPath = this.fileSystem.resolveProjectPath(input.projectPath, ATTACHMENTS_RELATIVE_DIRECTORY)
    await this.fileSystem.ensureDir(input.projectPath, ATTACHMENTS_RELATIVE_DIRECTORY)
    const entries = await this.fileSystem.listEntries(input.projectPath, ATTACHMENTS_RELATIVE_DIRECTORY)
    const items = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => this.toAttachmentRecord(input.projectPath, entry.name))
    )

    return {
      attachmentsDirectoryPath,
      maxFileSizeBytes: MAX_ATTACHMENT_SIZE_BYTES,
      items: items.sort((left, right) => right.importedAt.localeCompare(left.importedAt))
    }
  }

  public async importAttachments(input: ImportAttachmentsRequest): Promise<ImportAttachmentsResponse> {
    await this.fileSystem.ensureDir(input.projectPath, ATTACHMENTS_RELATIVE_DIRECTORY)
    const imported: AttachmentRecord[] = []
    const skipped: ImportAttachmentsResponse['skipped'] = []

    for (const sourcePath of [...new Set(input.sourcePaths)]) {
      const sourceStats = await stat(sourcePath).catch(() => null)
      if (!sourceStats?.isFile()) {
        skipped.push({
          sourcePath,
          reason: 'Source file not available.'
        })
        continue
      }

      if (sourceStats.size > MAX_ATTACHMENT_SIZE_BYTES) {
        skipped.push({
          sourcePath,
          reason: `File exceeds ${MAX_ATTACHMENT_SIZE_BYTES} bytes.`
        })
        continue
      }

      const targetFileName = await this.getAvailableAttachmentFileName(input.projectPath, path.basename(sourcePath))
      const relativeTargetPath = path.posix.join(ATTACHMENTS_RELATIVE_DIRECTORY, targetFileName)
      await this.fileSystem.copyIntoProject(input.projectPath, sourcePath, relativeTargetPath)
      const record = await this.toAttachmentRecord(input.projectPath, targetFileName)
      imported.push(record)
      await this.indexAttachment(input.projectPath, record)
    }

    const listed = await this.listAttachments({ projectPath: input.projectPath })
    await this.log({
      level: imported.length > 0 ? 'info' : 'warn',
      category: 'project',
      event: 'attachments-imported',
      message: 'Attachment import completed.',
      context: {
        projectPath: input.projectPath,
        importedCount: imported.length,
        skippedCount: skipped.length
      }
    })

    return {
      attachmentsDirectoryPath: listed.attachmentsDirectoryPath,
      maxFileSizeBytes: listed.maxFileSizeBytes,
      imported,
      skipped,
      items: listed.items
    }
  }

  private async rebuildDerivedIndex(projectPath: string, binder: { rootId: string; nodes: BinderNode[] }): Promise<void> {
    await this.fileSystem.ensureDir(projectPath, 'cache')
    const indexPath = this.getIndexPath(projectPath)
    this.indexAdapter.initialize(indexPath)

    for (const node of binder.nodes) {
      if (node.type !== 'document' || !node.path) {
        continue
      }

      const rawDocument = await this.fileSystem.readText(projectPath, node.path)
      const parsedDocument = this.parseDocument(node, rawDocument)
      this.indexAdapter.upsert(indexPath, {
        nodeId: node.id,
        documentId: parsedDocument.documentId,
        path: parsedDocument.path,
        title: parsedDocument.title,
        body: parsedDocument.body,
        updatedAt: new Date().toISOString()
      })
    }

    const attachments = await this.listAttachments({ projectPath })
    for (const attachment of attachments.items) {
      await this.indexAttachment(projectPath, attachment)
    }
  }

  private async indexAttachment(projectPath: string, attachment: AttachmentRecord): Promise<void> {
    const extractedText = await this.extractAttachmentText(projectPath, attachment).catch(() => '')
    this.indexAdapter.upsertAttachment(this.getIndexPath(projectPath), {
      relativePath: attachment.relativePath,
      absolutePath: attachment.absolutePath,
      name: attachment.name,
      extension: attachment.extension,
      content: extractedText,
      updatedAt: attachment.importedAt
    })
  }

  private async buildAttachmentPreview(
    projectPath: string,
    attachment: AttachmentRecord
  ): Promise<AttachmentPreviewResponse['preview']> {
    const extension = attachment.extension.toLowerCase()

    if (extension === 'pdf') {
      return {
        kind: 'pdf',
        textContent: await this.extractPdfText(projectPath, attachment.relativePath)
      }
    }

    if (extension === 'epub') {
      return {
        kind: 'epub'
      }
    }

    if (extension === 'docx') {
      const buffer = await this.fileSystem.readBuffer(projectPath, attachment.relativePath)
      const [html, text] = await Promise.all([
        mammoth.convertToHtml({ buffer }).then((result) => result.value),
        mammoth.extractRawText({ buffer }).then((result) => result.value)
      ])
      return {
        kind: 'html',
        htmlContent: html,
        textContent: text
      }
    }

    if (extension === 'odt') {
      const xmlContent = await this.extractZipEntry(projectPath, attachment.relativePath, 'content.xml')
      const textContent = this.stripHtml(xmlContent.replace(/<\/text:p>/g, '</p>').replace(/<text:p[^>]*>/g, '<p>'))
      return {
        kind: 'html',
        htmlContent: `<pre>${this.escapeHtml(textContent)}</pre>`,
        textContent
      }
    }

    if (extension === 'rtf') {
      const textContent = this.stripRtf(await this.fileSystem.readText(projectPath, attachment.relativePath))
      return {
        kind: 'text',
        textContent
      }
    }

    if (this.isHtmlAttachment(extension)) {
      const htmlContent = await this.fileSystem.readText(projectPath, attachment.relativePath)
      return {
        kind: 'html',
        htmlContent,
        textContent: this.stripHtml(htmlContent)
      }
    }

    if (this.isTextAttachment(extension)) {
      return {
        kind: 'text',
        textContent: await this.fileSystem.readText(projectPath, attachment.relativePath)
      }
    }

    return {
      kind: 'unsupported'
    }
  }

  private async extractAttachmentText(projectPath: string, attachment: AttachmentRecord): Promise<string> {
    const extension = attachment.extension.toLowerCase()

    if (extension === 'pdf') {
      return this.extractPdfText(projectPath, attachment.relativePath)
    }

    if (extension === 'docx') {
      const buffer = await this.fileSystem.readBuffer(projectPath, attachment.relativePath)
      return mammoth.extractRawText({ buffer }).then((result) => result.value)
    }

    if (extension === 'odt') {
      const xmlContent = await this.extractZipEntry(projectPath, attachment.relativePath, 'content.xml')
      return this.stripHtml(xmlContent)
    }

    if (extension === 'rtf') {
      return this.stripRtf(await this.fileSystem.readText(projectPath, attachment.relativePath))
    }

    if (this.isHtmlAttachment(extension)) {
      return this.stripHtml(await this.fileSystem.readText(projectPath, attachment.relativePath))
    }

    if (this.isTextAttachment(extension)) {
      return this.fileSystem.readText(projectPath, attachment.relativePath)
    }

    return ''
  }

  private async extractPdfText(projectPath: string, relativePath: string): Promise<string> {
    const buffer = await this.fileSystem.readBuffer(projectPath, relativePath)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false
    })
    const document = await loadingTask.promise
    const pageTexts: string[] = []

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const textContent = await page.getTextContent()
      pageTexts.push(
        textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .filter(Boolean)
          .join(' ')
      )
    }

    return pageTexts.join('\n\n').trim()
  }

  private isTextAttachment(extension: string): boolean {
    return [
      'txt',
      'md',
      'markdown',
      'csv',
      'json',
      'yaml',
      'yml',
      'xml',
      'jats',
      'tei',
      'tex',
      'latex',
      'rst',
      'log'
    ].includes(extension)
  }

  private isHtmlAttachment(extension: string): boolean {
    return ['html', 'htm'].includes(extension)
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private stripRtf(value: string): string {
    return value
      .replace(/\\par[d]?/g, '\n')
      .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
      .replace(/\\[a-z]+-?\d* ?/g, ' ')
      .replace(/[{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private async extractZipEntry(projectPath: string, relativePath: string, entryName: string): Promise<string> {
    const buffer = await this.fileSystem.readBuffer(projectPath, relativePath)
    const signature = 0x04034b50
    let offset = 0

    while (offset < buffer.length - 30) {
      if (buffer.readUInt32LE(offset) !== signature) {
        offset += 1
        continue
      }

      const compressionMethod = buffer.readUInt16LE(offset + 8)
      const compressedSize = buffer.readUInt32LE(offset + 18)
      const fileNameLength = buffer.readUInt16LE(offset + 26)
      const extraLength = buffer.readUInt16LE(offset + 28)
      const fileName = buffer.toString('utf8', offset + 30, offset + 30 + fileNameLength)
      const dataStart = offset + 30 + fileNameLength + extraLength
      const dataEnd = dataStart + compressedSize

      if (fileName === entryName) {
        const chunk = buffer.subarray(dataStart, dataEnd)
        if (compressionMethod === 0) {
          return chunk.toString('utf8')
        }
        if (compressionMethod === 8) {
          return inflateRawSync(chunk).toString('utf8')
        }
        throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`)
      }

      offset = dataEnd
    }

    throw new Error(`ZIP entry not found: ${entryName}`)
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  private mergeMarkdownBodies(
    targetBody: string,
    sourceBody: string,
    insertion: 'prepend' | 'append' | 'offset',
    offset?: number
  ): string {
    const normalizedTarget = targetBody.trim()
    const normalizedSource = sourceBody.trim()
    if (!normalizedSource) {
      return normalizedTarget
    }
    if (!normalizedTarget) {
      return normalizedSource
    }

    if (insertion === 'offset') {
      const safeOffset = Math.max(0, Math.min(typeof offset === 'number' ? offset : normalizedTarget.length, normalizedTarget.length))
      const prefix = normalizedTarget.slice(0, safeOffset).replace(/\s+$/u, '')
      const suffix = normalizedTarget.slice(safeOffset).replace(/^\s+/u, '')

      if (!prefix) {
        return `${normalizedSource}\n\n${suffix}`.trim()
      }
      if (!suffix) {
        return `${prefix}\n\n${normalizedSource}`.trim()
      }

      return `${prefix}\n\n${normalizedSource}\n\n${suffix}`.trim()
    }

    return insertion === 'prepend' ? `${normalizedSource}\n\n${normalizedTarget}` : `${normalizedTarget}\n\n${normalizedSource}`
  }

  private isSupportDocumentPath(nodePath: string): boolean {
    return nodePath.startsWith('research/notes/')
  }

  public async getAttachmentPreview(input: AttachmentPreviewRequest): Promise<AttachmentPreviewResponse> {
    const attachment = await this.toAttachmentRecord(input.projectPath, path.basename(input.relativePath))
    const preview = await this.buildAttachmentPreview(input.projectPath, attachment)
    return {
      attachment,
      preview
    }
  }

  public async absorbBinderNode(input: AbsorbBinderNodeRequest): Promise<AbsorbBinderNodeResponse> {
    const binder = validateBinderDocument(await this.fileSystem.readJson(input.projectPath, 'binder.json'))
    const sourceNode = this.findNode(binder.nodes, input.sourceNodeId)
    const targetNode = this.findDocumentNode(binder.nodes, input.targetDocumentId)

    if (sourceNode.type !== 'document' || !sourceNode.path || !sourceNode.documentId) {
      throw new Error('Solo note e appunti documentali possono essere trasferiti.')
    }

    if (!this.isSupportDocumentPath(sourceNode.path)) {
      throw new Error('Il trascinamento verso un nodo e consentito solo per note e appunti del writing hub.')
    }

    const sourceDocument = this.parseDocument(sourceNode, await this.fileSystem.readText(input.projectPath, sourceNode.path))
    const targetDocument = this.parseDocument(targetNode, await this.fileSystem.readText(input.projectPath, targetNode.path ?? ''))
    const mergedBody = this.mergeMarkdownBodies(targetDocument.body, sourceDocument.body, input.insertion, input.offset)
    const savedAt = new Date().toISOString()
    const mergedDocument: DocumentRecord = {
      ...targetDocument,
      body: mergedBody,
      frontmatter: {
        ...targetDocument.frontmatter,
        updatedAt: savedAt
      }
    }

    await this.fileSystem.writeText(input.projectPath, targetNode.path ?? '', this.serializeDocument(mergedDocument))
    const deletion = deleteBinderNode(binder, sourceNode.id)
    await this.fileSystem.writeJson(input.projectPath, 'binder.json', deletion.binder)
    await this.fileSystem.deleteEntry(input.projectPath, sourceNode.path)
    this.indexAdapter.upsert(this.getIndexPath(input.projectPath), {
      nodeId: targetNode.id,
      documentId: mergedDocument.documentId,
      path: mergedDocument.path,
      title: mergedDocument.title,
      body: mergedDocument.body,
      updatedAt: savedAt
    })
    this.indexAdapter.remove(this.getIndexPath(input.projectPath), sourceNode.documentId)
    const refreshedProject = await this.refreshProjectAuthorship(
      input.projectPath,
      deletion.binder,
      validateProjectMetadata(await this.fileSystem.readJson(input.projectPath, 'project.json'))
    )
    await this.fileSystem.writeJson(input.projectPath, 'project.json', refreshedProject)

    await this.log({
      level: 'info',
      category: 'project',
      event: 'binder-node-absorbed',
      message: 'Support note absorbed into target document.',
      context: {
        projectPath: input.projectPath,
        sourceNodeId: input.sourceNodeId,
        targetDocumentId: input.targetDocumentId,
        insertion: input.insertion
      }
    })

    return {
      binder: deletion.binder,
      targetDocument: mergedDocument,
      deletedNodeIds: deletion.deletedNodeIds
    }
  }

  private async initializeGitRepository(projectPath: string): Promise<void> {
    await execFileAsync('git', ['init'], { cwd: projectPath })
    await execFileAsync('git', ['add', '.'], { cwd: projectPath })
    await execFileAsync('git', ['commit', '--allow-empty', '-m', 'bootstrap: initial project state'], {
      cwd: projectPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Pecie',
        GIT_AUTHOR_EMAIL: 'local@pecie.app',
        GIT_COMMITTER_NAME: 'Pecie',
        GIT_COMMITTER_EMAIL: 'local@pecie.app'
      }
    })
  }

  private async ensureDefaultExportProfiles(projectPath: string, templateId: ProjectTemplateId): Promise<void> {
    if (!(templateId in projectTemplates)) {
      return
    }

    for (const profile of getDefaultExportProfiles(templateId)) {
      const profilePath = `exports/profiles/${profile.id}.json`
      const exists = await this.fileSystem
        .readJson(projectPath, profilePath)
        .then(() => true)
        .catch(() => false)
      if (!exists) {
        await this.fileSystem.writeJson(projectPath, profilePath, profile)
      }
    }

    for (const [assetPath, content] of Object.entries(defaultExportProfileAssets)) {
      const exists = await this.fileSystem
        .readText(projectPath, assetPath)
        .then(() => true)
        .catch(() => false)
      if (!exists) {
        await this.fileSystem.writeText(projectPath, assetPath, content)
      }
    }
  }

  private buildBinderPath(nodes: BinderNode[], nodeId: string): string[] {
    const parentByChild = new Map<string, string>()
    for (const node of nodes) {
      for (const childId of node.children ?? []) {
        parentByChild.set(childId, node.id)
      }
    }

    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const pathTitles: string[] = []
    let currentId: string | undefined = nodeId

    while (currentId) {
      const currentNode = nodeById.get(currentId)
      if (!currentNode) {
        break
      }
      pathTitles.unshift(currentNode.title)
      currentId = parentByChild.get(currentId)
    }

    return pathTitles
  }

  private async synchronizeDocumentState(projectPath: string, documentId: string, updatedAt: string): Promise<DocumentRecord> {
    const binder = validateBinderDocument(await this.fileSystem.readJson(projectPath, 'binder.json'))
    const node = this.findDocumentNode(binder.nodes, documentId)
    const rawDocument = await this.fileSystem.readText(projectPath, node.path ?? '')
    const document = this.parseDocument(node, rawDocument)
    const updatedNodes = binder.nodes.map((candidate) =>
      candidate.documentId === documentId ? { ...candidate, title: document.title } : candidate
    )

    await this.fileSystem.writeJson(projectPath, 'binder.json', {
      ...binder,
      nodes: updatedNodes
    })
    this.indexAdapter.upsert(this.getIndexPath(projectPath), {
      nodeId: node.id,
      documentId: document.documentId,
      path: document.path,
      title: document.title,
      body: document.body,
      updatedAt
    })
    const project = validateProjectMetadata(await this.fileSystem.readJson(projectPath, 'project.json'))
    const refreshedProject = await this.refreshProjectAuthorship(projectPath, { ...binder, nodes: updatedNodes }, project)
    await this.fileSystem.writeJson(projectPath, 'project.json', refreshedProject)

    return document
  }

  private findDocumentNode(nodes: BinderNode[], documentId: string): BinderNode {
    const node = nodes.find((candidate) => candidate.documentId === documentId)
    if (!node || node.type !== 'document' || !node.path) {
      throw new Error(`Documento non trovato: ${documentId}`)
    }
    return node
  }

  private async getAvailableAttachmentFileName(projectPath: string, rawFileName: string): Promise<string> {
    const extension = path.extname(rawFileName)
    const baseName = path.basename(rawFileName, extension)
    const normalizedBaseName = this.sanitizeFileName(baseName) || 'attachment'
    const normalizedExtension = this.sanitizeFileExtension(extension)

    let candidate = `${normalizedBaseName}${normalizedExtension}`
    let counter = 2
    while (
      await access(this.fileSystem.resolveProjectPath(projectPath, path.posix.join(ATTACHMENTS_RELATIVE_DIRECTORY, candidate)))
        .then(() => true)
        .catch(() => false)
    ) {
      candidate = `${normalizedBaseName}-${counter}${normalizedExtension}`
      counter += 1
    }

    return candidate
  }

  private sanitizeFileName(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120)
  }

  private sanitizeFileExtension(extension: string): string {
    if (!extension) {
      return ''
    }

    return extension.replace(/[^a-zA-Z0-9.]+/g, '').slice(0, 16)
  }

  private async toAttachmentRecord(projectPath: string, fileName: string): Promise<AttachmentRecord> {
    const relativePath = path.posix.join(ATTACHMENTS_RELATIVE_DIRECTORY, fileName)
    const absolutePath = this.fileSystem.resolveProjectPath(projectPath, relativePath)
    const entryStats = await this.fileSystem.statEntry(projectPath, relativePath)

    return {
      name: fileName,
      relativePath,
      absolutePath,
      sizeBytes: entryStats.size,
      importedAt: entryStats.mtime.toISOString(),
      extension: path.extname(fileName).replace(/^\./, '').toLowerCase()
    }
  }

  private async refreshProjectAuthorship(
    projectPath: string,
    binder: { rootId: string; nodes: BinderNode[] },
    project: ReturnType<typeof validateProjectMetadata>
  ) {
    const normalizedProject = normalizeProjectMetadata(project, new Date().toISOString())
    const contributions = new Map(normalizedProject.authors.map((author) => [author.id, 0]))

    for (const node of binder.nodes) {
      if (node.type !== 'document' || !node.path) {
        continue
      }

      const rawDocument = await this.fileSystem.readText(projectPath, node.path)
      const document = this.parseDocument(node, rawDocument)
      const authoredBlocks = this.readAuthoredBlocks(document, normalizedProject.authors[0]?.id)

      if (authoredBlocks.length > 0) {
        for (const block of authoredBlocks) {
          contributions.set(block.authorId, (contributions.get(block.authorId) ?? 0) + this.countWords(block.text))
        }
        continue
      }

      const wordCount = this.countWords(document.body)
      const authorId = typeof document.frontmatter.authorId === 'string' ? document.frontmatter.authorId : normalizedProject.authors[0]?.id
      if (authorId) {
        contributions.set(authorId, (contributions.get(authorId) ?? 0) + wordCount)
      }
    }

    const totalWords = [...contributions.values()].reduce((sum, value) => sum + value, 0)
    const stats = normalizedProject.authors
      .map((author) => {
        const wordCount = Math.round(contributions.get(author.id) ?? 0)
        return {
          authorId: author.id,
          wordCount,
          percentage: totalWords > 0 ? Math.round((wordCount / totalWords) * 1000) / 10 : 0
        }
      })
      .sort((left, right) => right.wordCount - left.wordCount)

    return applyAuthorshipStats(normalizedProject, stats)
  }

  private countWords(value: string): number {
    return value
      .trim()
      .split(/\s+/)
      .filter(Boolean).length
  }

  private mergeAuthoredBlocks(
    currentDocument: DocumentRecord,
    nextBody: string,
    currentAuthorId: string,
    fallbackAuthorId: string
  ): Array<{ authorId: string; text: string }> {
    const previousBlocks = this.readAuthoredBlocks(currentDocument, fallbackAuthorId)
    const previousByText = new Map(previousBlocks.map((block) => [block.text, block.authorId]))
    const nextBlocks = this.splitIntoSectionBlocks(nextBody)

    return nextBlocks.map((blockText) => ({
      authorId: previousByText.get(blockText) ?? currentAuthorId,
      text: blockText
    }))
  }

  private readAuthoredBlocks(
    document: DocumentRecord,
    fallbackAuthorId?: string
  ): Array<{ authorId: string; text: string }> {
    const rawValue = document.frontmatter.authoredBlocksJson
    if (typeof rawValue === 'string') {
      try {
        const parsed = JSON.parse(rawValue) as Array<{ authorId?: unknown; text?: unknown }>
        const validBlocks = parsed
          .filter((block): block is { authorId: string; text: string } => typeof block?.authorId === 'string' && typeof block?.text === 'string')
          .filter((block) => block.text.trim().length > 0)
        if (validBlocks.length > 0) {
          return validBlocks
        }
      } catch {
        // Fallback below for legacy documents or malformed metadata.
      }
    }

    const authorId =
      typeof document.frontmatter.authorId === 'string' && document.frontmatter.authorId.length > 0
        ? document.frontmatter.authorId
        : fallbackAuthorId

    if (!authorId) {
      return []
    }

    return this.splitIntoSectionBlocks(document.body).map((text) => ({ authorId, text }))
  }

  private splitIntoSectionBlocks(value: string): string[] {
    const lines = value.split('\n')
    const blocks: string[] = []
    let currentLines: string[] = []

    for (const line of lines) {
      if (/^#{1,6}\s+/.test(line) && currentLines.length > 0) {
        blocks.push(currentLines.join('\n').trim())
        currentLines = [line]
        continue
      }

      currentLines.push(line)
    }

    if (currentLines.length > 0) {
      blocks.push(currentLines.join('\n').trim())
    }

    return blocks.filter(Boolean)
  }

  private findNode(nodes: BinderNode[], nodeId: string): BinderNode {
    const node = nodes.find((candidate) => candidate.id === nodeId)
    if (!node) {
      throw new Error(`Nodo non trovato: ${nodeId}`)
    }

    return node
  }

  private createInitialDocument(
    node: BinderNode,
    createdAt: string,
    template: 'blank' | 'chapter' | 'notes' | 'scene',
    authorId?: string,
    blueprint?: ProjectTemplateDocumentBlueprint,
    context?: {
      projectTitle: string
      language: string
      authorProfile: CreateProjectRequest['authorProfile']
    }
  ): DocumentRecord {
    const body = blueprint && context ? blueprint.body(context) : this.createInitialBody(node.title, template)
    const isSupportDocument =
      blueprint?.includeInExport === false || template === 'notes' || (node.path ?? '').startsWith('research/notes/')
    const authoredBlocks = authorId
      ? this.splitIntoSectionBlocks(body).map((text) => ({ authorId, text }))
      : []
    return {
      documentId: node.documentId ?? node.id,
      binderNodeId: node.id,
      path: node.path ?? '',
      title: node.title,
      frontmatter: {
        id: node.documentId ?? node.id,
        title: node.title,
        type: blueprint?.frontmatterType ?? (isSupportDocument ? 'note' : 'chapter'),
        status: 'draft',
        createdAt,
        updatedAt: createdAt,
        includeInExport: blueprint?.includeInExport ?? !isSupportDocument,
        binderNodeId: node.id,
        summary: node.description ?? '',
        template,
        ...(authorId
          ? {
              authorId,
              contributorAuthorIds: [authorId],
              lastModifiedByAuthorId: authorId,
              authoredBlocksJson: JSON.stringify(authoredBlocks)
            }
          : {})
      },
      body
    }
  }

  private createInitialBody(title: string, template: 'blank' | 'chapter' | 'notes' | 'scene'): string {
    if (template === 'chapter') {
      return `# ${title}\n\n## Obiettivo\n\n## Sviluppo\n\n## Chiusura\n`
    }

    if (template === 'notes') {
      return `# ${title}\n\n- Punto chiave\n- Fonte\n- Da approfondire\n`
    }

    if (template === 'scene') {
      return `# ${title}\n\n## Contesto\n\n## Azione\n\n## Esito\n`
    }

    return `# ${title}\n`
  }

  private async createDuplicatedDocument(
    projectPath: string,
    binderNodes: BinderNode[],
    node: BinderNode,
    createdAt: string,
    sourceDocumentId: string
  ): Promise<DocumentRecord> {
    const sourceNode = this.findDocumentNode(binderNodes, sourceDocumentId)
    const rawDocument = await this.fileSystem.readText(projectPath, sourceNode.path ?? '')
    const sourceDocument = this.parseDocument(sourceNode, rawDocument)

    return {
      documentId: node.documentId ?? node.id,
      binderNodeId: node.id,
      path: node.path ?? '',
      title: node.title,
      frontmatter: {
        ...sourceDocument.frontmatter,
        id: node.documentId ?? node.id,
        title: node.title,
        createdAt,
        updatedAt: createdAt,
        binderNodeId: node.id,
        summary: node.description ?? (typeof sourceDocument.frontmatter.summary === 'string' ? sourceDocument.frontmatter.summary : '')
      },
      body: sourceDocument.body
    }
  }

  private parseDocument(node: BinderNode, rawDocument: string): DocumentRecord {
    const parts = rawDocument.split('---')

    if (parts.length < 3) {
      return {
        documentId: node.documentId ?? node.id,
        binderNodeId: node.id,
        path: node.path ?? '',
        title: node.title,
        frontmatter: {},
        body: rawDocument
      }
    }

    const frontmatterLines = parts[1]
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const frontmatter: Record<string, string | boolean | string[]> = {}
    for (const line of frontmatterLines) {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex === -1) {
        continue
      }

      const key = line.slice(0, separatorIndex).trim()
      const rawValue = line.slice(separatorIndex + 1).trim()

      if (rawValue === 'true' || rawValue === 'false') {
        frontmatter[key] = rawValue === 'true'
      } else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
        frontmatter[key] = rawValue
          .slice(1, -1)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      } else {
        frontmatter[key] = rawValue
      }
    }

    return {
      documentId: node.documentId ?? node.id,
      binderNodeId: node.id,
      path: node.path ?? '',
      title: typeof frontmatter.title === 'string' ? frontmatter.title : node.title,
      frontmatter,
      body: parts.slice(2).join('---').trimStart()
    }
  }

  private serializeDocument(document: DocumentRecord): string {
    const frontmatterLines = Object.entries(document.frontmatter).map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: [${value.join(', ')}]`
      }

      return `${key}: ${String(value)}`
    })

    return ['---', ...frontmatterLines, '---', '', document.body.trimEnd(), ''].join('\n')
  }

  private getIndexPath(projectPath: string): string {
    return this.fileSystem.resolveProjectPath(projectPath, 'cache/index.sqlite')
  }

  private async getAvailableProjectPath(directory: string, basename: string): Promise<string> {
    const extension = path.extname(basename) || '.pe'
    const stem = path.basename(basename, extension)
    let candidate = path.join(directory, `${stem}${extension}`)
    let suffix = 1

    while (
      await access(candidate)
        .then(() => true)
        .catch(() => false)
    ) {
      candidate = path.join(directory, `${stem}-${suffix}${extension}`)
      suffix += 1
    }

    return candidate
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  public async importImageAsset(input: ImportImageAssetRequest): Promise<ImportImageAssetResponse> {
    this.fileSystem.assertProjectPath(input.projectPath)
    const extension = path.extname(input.sourcePath).replace(/^\./, '').toLowerCase()

    if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported image format: .${extension}. Allowed: ${[...ALLOWED_IMAGE_EXTENSIONS].join(', ')}.`)
    }

    const sourceStats = await stat(input.sourcePath)
    if (!sourceStats.isFile()) {
      throw new Error('Source path is not a file.')
    }
    if (sourceStats.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Image exceeds maximum size of ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB.`)
    }

    const buffer = await readFile(input.sourcePath)
    const sha256 = createHash('sha256').update(buffer).digest('hex')

    const project = validateProjectMetadata(
      await this.fileSystem.readJson(input.projectPath, 'project.json')
    ) as ProjectMetadata & { assets?: MediaAssetRecord[] }

    const existingAsset = (project.assets ?? []).find((asset) => asset.sha256 === sha256)
    if (existingAsset) {
      const markdownRef = this.computeImageMarkdownRef(input.altText, existingAsset.relativePath, input.documentRelativePath)
      await this.log({
        level: 'info',
        category: 'project',
        event: 'image-import-deduplicated',
        message: 'Image asset deduplicated.',
        context: { projectPath: input.projectPath, sha256, existingPath: existingAsset.relativePath }
      })
      return { asset: existingAsset, markdownSnippet: markdownRef, deduplicated: true }
    }

    const originalFilename = path.basename(input.sourcePath)
    const slug = this.sanitizeFileName(path.basename(originalFilename, path.extname(originalFilename))).toLowerCase().slice(0, 40) || 'image'
    const shortHash = sha256.slice(0, 8)
    const targetFileName = `${slug}-${shortHash}.${extension}`
    const relativeAssetPath = path.posix.join(MEDIA_RELATIVE_DIRECTORY, targetFileName)

    await this.fileSystem.ensureDir(input.projectPath, MEDIA_RELATIVE_DIRECTORY)
    await this.fileSystem.copyIntoProject(input.projectPath, input.sourcePath, relativeAssetPath)

    const asset: MediaAssetRecord = {
      id: randomUUID(),
      relativePath: relativeAssetPath,
      mimeType: EXTENSION_TO_MIME[extension] ?? `image/${extension}`,
      byteSize: sourceStats.size,
      sha256,
      originalFilename,
      createdAt: new Date().toISOString(),
      kind: 'image'
    }

    try {
      const assets = [...(project.assets ?? []), asset]
      await this.fileSystem.writeJson(input.projectPath, 'project.json', { ...project, assets })
    } catch (registryError) {
      await this.fileSystem.deleteEntry(input.projectPath, relativeAssetPath).catch(() => {})
      throw registryError
    }

    const markdownSnippet = this.computeImageMarkdownRef(input.altText, relativeAssetPath, input.documentRelativePath)

    await this.log({
      level: 'info',
      category: 'project',
      event: 'image-import-completed',
      message: 'Image asset imported.',
      context: { projectPath: input.projectPath, assetPath: relativeAssetPath, byteSize: sourceStats.size }
    })

    return { asset, markdownSnippet, deduplicated: false }
  }

  public async rebuildDerivedIndexForMaintenance(projectPath: string): Promise<void> {
    this.fileSystem.assertProjectPath(projectPath)
    const binder = validateBinderDocument(await this.fileSystem.readJson(projectPath, 'binder.json'))
    await this.fileSystem.deleteEntry(projectPath, 'cache/index.sqlite')
    await this.fileSystem.deleteEntry(projectPath, 'cache/index.sqlite-shm')
    await this.fileSystem.deleteEntry(projectPath, 'cache/index.sqlite-wal')
    await this.fileSystem.deleteEntry(projectPath, 'cache/search')
    await this.fileSystem.deleteEntry(projectPath, 'cache/derived')
    await this.ensureProjectDirectories(projectPath)
    await this.rebuildDerivedIndex(projectPath, binder)
    await this.log({
      level: 'info',
      category: 'project',
      event: 'derived-index-rebuilt',
      message: 'Derived index rebuilt for privacy maintenance.',
      context: {
        projectPath
      }
    })
  }

  private computeImageMarkdownRef(altText: string, assetRelativePath: string, documentRelativePath: string): string {
    const documentDir = path.posix.dirname(documentRelativePath)
    const relativePath = path.posix.relative(documentDir, assetRelativePath)
    const safeAlt = altText.replace(/[[\]]/g, '')
    return `![${safeAlt}](${relativePath})`
  }

  private async log(input: LogEventRequest): Promise<void> {
    await this.logger?.log(input)
  }
}
