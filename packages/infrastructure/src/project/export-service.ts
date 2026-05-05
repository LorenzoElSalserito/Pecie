import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import {
  type BinderNode,
  type ExportDocumentRequest,
  type ExportDocumentResponse,
  type ExportFormat,
  type ExportProfile,
  type ExportRuntimeCapabilityId,
  type ListExportProfilesRequest,
  type ListExportProfilesResponse,
  type PreviewMode,
  type PreviewProfileBinding,
  previewCapabilities,
  previewModes,
  type PreviewExportRequest,
  type PreviewExportResponse,
  type RuntimeCapabilityReport,
  validateExportProfile,
  validateManifest,
  validateProjectMetadata
} from '@pecie/schemas'
import { defaultExportProfileAssets, getDefaultExportProfiles, projectTemplates, type ProjectTemplateId } from '@pecie/domain'
import { ProjectFileSystem } from '../fs/project-file-system'
import {
  buildPandocArgs,
  exportFormats,
  readCitationProfile,
  toExportProfileFilename
} from './export-arg-builder'
import { assertWriteTarget, normalizeRelativePath } from './export-write-guard'
import { normalizeProjectMetadata } from './project-authorship'
import { renderPreviewArtifact, type PreviewPipeline } from '../preview/preview-engine'
import { ExportRuntimeResolver } from '../export/export-runtime-resolver'
import { pruneProjectCacheEntries } from '../cache/cache-retention'

const execFileAsync = promisify(execFile)

const EXPORT_PROFILES_DIRECTORY = 'exports/profiles'
const CURRENT_EXPORT_PROFILE_VERSION = 1
const EXPORT_PREVIEW_CACHE_LIMIT = 8

const exportProfileMigrations: Record<string, (value: Record<string, unknown>) => Record<string, unknown>> = {}

type ExportedDocument = {
  node: BinderNode
  markdown: string
  frontmatter: Record<string, string | boolean | string[]>
  documentId: string
  title: string
  authorId?: string
  contributorAuthorIds: string[]
  lastModifiedByAuthorId?: string
  blockContributions: Array<{ authorId: string; wordCount: number }>
  sectionContributions: Array<{
    title: string
    authorId: string
    wordCount: number
  }>
}

type PreparedExportContext = {
  manifest: ReturnType<typeof validateManifest>
  project: ReturnType<typeof normalizeProjectMetadata>
  profile: ExportProfile
  format: ExportFormat
  markdownBody: string
  exportPayload: string
}

type ExecFileResult = {
  stdout?: string
  stderr?: string
}

type ExecFileRunner = (file: string, args: string[]) => Promise<ExecFileResult>

export class ExportService {
  public constructor(
    private readonly fileSystem = new ProjectFileSystem(),
    private readonly execRunner: ExecFileRunner = execFileAsync,
    private readonly runtimeResolver: ExportRuntimeResolver = new ExportRuntimeResolver()
  ) {}

  public async getRuntimeCapabilities(): Promise<{
    runtimeVersion?: string
    capabilities: RuntimeCapabilityReport[]
  }> {
    return this.runtimeResolver.getRuntimeCapabilities()
  }

  public async listProfiles(input: ListExportProfilesRequest): Promise<ListExportProfilesResponse> {
    await this.ensureDefaultExportProfiles(input.projectPath)
    const defaultProfileId = await this.readDefaultProfileId(input.projectPath)
    const diagnostics: ListExportProfilesResponse['diagnostics'] = []
    const profiles = await this.readProfiles(input.projectPath, diagnostics)

    return {
      defaultProfileId,
      diagnostics,
      profiles: profiles
        .map(({ profile, sourcePath }) => ({
          id: profile.id,
          label: profile.label,
          format: profile.format,
          engine: profile.engine,
          citationProfile: profile.citationProfile,
          template: profile.template,
          theme: profile.theme,
          sourcePath,
          isDefault: profile.id === defaultProfileId
        }))
        .sort((left, right) => {
          if (left.isDefault !== right.isDefault) {
            return left.isDefault ? -1 : 1
          }

          return left.label.localeCompare(right.label)
        })
    }
  }

