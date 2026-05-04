import {
  type BinderNode,
  type ExportFormat,
  type ExportProfile,
  type GetPageBreaksRequest,
  type GetPageBreaksResponse,
  type PreviewMode,
  type PreviewProfileBinding,
  type RenderAccurateRequest,
  type RenderAccurateResponse,
  type RenderFastRequest,
  type RenderFastResponse,
  previewCapabilities,
  previewModes,
  validateBinderDocument,
  validateExportProfile,
  validateManifest,
  validatePageBreakMap
} from '@pecie/schemas'

import { ProjectFileSystem } from '../fs/project-file-system'
import { pruneProjectCacheEntries } from '../cache/cache-retention'
import { computePreviewCacheKey } from './cache-key'
import { type PreviewPipeline, renderPreviewArtifact } from './preview-engine'

const PAGE_BREAKS_PIPELINE = 'html-print-css-offset-only'
const PREVIEW_CACHE_LIMITS = {
  fastArtifacts: 6,
  accurateArtifacts: 4,
  pageBreakMaps: 40
} as const

interface ResolvedPreviewContext {
  binding: PreviewProfileBinding
  profile: ExportProfile
  body: string
  documentNode: BinderNode
}

export class PreviewService {
  public constructor(private readonly fileSystem: ProjectFileSystem = new ProjectFileSystem()) {}

  public async getPageBreaks(
    request: GetPageBreaksRequest,
    mode: PreviewMode
  ): Promise<GetPageBreaksResponse> {
    const context = await this.resolvePreviewContext(request.projectPath, request.documentId, request.profileId)
    const capability = previewCapabilities[context.profile.format]
    const cacheKey = computePreviewCacheKey({
      normalizedMarkdown: context.body.replace(/\r\n/g, '\n').trim(),
      serializedProfile: JSON.stringify(context.profile),
      mode,
      schemaVersion: 1
    })
    const pageBreakMap = validatePageBreakMap({
      profileId: context.profile.id,
      format: context.profile.format,
      mode,
      pipeline: PAGE_BREAKS_PIPELINE,
      totalEstimatedPages: capability.supportsPageMarkers ? this.estimateTotalPages(context.body, context.profile.format) : 0,
      breaks: capability.supportsPageMarkers ? this.computeBreaks(context.body, context.profile.format) : [],
      computedAt: new Date().toISOString(),
      cacheKey
    })

    await this.fileSystem.writeJson(request.projectPath, `cache/preview/page-breaks/${cacheKey}.json`, pageBreakMap)
    await this.prunePreviewCacheFiles(request.projectPath, 'cache/preview/page-breaks', PREVIEW_CACHE_LIMITS.pageBreakMaps, `${cacheKey}.json`)

    return {
      binding: context.binding,
      pageBreakMap
    }
  }

  public async renderFast(request: RenderFastRequest, mode: PreviewMode): Promise<RenderFastResponse> {
    return this.runRenderPipeline(request, mode, 'html-print-css')
  }

  public async renderAccurate(request: RenderAccurateRequest, mode: PreviewMode): Promise<RenderAccurateResponse> {
    return this.runRenderPipeline(request, mode, 'pandoc-accurate')
  }

  private async runRenderPipeline(
    request: RenderFastRequest,
    mode: PreviewMode,
    pipeline: PreviewPipeline
  ): Promise<RenderFastResponse> {
    if (!previewModes[mode].liveSplitEnabled) {
      return {
        status: 'error',
        errorMessageKey: 'preview.errors.engineDisabled'
      }
    }

    let context: ResolvedPreviewContext
    try {
      context = await this.resolvePreviewContext(request.projectPath, request.documentId, request.profileId)
    } catch {
      return {
        status: 'error',
        errorMessageKey: 'preview.errors.profileInvalid'
      }
    }

    const startedAt = Date.now()
    const generatedAt = new Date().toISOString()
    const artifact = renderPreviewArtifact({
      profile: context.profile,
      mode,
      pipeline,
      body: context.body,
      generatedAt
    })

    const manifestRelPath = `cache/preview/${pipeline === 'html-print-css' ? 'fast' : 'accurate'}/${artifact.cacheKey}/preview.json`
    let cached = false
    try {
      const existing = await this.fileSystem.readJson<{ cacheKey?: unknown }>(request.projectPath, manifestRelPath)
      cached = typeof existing?.cacheKey === 'string' && existing.cacheKey === artifact.cacheKey
    } catch {
      cached = false
    }

    if (!cached) {
      for (const asset of artifact.pageAssets) {
        await this.fileSystem.writeText(request.projectPath, asset.relativePath, asset.contents)
      }
      await this.fileSystem.writeJson(request.projectPath, manifestRelPath, artifact.preview)
    }
    await this.prunePreviewCacheDirectories(
      request.projectPath,
      pipeline === 'html-print-css' ? 'cache/preview/fast' : 'cache/preview/accurate',
      pipeline === 'html-print-css' ? PREVIEW_CACHE_LIMITS.fastArtifacts : PREVIEW_CACHE_LIMITS.accurateArtifacts,
      artifact.cacheKey
    )

    return {
      status: cached ? 'cached' : 'ready',
      binding: context.binding,
      preview: artifact.preview,
      regeneratedInMs: cached ? 0 : Date.now() - startedAt
    }
  }

