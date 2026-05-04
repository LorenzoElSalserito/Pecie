import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ProjectFileSystem } from '../fs/project-file-system'
import { ProjectService } from '../project/project-service'
import { computePreviewCacheKey } from './cache-key'
import { PreviewService } from './preview-service'

const noopIndexAdapter = {
  initialize: () => undefined,
  upsert: () => undefined,
  upsertAttachment: () => undefined,
  removeAttachment: () => undefined,
  remove: () => undefined,
  search: () => ({ nodes: [], content: [], attachments: [] })
}

describe('PreviewService', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { force: true, recursive: true })))
  })

  async function createProject(template: Parameters<ProjectService['createProject']>[0]['template']) {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-preview-service-'))
    cleanupPaths.push(baseDirectory)
    const projectService = new ProjectService(undefined, noopIndexAdapter)
    return projectService.createProject({
      directory: baseDirectory,
      projectName: `${template}-preview`,
      title: `${template} preview`,
      language: 'it-IT',
      template,
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      }
    })
  }

  it('computes deterministic cache keys', () => {
    const input = {
      normalizedMarkdown: '# Test\n\nBody',
      serializedProfile: '{"id":"thesis-pdf"}',
      mode: 'ultra-performance' as const,
      schemaVersion: 1
    }

    expect(computePreviewCacheKey(input)).toBe(computePreviewCacheKey(input))
    expect(
      computePreviewCacheKey({
        ...input,
        mode: 'performance'
      })
    ).not.toBe(computePreviewCacheKey(input))
  })

  it('returns page markers for paginated profiles even in ultra-performance mode', async () => {
    const project = await createProject('thesis')
    const previewService = new PreviewService()
    const documentNode = project.binder.nodes.find((node) => node.type === 'document' && node.documentId)

    expect(documentNode?.documentId).toBeTruthy()

    const response = await previewService.getPageBreaks(
      {
        projectPath: project.projectPath,
        documentId: documentNode!.documentId!,
        profileId: 'thesis-pdf'
      },
      'ultra-performance'
    )

    expect(response.binding.supportsPageMarkers).toBe(true)
    expect(response.pageBreakMap.mode).toBe('ultra-performance')
    expect(response.pageBreakMap.pipeline).toBe('html-print-css-offset-only')
  })

  it('degrades gracefully for non paginated profiles', async () => {
    const project = await createProject('blank')
    const previewService = new PreviewService()
    const documentNode = project.binder.nodes.find((node) => node.type === 'document' && node.documentId)

    const response = await previewService.getPageBreaks(
      {
        projectPath: project.projectPath,
        documentId: documentNode!.documentId!,
        profileId: 'blank-docx'
      },
      'performance'
    )

    expect(response.binding.supportsPageMarkers).toBe(false)
    expect(response.pageBreakMap.totalEstimatedPages).toBe(0)
    expect(response.pageBreakMap.breaks).toEqual([])
  })

  it('renderFast refuses to run in ultra-performance mode with a structured i18n key', async () => {
    const project = await createProject('thesis')
    const previewService = new PreviewService()
    const documentNode = project.binder.nodes.find((node) => node.type === 'document' && node.documentId)

    const response = await previewService.renderFast(
      {
        projectPath: project.projectPath,
        documentId: documentNode!.documentId!
      },
      'ultra-performance'
    )

    expect(response.status).toBe('error')
    expect(response.errorMessageKey).toBe('preview.errors.engineDisabled')
    expect(response.preview).toBeUndefined()
  })

  it('renderFast produces a validated PaginatedPreview and writes assets only under cache/preview/', async () => {
    const project = await createProject('thesis')
    const previewService = new PreviewService()
    const documentNode = project.binder.nodes.find((node) => node.type === 'document' && node.documentId)

    const response = await previewService.renderFast(
      {
        projectPath: project.projectPath,
        documentId: documentNode!.documentId!,
        profileId: 'thesis-pdf'
      },
      'performance'
    )

    expect(response.status).toBe('ready')
    expect(response.preview?.profileId).toBe('thesis-pdf')
    expect(response.binding?.supportsPageMarkers).toBe(true)

    const cacheKey = response.preview!.cacheKey
    const previewJsonPath = path.join(project.projectPath, 'cache/preview/fast', cacheKey, 'preview.json')
    const fileContent = await readFile(previewJsonPath, 'utf8')
    const parsed = JSON.parse(fileContent) as { cacheKey: string }
    expect(parsed.cacheKey).toBe(cacheKey)
  })

  it('renderFast returns status cached on the second call with identical inputs', async () => {
    const project = await createProject('thesis')
    const previewService = new PreviewService()
    const documentNode = project.binder.nodes.find((node) => node.type === 'document' && node.documentId)

    const first = await previewService.renderFast(
      {
        projectPath: project.projectPath,
        documentId: documentNode!.documentId!,
        profileId: 'thesis-pdf'
      },
      'performance'
    )
    const second = await previewService.renderFast(
      {
        projectPath: project.projectPath,
        documentId: documentNode!.documentId!,
        profileId: 'thesis-pdf'
      },
      'performance'
    )

    expect(first.status).toBe('ready')
    expect(second.status).toBe('cached')
    expect(second.preview?.cacheKey).toBe(first.preview?.cacheKey)
    expect(second.regeneratedInMs).toBe(0)
  })

  it('prunes fast preview artifacts when the cache exceeds its retention limit', async () => {
    const project = await createProject('thesis')
    const fileSystem = new ProjectFileSystem()
    const previewService = new PreviewService(fileSystem)
    const documentNode = project.binder.nodes.find((node) => node.type === 'document' && node.documentId && node.path)
    const generatedKeys: string[] = []

    for (let revision = 0; revision < 9; revision += 1) {
      await fileSystem.writeText(
        project.projectPath,
        documentNode!.path!,
        `---\ntitle: Preview cache ${revision}\n---\n# Revision ${revision}\n\n${'Body '.repeat(700)}${revision}`
      )
      const response = await previewService.renderFast(
        {
          projectPath: project.projectPath,
          documentId: documentNode!.documentId!,
          profileId: 'thesis-pdf'
        },
        'performance'
      )
      generatedKeys.push(response.preview!.cacheKey)
    }

    const cacheEntries = await fileSystem.listEntries(project.projectPath, 'cache/preview/fast')
    const artifactDirectories = cacheEntries.filter((entry) => entry.isDirectory())
    expect(artifactDirectories.length).toBeLessThanOrEqual(6)
    expect(artifactDirectories.length).toBeLessThan(generatedKeys.length)
    await expect(
      fileSystem.statEntry(project.projectPath, `cache/preview/fast/${generatedKeys.at(-1)}/preview.json`)
    ).resolves.toBeTruthy()
  })

  it('renderAccurate uses the pandoc-accurate cache directory and a different cache key', async () => {
    const project = await createProject('thesis')
    const previewService = new PreviewService()
    const documentNode = project.binder.nodes.find((node) => node.type === 'document' && node.documentId)

    const fast = await previewService.renderFast(
      {
        projectPath: project.projectPath,
        documentId: documentNode!.documentId!,
        profileId: 'thesis-pdf'
      },
      'performance'
    )
    const accurate = await previewService.renderAccurate(
      {
        projectPath: project.projectPath,
        documentId: documentNode!.documentId!,
        profileId: 'thesis-pdf'
      },
      'full'
    )

    expect(fast.status).toBe('ready')
    expect(accurate.status).toBe('ready')
    expect(accurate.preview?.cacheKey).not.toBe(fast.preview?.cacheKey)

    const accuratePath = path.join(
      project.projectPath,
      'cache/preview/accurate',
      accurate.preview!.cacheKey,
      'preview.json'
    )
    const fileContent = await readFile(accuratePath, 'utf8')
    expect(JSON.parse(fileContent).cacheKey).toBe(accurate.preview!.cacheKey)
  })

  it('prunes accurate preview artifacts with a smaller retention limit', async () => {
    const project = await createProject('thesis')
    const fileSystem = new ProjectFileSystem()
    const previewService = new PreviewService(fileSystem)
    const documentNode = project.binder.nodes.find((node) => node.type === 'document' && node.documentId && node.path)
    const generatedKeys: string[] = []

    for (let revision = 0; revision < 7; revision += 1) {
      await fileSystem.writeText(
        project.projectPath,
        documentNode!.path!,
        `---\ntitle: Accurate cache ${revision}\n---\n# Accurate ${revision}\n\n${'Body '.repeat(700)}${revision}`
      )
      const response = await previewService.renderAccurate(
        {
          projectPath: project.projectPath,
          documentId: documentNode!.documentId!,
          profileId: 'thesis-pdf'
        },
        'full'
      )
      generatedKeys.push(response.preview!.cacheKey)
    }

    const cacheEntries = await fileSystem.listEntries(project.projectPath, 'cache/preview/accurate')
    const artifactDirectories = cacheEntries.filter((entry) => entry.isDirectory())
    expect(artifactDirectories.length).toBeLessThanOrEqual(4)
    expect(artifactDirectories.length).toBeLessThan(generatedKeys.length)
    await expect(
      fileSystem.statEntry(project.projectPath, `cache/preview/accurate/${generatedKeys.at(-1)}/preview.json`)
    ).resolves.toBeTruthy()
  })

  it('prunes page-break maps when saved markers exceed the retention limit', async () => {
    const project = await createProject('thesis')
    const fileSystem = new ProjectFileSystem()
    const previewService = new PreviewService(fileSystem)
    const documentNode = project.binder.nodes.find((node) => node.type === 'document' && node.documentId && node.path)
    const generatedKeys: string[] = []

    for (let revision = 0; revision < 44; revision += 1) {
      await fileSystem.writeText(
        project.projectPath,
        documentNode!.path!,
        `---\ntitle: Break map ${revision}\n---\n# Break map ${revision}\n\n${'Body '.repeat(700)}${revision}`
      )
      const response = await previewService.getPageBreaks(
        {
          projectPath: project.projectPath,
          documentId: documentNode!.documentId!,
          profileId: 'thesis-pdf'
        },
        'performance'
      )
      generatedKeys.push(response.pageBreakMap.cacheKey)
    }

    const cacheEntries = await fileSystem.listEntries(project.projectPath, 'cache/preview/page-breaks')
    const mapFiles = cacheEntries.filter((entry) => entry.isFile())
    expect(mapFiles.length).toBeLessThanOrEqual(40)
    expect(mapFiles.length).toBeLessThan(generatedKeys.length)
    await expect(
      fileSystem.statEntry(project.projectPath, `cache/preview/page-breaks/${generatedKeys.at(-1)}.json`)
    ).resolves.toBeTruthy()
  })

  it('renderFast returns a structured error when the requested profile is missing', async () => {
    const project = await createProject('thesis')
    const previewService = new PreviewService()
    const documentNode = project.binder.nodes.find((node) => node.type === 'document' && node.documentId)

    const response = await previewService.renderFast(
      {
        projectPath: project.projectPath,
        documentId: documentNode!.documentId!,
        profileId: 'profile-that-does-not-exist'
      },
      'performance'
    )

    expect(response.status).toBe('error')
    expect(response.errorMessageKey).toBe('preview.errors.profileInvalid')
  })
})