  public async exportDocument(request: ExportDocumentRequest): Promise<ExportDocumentResponse> {
    await this.ensureDefaultExportProfiles(request.projectPath)
    const tempDir = await mkdtemp(path.join(tmpdir(), 'pecie-export-'))
    const inputPath = path.join(tempDir, 'export.md')

    try {
      const context = await this.prepareExportContext(request)
      const { project, profile, format, exportPayload, markdownBody } = context
      const outputRelativePath = this.resolveFinalExportRelativePath(request.projectPath, request.outputPath)
      const outputAbsolutePath = this.fileSystem.resolveProjectPath(request.projectPath, outputRelativePath)

      if (format === 'txt') {
        await this.fileSystem.writeText(request.projectPath, outputRelativePath, this.toPlainText(project.title, markdownBody))
        return {
          success: true,
          outputPath: outputAbsolutePath,
          log: [`Export ${format.toUpperCase()} completato.`, `Profilo: ${profile.label}`, `Output: ${outputAbsolutePath}`]
        }
      }

      await this.validateProfileAssets(request.projectPath, profile, request.citationProfileId)
      await writeFile(inputPath, exportPayload, 'utf8')
      await this.fileSystem.ensureDir(request.projectPath, path.dirname(outputRelativePath))
      await this.runPandoc(
        request.projectPath,
        inputPath,
        outputAbsolutePath,
        profile,
        request.citationProfileId
      )

      return {
        success: true,
        outputPath: outputAbsolutePath,
        log: [`Export ${format.toUpperCase()} completato.`, `Profilo: ${profile.label}`, `Output: ${outputAbsolutePath}`]
      }
    } catch (error: unknown) {
      const message = this.formatExportError(error)
      return {
        success: false,
        log: [message]
      }
    } finally {
      await rm(tempDir, { force: true, recursive: true })
    }
  }

  public async renderPreview(request: PreviewExportRequest, mode: PreviewMode): Promise<PreviewExportResponse> {
    await this.ensureDefaultExportProfiles(request.projectPath)

    if (!previewModes[mode].exportPreviewStepEnabled) {
      return {
        status: 'error',
        errorMessageKey: 'preview.errors.engineDisabled'
      }
    }

    try {
      const context = await this.prepareExportContext(request)
      const capability = previewCapabilities[context.format]
      const pipeline = this.selectExportPreviewPipeline(context.format)
      const generatedAt = new Date().toISOString()
      const artifact = renderPreviewArtifact({
        profile: context.profile,
        mode,
        pipeline,
        body: context.markdownBody,
        generatedAt,
        cacheRoot: 'cache/preview/export-step/tmp'
      })
      const previewPages = artifact.preview.pages.map((page, index) => ({
        ...page,
        previewAssetRelPath: `cache/preview/export-step/${artifact.cacheKey}/page-${index + 1}.html`
      }))
      const pageAssets = artifact.pageAssets.map((asset, index) => ({
        ...asset,
        relativePath: `cache/preview/export-step/${artifact.cacheKey}/page-${index + 1}.html`
      }))
      const manifestRelPath = `cache/preview/export-step/${artifact.cacheKey}/preview.json`
      let cached = false
      try {
        const existing = await this.fileSystem.readJson<{ cacheKey?: unknown }>(request.projectPath, manifestRelPath)
        cached = typeof existing?.cacheKey === 'string' && existing.cacheKey === artifact.cacheKey
      } catch {
        cached = false
      }

      if (!cached) {
        for (const asset of pageAssets) {
          assertWriteTarget(asset.relativePath, 'export-preview')
          await this.fileSystem.writeText(request.projectPath, asset.relativePath, asset.contents)
        }
        assertWriteTarget(manifestRelPath, 'export-preview')
        await this.fileSystem.writeJson(request.projectPath, manifestRelPath, {
          ...artifact.preview,
          pages: previewPages
        })
      }

      const previewText = await this.renderPreviewText({
        projectPath: request.projectPath,
        profile: context.profile,
        exportPayload: context.exportPayload,
        markdownBody: context.markdownBody,
        projectTitle: context.project.title,
        cacheKey: artifact.cacheKey
      })
      await this.pruneExportPreviewCache(request.projectPath, artifact.cacheKey)

      return {
        status: cached ? 'cached' : 'ready',
        binding: this.buildPreviewBinding(context.manifest.projectId, context.profile),
        preview: {
          ...artifact.preview,
          pages: previewPages
        },
        previewKind: capability.previewKind,
        previewText,
        warningMessageKey: this.warningMessageKeyForPreviewKind(capability.previewKind),
        regeneratedInMs: cached ? 0 : undefined
      }
    } catch (error: unknown) {
      return {
        status: 'error',
        errorMessageKey: error instanceof Error ? error.message : 'preview.errors.profileInvalid'
      }
    }
  }