  private async resolvePreviewContext(
    projectPath: string,
    documentId: string,
    profileId?: string
  ): Promise<ResolvedPreviewContext> {
    const manifest = validateManifest(await this.fileSystem.readJson(projectPath, 'manifest.json'))
    const binder = validateBinderDocument(await this.fileSystem.readJson(projectPath, 'binder.json'))
    const documentNode = binder.nodes.find(
      (node) => node.documentId === documentId && node.type === 'document' && node.path
    )

    if (!documentNode?.path) {
      throw new Error(`Documento non trovato per preview engine: ${documentId}.`)
    }

    const resolvedProfileId = profileId?.trim() || manifest.defaultExportProfile
    const profile = await this.readExportProfile(projectPath, resolvedProfileId)
    const source = await this.fileSystem.readText(projectPath, documentNode.path)
    const body = this.stripFrontmatter(source)
    const capability = previewCapabilities[profile.format]

    return {
      binding: {
        projectId: manifest.projectId,
        profileId: profile.id,
        format: profile.format,
        supportsPageMarkers: capability.supportsPageMarkers,
        previewKind: capability.previewKind
      },
      profile,
      body,
      documentNode
    }
  }

  private async readExportProfile(projectPath: string, profileId: string): Promise<ExportProfile> {
    return validateExportProfile(await this.fileSystem.readJson(projectPath, `exports/profiles/${profileId}.json`))
  }

  private stripFrontmatter(rawDocument: string): string {
    if (!rawDocument.startsWith('---')) {
      return rawDocument
    }

    const parts = rawDocument.split('---')
    return parts.length < 3 ? rawDocument : parts.slice(2).join('---').trimStart()
  }

  private estimateTotalPages(markdown: string, format: ExportFormat): number {
    if (!markdown.trim()) {
      return 0
    }
    const pageSize = this.getApproximatePageSize(format)
    return Math.max(1, Math.ceil(markdown.length / pageSize))
  }

  private computeBreaks(markdown: string, format: ExportFormat): Array<{ sourceOffset: number; estimatedPageNumber: number }> {
    const pageSize = this.getApproximatePageSize(format)
    const breaks: Array<{ sourceOffset: number; estimatedPageNumber: number }> = []
    let nextOffset = pageSize
    let pageNumber = 1

    while (nextOffset < markdown.length) {
      const resolvedOffset = this.findNearestBoundary(markdown, nextOffset)
      if (resolvedOffset <= 0 || resolvedOffset >= markdown.length) {
        break
      }

      pageNumber += 1
      breaks.push({
        sourceOffset: resolvedOffset,
        estimatedPageNumber: pageNumber
      })
      nextOffset = resolvedOffset + pageSize
    }

    return breaks
  }

  private findNearestBoundary(markdown: string, fromOffset: number): number {
    const forward = markdown.indexOf('\n', fromOffset)
    if (forward !== -1 && forward - fromOffset <= 120) {
      return forward + 1
    }

    const backward = markdown.lastIndexOf('\n', fromOffset)
    if (backward > 0 && fromOffset - backward <= 120) {
      return backward + 1
    }

    return fromOffset
  }

  private getApproximatePageSize(format: ExportFormat): number {
    switch (format) {
      case 'latex':
        return 2900
      case 'odt':
        return 3200
      case 'pdf':
        return 3000
      default:
        return 3000
    }
  }

  private async prunePreviewCacheDirectories(
    projectPath: string,
    relativeDirectory: string,
    maxEntries: number,
    keepDirectoryName: string
  ): Promise<void> {
    await pruneProjectCacheEntries({
      fileSystem: this.fileSystem,
      projectPath,
      relativeDirectory,
      maxEntries,
      keepName: keepDirectoryName,
      kind: 'directory'
    })
  }

  private async prunePreviewCacheFiles(
    projectPath: string,
    relativeDirectory: string,
    maxEntries: number,
    keepFileName: string
  ): Promise<void> {
    await pruneProjectCacheEntries({
      fileSystem: this.fileSystem,
      projectPath,
      relativeDirectory,
      maxEntries,
      keepName: keepFileName,
      kind: 'file'
    })
  }
}
