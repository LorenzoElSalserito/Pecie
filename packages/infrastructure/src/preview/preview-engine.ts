import {
  type ExportFormat,
  type ExportProfile,
  type PaginatedPreview,
  type PreviewMode,
  previewCapabilities,
  validatePaginatedPreview
} from '@pecie/schemas'

import { computePreviewCacheKey } from './cache-key'

export type PreviewPipeline = 'html-print-css' | 'pandoc-accurate'

export const previewPipelines = {
  'html-print-css': {
    kind: 'fast',
    averagePageSize: 3000,
    schemaVersion: 1
  },
  'pandoc-accurate': {
    kind: 'accurate',
    averagePageSize: 2400,
    schemaVersion: 1
  }
} as const satisfies Record<
  PreviewPipeline,
  { kind: 'fast' | 'accurate'; averagePageSize: number; schemaVersion: number }
>

export interface RenderPreviewInput {
  profile: ExportProfile
  mode: PreviewMode
  pipeline: PreviewPipeline
  body: string
  generatedAt: string
  cacheRoot?: string
}

export interface RenderPreviewArtifact {
  cacheKey: string
  preview: PaginatedPreview
  pageAssets: Array<{
    relativePath: string
    contents: string
  }>
}

export function renderPreviewArtifact(input: RenderPreviewInput): RenderPreviewArtifact {
  const pipelineConfig = previewPipelines[input.pipeline]
  const capability = previewCapabilities[input.profile.format]
  const normalizedBody = input.body.replace(/\r\n/g, '\n').trim()

  const cacheKey = computePreviewCacheKey({
    normalizedMarkdown: normalizedBody,
    serializedProfile: JSON.stringify({ profile: input.profile, pipeline: input.pipeline }),
    mode: input.mode,
    schemaVersion: pipelineConfig.schemaVersion
  })

  const cacheDirectory = input.cacheRoot?.trim() || `cache/preview/${pipelineConfig.kind}/${cacheKey}`
  const splits = computePageSplits(normalizedBody, capability.paginated, pipelineConfig.averagePageSize)
  const warnings: string[] = []

  if (!capability.paginated) {
    warnings.push('format-not-paginated')
  }
  if (normalizedBody.length === 0) {
    warnings.push('document-empty')
  }

  const pages = splits.map((split, index) => ({
    pageNumber: index + 1,
    previewAssetRelPath: `${cacheDirectory}/page-${index + 1}.html`,
    sourceOffsetStart: split.startOffset,
    sourceOffsetEnd: split.endOffset
  }))

  const pageAssets = splits.map((split, index) => ({
    relativePath: `${cacheDirectory}/page-${index + 1}.html`,
    contents: renderPageAsset({
      pageNumber: index + 1,
      totalPages: splits.length,
      pipeline: input.pipeline,
      profileId: input.profile.id,
      sourceSlice: normalizedBody.slice(split.startOffset, split.endOffset)
    })
  }))

  const preview = validatePaginatedPreview({
    profileId: input.profile.id,
    format: input.profile.format,
    mode: input.mode,
    paginated: capability.paginated,
    totalPages: pages.length,
    pages,
    generatedAt: input.generatedAt,
    cacheKey,
    warnings
  })

  return {
    cacheKey,
    preview,
    pageAssets
  }
}

interface PageSplit {
  startOffset: number
  endOffset: number
}

function computePageSplits(body: string, paginated: boolean, averagePageSize: number): PageSplit[] {
  if (body.length === 0) {
    return []
  }

  if (!paginated) {
    return [{ startOffset: 0, endOffset: body.length }]
  }

  const splits: PageSplit[] = []
  let cursor = 0
  while (cursor < body.length) {
    const candidate = cursor + averagePageSize
    const endOffset = candidate >= body.length ? body.length : findNearestBoundary(body, candidate)
    splits.push({ startOffset: cursor, endOffset })
    if (endOffset <= cursor) {
      break
    }
    cursor = endOffset
  }

  return splits
}

function findNearestBoundary(body: string, targetOffset: number): number {
  if (targetOffset >= body.length) {
    return body.length
  }
  const forward = body.indexOf('\n', targetOffset)
  if (forward !== -1 && forward - targetOffset <= 120) {
    return forward + 1
  }
  const backward = body.lastIndexOf('\n', targetOffset)
  if (backward > 0 && targetOffset - backward <= 120) {
    return backward + 1
  }
  return targetOffset
}

function renderPageAsset(input: {
  pageNumber: number
  totalPages: number
  pipeline: PreviewPipeline
  profileId: string
  sourceSlice: string
}): string {
  const escaped = escapeHtml(input.sourceSlice)
  return [
    '<!doctype html>',
    `<html lang="it"><head><meta charset="utf-8"><title>Pecie preview ${input.pageNumber}/${input.totalPages}</title></head>`,
    `<body data-pipeline="${input.pipeline}" data-profile="${escapeAttribute(input.profileId)}">`,
    `<main role="main" aria-label="Pagina ${input.pageNumber} di ${input.totalPages}"><pre>${escaped}</pre></main>`,
    '</body></html>'
  ].join('')
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (char) => {
    if (char === '&') return '&amp;'
    if (char === '<') return '&lt;'
    return '&gt;'
  })
}

function escapeAttribute(value: string): string {
  return value.replace(/["&<>]/g, (char) => {
    if (char === '"') return '&quot;'
    if (char === '&') return '&amp;'
    if (char === '<') return '&lt;'
    return '&gt;'
  })
}

export function pipelineForFormat(format: ExportFormat, requestedPipeline: PreviewPipeline): PreviewPipeline {
  const capability = previewCapabilities[format]
  if (capability.previewKind === 'visual') {
    return requestedPipeline
  }
  return 'html-print-css'
}