  private async readProfiles(
    projectPath: string,
    diagnostics: ListExportProfilesResponse['diagnostics']
  ): Promise<Array<{ profile: ExportProfile; sourcePath: string }>> {
    try {
      const entries = await this.fileSystem.listEntries(projectPath, EXPORT_PROFILES_DIRECTORY)
      const profiles: Array<{ profile: ExportProfile; sourcePath: string }> = []

      for (const entry of entries) {
        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.json') {
          continue
        }

        const sourcePath = `${EXPORT_PROFILES_DIRECTORY}/${entry.name}`
        try {
          const profile = await this.loadProfileFromPath(projectPath, sourcePath)
          await this.validateProfileAssets(projectPath, profile)
          profiles.push({ profile, sourcePath })
        } catch (error) {
          diagnostics.push({
            profileId: path.basename(entry.name, '.json'),
            sourcePath,
            severity: 'error',
            message: error instanceof Error ? error.message : 'Unable to validate export profile.'
          })
        }
      }

      return profiles
    } catch {
      return []
    }
  }

  private async resolveExportProfile(projectPath: string, profileId: string): Promise<ExportProfile> {
    const normalizedId = profileId.trim()
    if (!normalizedId) {
      throw new Error('Campo "profileId" non valido per export.')
    }

    const sourcePath = `${EXPORT_PROFILES_DIRECTORY}/${toExportProfileFilename(normalizedId)}`
    const profile = await this.loadProfileFromPath(projectPath, sourcePath)
    await this.validateProfileAssets(projectPath, profile)
    return profile
  }

  private async loadProfileFromPath(projectPath: string, sourcePath: string): Promise<ExportProfile> {
    const rawProfile = await this.fileSystem.readJson<Record<string, unknown>>(projectPath, sourcePath)
    const migrated = this.applyMigrations(rawProfile, sourcePath)
    return validateExportProfile(migrated)
  }

  private applyMigrations(value: Record<string, unknown>, sourcePath: string): Record<string, unknown> {
    let currentValue = value
    let version = typeof currentValue.schemaVersion === 'number' ? currentValue.schemaVersion : Number.NaN
    if (!Number.isFinite(version)) {
      throw new Error(`Profilo export non valido in ${sourcePath}: campo "schemaVersion" mancante.`)
    }

    while (version !== CURRENT_EXPORT_PROFILE_VERSION) {
      const migrationKey = `${version}->${version + 1}`
      const migrate = exportProfileMigrations[migrationKey]
      if (!migrate) {
        throw new Error(`Profilo export non supportato in ${sourcePath}: migration ${migrationKey} assente.`)
      }

      currentValue = migrate(currentValue)
      version = typeof currentValue.schemaVersion === 'number' ? currentValue.schemaVersion : Number.NaN
    }

    return currentValue
  }

  private async validateProfileAssets(projectPath: string, profile: ExportProfile, citationProfileOverride?: string): Promise<void> {
    const formatConfig = exportFormats[profile.format]
    if (!formatConfig) {
      throw new Error(`Profilo export "${profile.id}": campo "format" non supportato (${profile.format}).`)
    }

    if (profile.engine && !formatConfig.engines.some((engine) => engine === profile.engine)) {
      throw new Error(`Profilo export "${profile.id}": campo "engine" non valido per ${profile.format}.`)
    }

    if (profile.template) {
      await this.fileSystem.readText(projectPath, profile.template).catch(() => {
        throw new Error(`Profilo export "${profile.id}": template non trovato (${profile.template}).`)
      })
    }

    if (profile.theme) {
      if (path.extname(profile.theme).toLowerCase() === '.json') {
        await this.fileSystem.readJson<Record<string, unknown>>(projectPath, profile.theme).catch(() => {
          throw new Error(`Profilo export "${profile.id}": theme JSON non valido (${profile.theme}).`)
        })
      } else {
        await this.fileSystem.readText(projectPath, profile.theme).catch(() => {
          throw new Error(`Profilo export "${profile.id}": theme non trovato (${profile.theme}).`)
        })
      }
    }

    const citationProfileId = citationProfileOverride?.trim() || profile.citationProfile?.trim()
    if (citationProfileId) {
      await readCitationProfile(this.fileSystem, projectPath, citationProfileId)
    }
  }

  private async readDefaultProfileId(projectPath: string): Promise<string> {
    try {
      const manifest = validateManifest(await this.fileSystem.readJson(projectPath, 'manifest.json'))
      return manifest.defaultExportProfile
    } catch {
      return ''
    }
  }

  private async runPandoc(
    projectPath: string,
    inputPath: string,
    outputPath: string,
    profile: ExportProfile,
    citationProfileOverride?: string
  ): Promise<void> {
    const pandocBinary = await this.runtimeResolver.resolveBinary({
      capabilityId: 'pandoc',
      allowSystemFallback: false
    })
    const pdfEngineBinary = profile.engine
      ? await this.runtimeResolver.resolveBinary({
          capabilityId: profile.engine as ExportRuntimeCapabilityId,
          allowSystemFallback: profile.engine !== 'weasyprint'
        })
      : null

    await this.execRunner(
      pandocBinary.executablePath,
      await buildPandocArgs({
        fileSystem: this.fileSystem,
        projectPath,
        inputPath,
        outputPath,
        profile,
        citationProfileOverride,
        pdfEngineExecutablePath: pdfEngineBinary?.executablePath
      })
    )
  }

  private formatExportError(error: unknown): string {
    const fallback = 'Export non riuscito. Verifica che Pandoc sia installato.'
    if (!(error instanceof Error)) {
      return fallback
    }

    const structured = this.parseStructuredPandocError(error)
    if (structured) {
      return structured
    }

    return error.message || fallback
  }

  private parseStructuredPandocError(error: Error & { stderr?: unknown; stdout?: unknown }): string | null {
    const stderr = typeof error.stderr === 'string' ? error.stderr.trim() : ''
    const stdout = typeof error.stdout === 'string' ? error.stdout.trim() : ''
    const combined = [stderr, stdout, error.message].filter(Boolean).join('\n')
    if (!combined) {
      return null
    }

    const fileLinePattern = /(?:Error(?: at)?|!)[^\n]*?([A-Za-z0-9_./\\-]+\.(?:tex|ltx|cls|sty|html|md|xml|yaml|yml|json)):(\d+)(?::\d+)?[:\s-]*(.+)?/i
    const fileLineMatch = combined.match(fileLinePattern)
    if (fileLineMatch) {
      const [, sourcePath, lineNumber, detail] = fileLineMatch
      return `Errore template in ${sourcePath}, riga ${lineNumber}: ${this.sanitizePandocDetail(detail || combined)}`
    }

    const latexPathMatch = combined.match(/([A-Za-z0-9_./\\-]+\.(?:tex|ltx|cls|sty))/i)
    const latexLineMatch = combined.match(/\bl\.(\d+)\b/)
    if (latexPathMatch && latexLineMatch) {
      return `Errore template in ${latexPathMatch[1]}, riga ${latexLineMatch[1]}: ${this.sanitizePandocDetail(combined)}`
    }

    return null
  }

  private sanitizePandocDetail(detail: string): string {
    return detail
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^Error:?\s*$/i.test(line))
      .slice(0, 2)
      .join(' ')
      .replace(/\s+/g, ' ')
  }

  private async prepareExportContext(
    request: Pick<ExportDocumentRequest, 'projectPath' | 'profileId' | 'citationProfileId' | 'scope' | 'documentId'>
  ): Promise<PreparedExportContext> {
    const binder = await this.fileSystem.readJson<{ rootId: string; nodes: BinderNode[] }>(request.projectPath, 'binder.json')
    const manifest = validateManifest(await this.fileSystem.readJson(request.projectPath, 'manifest.json'))
    const project = normalizeProjectMetadata(
      validateProjectMetadata(await this.fileSystem.readJson(request.projectPath, 'project.json')),
      new Date().toISOString()
    )
    const profile = await this.resolveExportProfile(request.projectPath, request.profileId || manifest.defaultExportProfile)
    const format = profile.format
    const selectedNodes = this.selectNodes(binder.nodes, binder.rootId, request, profile)
    const exportedDocuments: ExportedDocument[] = []

    for (const node of selectedNodes) {
      if (node.type !== 'document' || !node.path) {
        continue
      }

      const raw = await this.fileSystem.readText(request.projectPath, node.path)
      const frontmatter = this.parseFrontmatter(raw)
      if (!this.shouldIncludeDocument(frontmatter, profile)) {
        continue
      }

      const blockContributions = this.parseBlockContributions(frontmatter)
      const sectionContributions = this.parseSectionContributions(frontmatter)
      exportedDocuments.push({
        node,
        markdown: this.stripFrontmatter(raw),
        frontmatter,
        documentId: node.documentId ?? node.id,
        title: typeof frontmatter.title === 'string' ? frontmatter.title : node.title,
        authorId: typeof frontmatter.authorId === 'string' ? frontmatter.authorId : undefined,
        contributorAuthorIds: Array.isArray(frontmatter.contributorAuthorIds)
          ? frontmatter.contributorAuthorIds.filter((value): value is string => typeof value === 'string')
          : [],
        lastModifiedByAuthorId:
          typeof frontmatter.lastModifiedByAuthorId === 'string' ? frontmatter.lastModifiedByAuthorId : undefined,
        blockContributions,
        sectionContributions
      })
    }

    if (exportedDocuments.length === 0) {
      throw new Error('Nessun documento esportabile selezionato per il profilo scelto.')
    }

    const relevantAuthorIds = Array.from(
      new Set(
        exportedDocuments.flatMap((document) => [
          ...(document.authorId ? [document.authorId] : []),
          ...document.contributorAuthorIds,
          ...(document.lastModifiedByAuthorId ? [document.lastModifiedByAuthorId] : [])
        ])
      )
    )
    const relevantAuthors =
      relevantAuthorIds.length > 0 ? project.authors.filter((author) => relevantAuthorIds.includes(author.id)) : project.authors
    const projectAuthorshipStats = (project.authorshipStats ?? [])
      .map((stat) => ({
        ...stat,
        author: project.authors.find((author) => author.id === stat.authorId)
      }))
      .filter((entry) => entry.author)
    const metadata = {
      title: project.title,
      lang: project.defaultLanguage,
      author: relevantAuthors.map((author) => author.name),
      'pecie-export-profile-id': profile.id,
      'pecie-primary-author-id': project.primaryAuthorId ?? '',
      'pecie-primary-author-name':
        project.authors.find((author) => author.id === project.primaryAuthorId)?.name ?? project.author.name,
      'pecie-authors': relevantAuthors.map((author) => ({
        id: author.id,
        name: author.name,
        role: author.role,
        institutionName: author.institutionName ?? '',
        department: author.department ?? '',
        preferredLanguage: author.preferredLanguage,
        addedAt: author.addedAt,
        lastModifiedAt: author.lastModifiedAt
      })),
      'pecie-project-authorship': projectAuthorshipStats.map((entry) => ({
        authorId: entry.authorId,
        authorName: entry.author?.name ?? '',
        role: entry.author?.role ?? '',
        wordCount: entry.wordCount,
        percentage: entry.percentage
      })),
      'pecie-documents': exportedDocuments.map((document) => ({
        documentId: document.documentId,
        title: document.title,
        authorId: document.authorId,
        authorName: relevantAuthors.find((author) => author.id === document.authorId)?.name ?? '',
        contributorAuthorIds: document.contributorAuthorIds,
        contributorNames: document.contributorAuthorIds
          .map((authorId) => relevantAuthors.find((author) => author.id === authorId)?.name ?? '')
          .filter(Boolean),
        lastModifiedByAuthorId: document.lastModifiedByAuthorId,
        lastModifiedByAuthorName: relevantAuthors.find((author) => author.id === document.lastModifiedByAuthorId)?.name ?? '',
        blockContributions: document.blockContributions.map((entry) => ({
          ...entry,
          authorName: relevantAuthors.find((author) => author.id === entry.authorId)?.name ?? '',
          percentage:
            document.blockContributions.reduce((sum, current) => sum + current.wordCount, 0) > 0
              ? Number(
                  (
                    (entry.wordCount / document.blockContributions.reduce((sum, current) => sum + current.wordCount, 0)) *
                    100
                  ).toFixed(2)
                )
              : 0
        })),
        sectionContributions: document.sectionContributions.map((entry) => ({
          ...entry,
          authorName: relevantAuthors.find((author) => author.id === entry.authorId)?.name ?? ''
        }))
      }))
    }
    const markdownBody = exportedDocuments
      .map((document) => {
        if (format === 'md' || format === 'txt' || !document.node.path) {
          return document.markdown
        }

        return this.rewriteImagePathsForExport(document.markdown, request.projectPath, document.node.path)
      })
      .join('\n\n')

    return {
      manifest,
      project,
      profile,
      format,
      markdownBody,
      exportPayload: `${this.toYamlFrontmatter(metadata)}\n${markdownBody}`
    }
  }

  private selectExportPreviewPipeline(format: ExportFormat): PreviewPipeline {
    return previewCapabilities[format].previewKind === 'visual' ? 'pandoc-accurate' : 'html-print-css'
  }

  private buildPreviewBinding(projectId: string, profile: ExportProfile): PreviewProfileBinding {
    const capability = previewCapabilities[profile.format]
    return {
      projectId,
      profileId: profile.id,
      format: profile.format,
      supportsPageMarkers: capability.supportsPageMarkers,
      previewKind: capability.previewKind
    }
  }

  private async renderPreviewText(input: {
    projectPath: string
    profile: ExportProfile
    exportPayload: string
    markdownBody: string
    projectTitle: string
    cacheKey: string
  }): Promise<string> {
    switch (input.profile.format) {
      case 'md':
        return this.renderExactTextPreview(input)
      case 'txt':
        return this.toPlainText(input.projectTitle, input.markdownBody)
      case 'jats':
      case 'tei':
        return this.renderExactTextPreview(input)
      case 'epub':
        return this.toContinuousReaderText(input.markdownBody)
      default:
        return this.toApproximatePreviewText(input.markdownBody)
    }
  }

  private warningMessageKeyForPreviewKind(previewKind: PreviewProfileBinding['previewKind']): string | undefined {
    switch (previewKind) {
      case 'approximate':
        return 'exportPreviewApproximateNotice'
      case 'reader':
        return 'exportPreviewReaderNotice'
      case 'text':
        return 'exportPreviewTextNotice'
      default:
        return undefined
    }
  }

  private async renderExactTextPreview(input: {
    projectPath: string
    profile: ExportProfile
    exportPayload: string
    cacheKey: string
  }): Promise<string> {
    const extension = input.profile.format === 'md' ? 'md' : input.profile.format
    const previewFilePath = `cache/preview/export-step/${input.cacheKey}/preview.${extension}`
    assertWriteTarget(previewFilePath, 'export-preview')

    try {
      return await this.fileSystem.readText(input.projectPath, previewFilePath)
    } catch {
      const tempDir = await mkdtemp(path.join(tmpdir(), 'pecie-export-preview-text-'))
      const inputPath = path.join(tempDir, 'preview.md')
      try {
        await writeFile(inputPath, input.exportPayload, 'utf8')
        await this.fileSystem.ensureDir(input.projectPath, path.dirname(previewFilePath))
        const outputPath = this.fileSystem.resolveProjectPath(input.projectPath, previewFilePath)
        await this.runPandoc(input.projectPath, inputPath, outputPath, input.profile)
        return await this.fileSystem.readText(input.projectPath, previewFilePath)
      } finally {
        await rm(tempDir, { force: true, recursive: true })
      }
    }
  }

  private async pruneExportPreviewCache(projectPath: string, keepCacheKey: string): Promise<void> {
    await pruneProjectCacheEntries({
      fileSystem: this.fileSystem,
      projectPath,
      relativeDirectory: 'cache/preview/export-step',
      maxEntries: EXPORT_PREVIEW_CACHE_LIMIT,
      keepName: keepCacheKey,
      kind: 'directory'
    })
  }

  private toContinuousReaderText(markdownBody: string): string {
    return markdownBody
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '• ')
      .replace(/^\s*\d+\.\s+/gm, '• ')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .trim()
  }

  private toApproximatePreviewText(markdownBody: string): string {
    return this.toContinuousReaderText(markdownBody)
  }

  private async ensureDefaultExportProfiles(projectPath: string): Promise<void> {
    const project = validateProjectMetadata(await this.fileSystem.readJson(projectPath, 'project.json'))
    const templateId = project.documentKind as ProjectTemplateId

    if (!(templateId in projectTemplates)) {
      return
    }

    for (const profile of getDefaultExportProfiles(templateId)) {
      const profilePath = `${EXPORT_PROFILES_DIRECTORY}/${profile.id}.json`
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

  private resolveFinalExportRelativePath(projectPath: string, outputPath: string): string {
    const relativePath = normalizeRelativePath(path.relative(projectPath, outputPath))
    assertWriteTarget(relativePath, 'final-export')
    return relativePath
  }

  private selectNodes(
    nodes: BinderNode[],
    rootId: string,
    request: Pick<ExportDocumentRequest, 'scope' | 'documentId'>,
    profile: ExportProfile
  ): BinderNode[] {
    if (request.scope === 'current-document') {
      return nodes.filter((node) => node.documentId === request.documentId)
    }

    const allowedNodeIds = profile.include.binderRoot
      ? this.collectSubtreeNodeIds(nodes, profile.include.binderRoot)
      : this.collectSubtreeNodeIds(nodes, rootId)

    return nodes.filter((node) => node.type === 'document' && allowedNodeIds.has(node.id))
  }

  private collectSubtreeNodeIds(nodes: BinderNode[], rootId: string): Set<string> {
    const nodesById = new Map(nodes.map((node) => [node.id, node]))
    const visited = new Set<string>()
    const queue = [rootId]

    while (queue.length > 0) {
      const currentId = queue.shift()
      if (!currentId || visited.has(currentId)) {
        continue
      }

      visited.add(currentId)
      const node = nodesById.get(currentId)
      if (!node?.children) {
        continue
      }

      for (const childId of node.children) {
        queue.push(childId)
      }
    }

    return visited
  }

  private shouldIncludeDocument(
    frontmatter: Record<string, string | boolean | string[]>,
    profile: ExportProfile
  ): boolean {
    const exclusionMap = profile.include.excludeFrontmatter ?? {}
    for (const [key, expectedValue] of Object.entries(exclusionMap)) {
      if (frontmatter[key] === expectedValue) {
        return false
      }
    }

    const excludedTags = new Set(profile.include.excludeTags ?? [])
    if (excludedTags.size > 0) {
      const rawTags = frontmatter.tags
      const tags = Array.isArray(rawTags) ? rawTags : typeof rawTags === 'string' ? [rawTags] : []
      if (tags.some((tag) => excludedTags.has(tag))) {
        return false
      }
    }

    return true
  }

  private stripFrontmatter(rawDocument: string): string {
    if (!rawDocument.startsWith('---')) {
      return rawDocument
    }

    const parts = rawDocument.split('---')
    if (parts.length < 3) {
      return rawDocument
    }

    return parts.slice(2).join('---').trimStart()
  }

  private parseFrontmatter(rawDocument: string): Record<string, string | boolean | string[]> {
    if (!rawDocument.startsWith('---')) {
      return {}
    }

    const parts = rawDocument.split('---')
    if (parts.length < 3) {
      return {}
    }

    const frontmatter: Record<string, string | boolean | string[]> = {}
    for (const line of parts[1]
      .trim()
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)) {
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

    return frontmatter
  }

  private parseBlockContributions(
    frontmatter: Record<string, string | boolean | string[]>
  ): Array<{ authorId: string; wordCount: number }> {
    if (typeof frontmatter.authoredBlocksJson !== 'string') {
      return []
    }

    try {
      const parsed = JSON.parse(frontmatter.authoredBlocksJson) as Array<{ authorId?: unknown; text?: unknown }>
      const contributions = new Map<string, number>()
      for (const block of parsed) {
        if (typeof block?.authorId !== 'string' || typeof block?.text !== 'string') {
          continue
        }

        const words = block.text
          .trim()
          .split(/\s+/)
          .filter(Boolean).length
        contributions.set(block.authorId, (contributions.get(block.authorId) ?? 0) + words)
      }

      return [...contributions.entries()].map(([authorId, wordCount]) => ({ authorId, wordCount }))
    } catch {
      return []
    }
  }

  private parseSectionContributions(
    frontmatter: Record<string, string | boolean | string[]>
  ): Array<{ title: string; authorId: string; wordCount: number }> {
    if (typeof frontmatter.authoredBlocksJson !== 'string') {
      return []
    }

    try {
      const parsed = JSON.parse(frontmatter.authoredBlocksJson) as Array<{ authorId?: unknown; text?: unknown }>
      return parsed.flatMap((block) => {
        if (typeof block?.authorId !== 'string' || typeof block?.text !== 'string') {
          return []
        }

        const titleLine = block.text
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line.startsWith('#'))
        const title = titleLine ? titleLine.replace(/^#+\s*/, '') : 'Untitled section'
        const wordCount = block.text
          .trim()
          .split(/\s+/)
          .filter(Boolean).length

        return [
          {
            title,
            authorId: block.authorId,
            wordCount
          }
        ]
      })
    } catch {
      return []
    }
  }

  private toYamlFrontmatter(value: Record<string, unknown>): string {
    const lines = ['---', ...this.serializeYaml(value, 0), '---', '']
    return lines.join('\n')
  }

  private serializeYaml(value: unknown, indent: number): string[] {
    const prefix = '  '.repeat(indent)

    if (Array.isArray(value)) {
      return value.flatMap((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const entries = Object.entries(item as Record<string, unknown>)
          if (entries.length === 0) {
            return [`${prefix}- {}`]
          }

          const lines = [`${prefix}-`]
          for (const [key, nestedValue] of entries) {
            if (this.isYamlScalar(nestedValue)) {
              lines.push(`${prefix}  ${key}: ${this.formatYamlScalar(nestedValue)}`)
            } else {
              lines.push(`${prefix}  ${key}:`)
              lines.push(...this.serializeYaml(nestedValue, indent + 2))
            }
          }
          return lines
        }

        return [`${prefix}- ${this.formatYamlScalar(item)}`]
      })
    }

    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
        if (this.isYamlScalar(nestedValue)) {
          return [`${prefix}${key}: ${this.formatYamlScalar(nestedValue)}`]
        }

        return [`${prefix}${key}:`, ...this.serializeYaml(nestedValue, indent + 1)]
      })
    }

    return [`${prefix}${this.formatYamlScalar(value)}`]
  }

  private isYamlScalar(value: unknown): value is string | number | boolean | null | undefined {
    return value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value)
  }

  private formatYamlScalar(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '""'
    }

    if (typeof value === 'boolean' || typeof value === 'number') {
      return String(value)
    }

    return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
  }

  private toPlainText(projectTitle: string, markdownBody: string): string {
    const cleanedBody = markdownBody
      .split('\n')
      .map((line) => this.normalizeMarkdownLine(line))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return `${projectTitle}\n\n${cleanedBody}\n`
  }

  private normalizeMarkdownLine(line: string): string {
    if (this.isMarkdownTableLine(line)) {
      return line
    }

    let normalized = line
      .replace(/^#{1,6}\s+/g, '')
      .replace(/^\s*>\s?/g, '')
      .replace(/^\s*[-*+]\s+\[(?: |x)\]\s+/gi, '• ')
      .replace(/^\s*[-*+]\s+/g, '• ')
      .replace(/^(\s*)\d+\.\s+/g, '$1')
      .replace(/^```.*$/g, '')
      .replace(/^~~~.*$/g, '')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
      .replace(/(?<!_)_([^_]+)_(?!_)/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/<u>(.*?)<\/u>/gi, '$1')
      .replace(/<[^>]+>/g, '')

    if (/^\[\^[^\]]+\]:/.test(normalized.trim())) {
      normalized = normalized.replace(/^\[\^([^\]]+)\]:\s*/, '$1: ')
    }

    return normalized
  }

  private isMarkdownTableLine(line: string): boolean {
    return /^\s*\|.*\|\s*$/.test(line)
  }

  private rewriteImagePathsForExport(markdownBody: string, projectPath: string, documentRelativePath: string): string {
    const documentDirectory = path.posix.dirname(documentRelativePath)

    return markdownBody.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (fullMatch, altText: string, rawTarget: string) => {
      const target = rawTarget.trim()
      if (!target || /^(?:[a-z]+:|\/)/i.test(target)) {
        return fullMatch
      }

      const resolvedRelativePath = path.posix.normalize(path.posix.join(documentDirectory, target))
      const absolutePath = this.fileSystem.resolveProjectPath(projectPath, resolvedRelativePath)
      return `![${altText}](${absolutePath})`
    })
  }

}
