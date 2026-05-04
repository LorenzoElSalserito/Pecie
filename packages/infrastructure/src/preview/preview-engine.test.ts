import { describe, expect, it } from 'vitest'

import type { ExportProfile } from '@pecie/schemas'

import { previewPipelines, renderPreviewArtifact } from './preview-engine'

function makeProfile(format: ExportProfile['format'], overrides: Partial<ExportProfile> = {}): ExportProfile {
  return {
    id: `${format}-fixture`,
    schemaVersion: 1,
    label: `${format} fixture`,
    format,
    include: {},
    output: {
      filenameFrom: 'project.title',
      directory: 'exports/out'
    },
    ...overrides
  } as ExportProfile
}

const longBody = Array.from({ length: 12 }, (_, index) => `Paragrafo ${index + 1}\n`.repeat(80)).join('\n')

describe('renderPreviewArtifact', () => {
  it('produces a single page for non paginated formats and flags the warning', () => {
    const artifact = renderPreviewArtifact({
      profile: makeProfile('md'),
      mode: 'performance',
      pipeline: 'html-print-css',
      body: longBody,
      generatedAt: '2026-04-14T10:00:00.000Z'
    })

    expect(artifact.preview.paginated).toBe(false)
    expect(artifact.preview.totalPages).toBe(1)
    expect(artifact.preview.warnings).toContain('format-not-paginated')
    expect(artifact.pageAssets).toHaveLength(1)
  })

  it('treats html previews as visual and paginated', () => {
    const artifact = renderPreviewArtifact({
      profile: makeProfile('html'),
      mode: 'performance',
      pipeline: 'html-print-css',
      body: longBody,
      generatedAt: '2026-04-14T10:00:00.000Z'
    })

    expect(artifact.preview.paginated).toBe(true)
    expect(artifact.preview.totalPages).toBeGreaterThan(1)
    expect(artifact.preview.warnings).not.toContain('format-not-paginated')
  })

  it('paginates visual formats deterministically', () => {
    const first = renderPreviewArtifact({
      profile: makeProfile('pdf', { id: 'thesis-pdf' }),
      mode: 'full',
      pipeline: 'pandoc-accurate',
      body: longBody,
      generatedAt: '2026-04-14T10:00:00.000Z'
    })
    const second = renderPreviewArtifact({
      profile: makeProfile('pdf', { id: 'thesis-pdf' }),
      mode: 'full',
      pipeline: 'pandoc-accurate',
      body: longBody,
      generatedAt: '2026-04-14T11:00:00.000Z'
    })

    expect(first.preview.paginated).toBe(true)
    expect(first.preview.totalPages).toBeGreaterThan(1)
    expect(first.cacheKey).toBe(second.cacheKey)
    expect(first.preview.pages.map((page) => page.sourceOffsetEnd)).toEqual(
      second.preview.pages.map((page) => page.sourceOffsetEnd)
    )
  })

  it('returns different cache keys for fast vs accurate pipelines on the same body', () => {
    const fast = renderPreviewArtifact({
      profile: makeProfile('pdf', { id: 'thesis-pdf' }),
      mode: 'performance',
      pipeline: 'html-print-css',
      body: longBody,
      generatedAt: '2026-04-14T10:00:00.000Z'
    })
    const accurate = renderPreviewArtifact({
      profile: makeProfile('pdf', { id: 'thesis-pdf' }),
      mode: 'performance',
      pipeline: 'pandoc-accurate',
      body: longBody,
      generatedAt: '2026-04-14T10:00:00.000Z'
    })

    expect(fast.cacheKey).not.toBe(accurate.cacheKey)
  })

  it('writes page assets only under cache/preview/', () => {
    const artifact = renderPreviewArtifact({
      profile: makeProfile('pdf', { id: 'thesis-pdf' }),
      mode: 'performance',
      pipeline: 'html-print-css',
      body: longBody,
      generatedAt: '2026-04-14T10:00:00.000Z'
    })

    expect(artifact.pageAssets.length).toBeGreaterThan(0)
    for (const asset of artifact.pageAssets) {
      expect(asset.relativePath.startsWith('cache/preview/fast/')).toBe(true)
      expect(asset.contents.startsWith('<!doctype html>')).toBe(true)
    }
  })

  it('escapes HTML special characters in the rendered page assets', () => {
    const artifact = renderPreviewArtifact({
      profile: makeProfile('pdf', { id: 'thesis-pdf' }),
      mode: 'performance',
      pipeline: 'html-print-css',
      body: 'Citazione <script>alert("x")</script> & co.',
      generatedAt: '2026-04-14T10:00:00.000Z'
    })

    const [first] = artifact.pageAssets
    expect(first.contents).toContain('&lt;script&gt;')
    expect(first.contents).toContain('&amp; co.')
    expect(first.contents).not.toContain('<script>alert')
  })

  it('exposes deterministic averagePageSize values per pipeline', () => {
    expect(previewPipelines['html-print-css'].kind).toBe('fast')
    expect(previewPipelines['pandoc-accurate'].kind).toBe('accurate')
    expect(previewPipelines['pandoc-accurate'].averagePageSize).toBeLessThan(
      previewPipelines['html-print-css'].averagePageSize
    )
  })

  it('produces an empty pages array for an empty document', () => {
    const artifact = renderPreviewArtifact({
      profile: makeProfile('pdf'),
      mode: 'performance',
      pipeline: 'html-print-css',
      body: '   \n\n  ',
      generatedAt: '2026-04-14T10:00:00.000Z'
    })

    expect(artifact.preview.totalPages).toBe(0)
    expect(artifact.preview.pages).toEqual([])
    expect(artifact.preview.warnings).toContain('document-empty')
  })
})
