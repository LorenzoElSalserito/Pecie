import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ProjectFileSystem } from '../fs/project-file-system'
import { ProjectService } from './project-service'
import { ExportService } from './export-service'
import { ExportRuntimeResolver } from '../export/export-runtime-resolver'

const noopIndexAdapter = {
  initialize: () => undefined,
  upsert: () => undefined,
  upsertAttachment: () => undefined,
  removeAttachment: () => undefined,
  remove: () => undefined,
  search: () => ({ nodes: [], content: [], attachments: [] })
}

function createRuntimeResolverStub(
  binaryPath = '/bundled/runtime/pandoc',
  onResolve?: (request: { capabilityId: string; allowSystemFallback: boolean }) => void
): ExportRuntimeResolver {
  return {
    getRuntimeCapabilities: async () => ({
      capabilities: []
    }),
    resolveBinary: async (request: { capabilityId: string; allowSystemFallback: boolean }) => {
      onResolve?.(request)
      return {
        capabilityId: 'pandoc',
        source: 'bundled',
        executablePath: binaryPath
      }
    }
  } as unknown as ExportRuntimeResolver
}

describe('ExportService', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { force: true, recursive: true })))
  })

  async function createProject(template: Parameters<ProjectService['createProject']>[0]['template'] = 'thesis') {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-export-service-'))
    cleanupPaths.push(baseDirectory)

    const service = new ProjectService(undefined, noopIndexAdapter)
    return service.createProject({
      directory: baseDirectory,
      projectName: `${template}-demo`,
      title: `${template} demo`,
      language: 'it-IT',
      template,
      authorProfile: {
        name: 'Fixture Author',
        role: 'writer',
        preferredLanguage: 'it-IT'
      }
    })
  }

  it('lists valid export profiles and exposes the project default', async () => {
    const project = await createProject('thesis')
    const exportService = new ExportService()

    const response = await exportService.listProfiles({
      projectPath: project.projectPath
    })

    expect(response.defaultProfileId).toBe('thesis-pdf')
    expect(response.diagnostics).toEqual([])
    expect(response.profiles.some((profile) => profile.id === 'thesis-pdf' && profile.isDefault)).toBe(true)
    expect(
      response.profiles.some(
        (profile) => profile.id === 'thesis-markdown-pdf' && profile.engine === 'weasyprint'
      )
    ).toBe(true)
    expect(new Set(response.profiles.map((profile) => profile.format))).toEqual(
      new Set(['pdf', 'docx', 'odt', 'rtf', 'epub', 'html', 'latex', 'jats', 'tei', 'md', 'txt'])
    )
  })

  it('backfills missing profiles before listing them', async () => {
    const project = await createProject('blank')
    const fileSystem = new ProjectFileSystem()
    const exportService = new ExportService(fileSystem)

    await fileSystem.deleteEntry(project.projectPath, 'exports/profiles/blank-html.json')
    await fileSystem.deleteEntry(project.projectPath, 'exports/profiles/blank-jats.json')
    await fileSystem.deleteEntry(project.projectPath, 'exports/profiles/blank-tei.json')

    const response = await exportService.listProfiles({
      projectPath: project.projectPath
    })

    expect(response.profiles.some((profile) => profile.id === 'blank-html')).toBe(true)
    expect(response.profiles.some((profile) => profile.id === 'blank-jats')).toBe(true)
    expect(response.profiles.some((profile) => profile.id === 'blank-tei')).toBe(true)
  })

  it('renders export preview artifacts only under cache/preview/export-step', async () => {
    const project = await createProject('blank')
    const exportService = new ExportService()

    const response = await exportService.renderPreview(
      {
        projectPath: project.projectPath,
        profileId: 'blank-html',
        scope: 'whole-project'
      },
      'performance'
    )

    expect(response.status).toBe('ready')
    expect(response.previewKind).toBe('visual')
    expect(response.preview?.pages.every((page) => page.previewAssetRelPath.startsWith('cache/preview/export-step/'))).toBe(true)
  })

  it('prunes stale export preview artifacts after repeated preview renders', async () => {
    const project = await createProject('blank')
    const fileSystem = new ProjectFileSystem()
    const exportService = new ExportService(fileSystem)
    const documentNode = project.binder.nodes.find((node) => node.type === 'document' && node.path)
    const generatedKeys: string[] = []

    for (let revision = 0; revision < 11; revision += 1) {
      await fileSystem.writeText(
        project.projectPath,
        documentNode!.path!,
        `---\ntitle: Export preview ${revision}\n---\n# Export preview ${revision}\n\n${'Body '.repeat(700)}${revision}`
      )
      const response = await exportService.renderPreview(
        {
          projectPath: project.projectPath,
          profileId: 'blank-html',
          scope: 'whole-project'
        },
        'performance'
      )
      generatedKeys.push(response.preview!.cacheKey)
    }

    const cacheEntries = await fileSystem.listEntries(project.projectPath, 'cache/preview/export-step')
    const artifactDirectories = cacheEntries.filter((entry) => entry.isDirectory())
    expect(artifactDirectories.length).toBeLessThanOrEqual(8)
    expect(artifactDirectories.length).toBeLessThan(generatedKeys.length)
    await expect(
      fileSystem.statEntry(project.projectPath, `cache/preview/export-step/${generatedKeys.at(-1)}/preview.json`)
    ).resolves.toBeTruthy()
  })

  it('renders JATS preview text from the structured export artifact', async () => {
    const project = await createProject('blank')
    const exportService = new ExportService(
      new ProjectFileSystem(),
      async (_file, args) => {
        const outputIndex = args.findIndex((arg) => arg === '-o')
        const outputPath = args[outputIndex + 1]
        await writeFile(outputPath, '<article><body><sec><p>Blank export preview</p></sec></body></article>', 'utf8')
        return {}
      },
      createRuntimeResolverStub()
    )

    const response = await exportService.renderPreview(
      {
        projectPath: project.projectPath,
        profileId: 'blank-jats',
        scope: 'whole-project'
      },
      'performance'
    )

    expect(response.status).toBe('ready')
    expect(response.previewKind).toBe('text')
    expect(response.previewText).toContain('<article>')
    expect(response.previewText).toContain('Blank export preview')
  })

  it('renders EPUB preview as continuous reader text', async () => {
    const project = await createProject('blank')
    const exportService = new ExportService()

    const response = await exportService.renderPreview(
      {
        projectPath: project.projectPath,
        profileId: 'blank-epub',
        scope: 'whole-project'
      },
      'performance'
    )

    expect(response.status).toBe('ready')
    expect(response.previewKind).toBe('reader')
    expect(response.previewText).toBeDefined()
    expect(response.previewText).not.toContain('# ')
  })

  it('exports markdown using a profile and excludes documents flagged out of export', async () => {
    const project = await createProject('blank')
    const fileSystem = new ProjectFileSystem()
    const outputPath = path.join(project.projectPath, 'exports/out/blank-export.md')
    const noteNode = project.binder.nodes.find((node) => node.path?.includes('research/notes/'))
    let capturedPayload = ''

    const exportService = new ExportService(
      fileSystem,
      async (_file, args) => {
        const inputIndex = 0
        const outputIndex = args.findIndex((arg) => arg === '-o')
        const inputPath = args[inputIndex]
        const targetPath = args[outputIndex + 1]
        const payload = await readFile(inputPath, 'utf8')
        capturedPayload = payload
        await writeFile(targetPath, payload, 'utf8')
        return {}
      },
      createRuntimeResolverStub()
    )

    expect(noteNode?.path).toBeTruthy()

    await fileSystem.writeJson(project.projectPath, 'exports/profiles/test-md.json', {
      id: 'test-md',
      schemaVersion: 1,
      label: 'Markdown workspace export',
      format: 'md',
      include: {
        excludeFrontmatter: {
          includeInExport: false
        }
      },
      output: {
        filenameFrom: 'project.title',
        directory: 'exports/out'
      }
    })
    await fileSystem.writeText(
      project.projectPath,
      noteNode?.path ?? 'research/notes/test.md',
      ['---', 'title: Nota interna', 'includeInExport: false', '---', '', 'MARCATORE-DA-ESCLUDERE'].join('\n')
    )

    const response = await exportService.exportDocument({
      projectPath: project.projectPath,
      profileId: 'test-md',
      format: 'md',
      outputPath,
      scope: 'whole-project'
    })

    expect(response.success).toBe(true)
    const exported = await readFile(outputPath, 'utf8')
    expect(capturedPayload).not.toContain('MARCATORE-DA-ESCLUDERE')
    expect(exported).toContain('blank demo')
    expect(exported).not.toContain('MARCATORE-DA-ESCLUDERE')
  })

  it('exports markdown through pandoc so citations and bibliography can be materialized', async () => {
    const project = await createProject('blank')
    const outputPath = path.join(project.projectPath, 'exports/out/blank-native.md')
    let runnerInvoked = false
    const exportService = new ExportService(
      new ProjectFileSystem(),
      async (_file, args) => {
        runnerInvoked = true
        const outputIndex = args.findIndex((arg) => arg === '-o')
        const targetPath = args[outputIndex + 1]
        await writeFile(targetPath, '# Exported through pandoc\n\nReferences\n\n- Alpha Source\n', 'utf8')
        return {}
      },
      createRuntimeResolverStub()
    )

    const response = await exportService.exportDocument({
      projectPath: project.projectPath,
      profileId: 'blank-md',
      format: 'md',
      outputPath,
      scope: 'whole-project'
    })

    expect(response.success).toBe(true)
    expect(runnerInvoked).toBe(true)
    expect(await readFile(outputPath, 'utf8')).toContain('Alpha Source')
  })

  it('builds markdown-style pdf exports with weasyprint and css theme assets', async () => {
    const project = await createProject('blank')
    let capturedArgs: string[] = []
    const outputPath = path.join(project.projectPath, 'exports/out/blank-markdown.pdf')
    const exportService = new ExportService(
      new ProjectFileSystem(),
      async (_file, args) => {
        capturedArgs = args
        await writeFile(outputPath, '%PDF-1.7\n', 'utf8')
        return {}
      },
      createRuntimeResolverStub('/bundled/runtime/pandoc')
    )

    const response = await exportService.exportDocument({
      projectPath: project.projectPath,
      profileId: 'blank-markdown-pdf',
      format: 'pdf',
      outputPath,
      scope: 'whole-project'
    })

    expect(response.success).toBe(true)
    expect(capturedArgs).toContain('--pdf-engine=weasyprint')
    expect(capturedArgs).toContain('--standalone')
    expect(capturedArgs).toContain('--css')
    expect(capturedArgs[capturedArgs.indexOf('--css') + 1]).toContain('exports/themes/github-markdown.css')
  })

  it('uses the runtime resolver to select the pandoc executable', async () => {
    const project = await createProject('blank')
    let capturedBinary = ''
    let capturedResolveRequest: { capabilityId: string; allowSystemFallback: boolean } | undefined
    const outputPath = path.join(project.projectPath, 'exports/out/blank-export.docx')
    const exportService = new ExportService(
      new ProjectFileSystem(),
      async (file) => {
        capturedBinary = file
        await writeFile(outputPath, 'docx', 'utf8')
        return {}
      },
      createRuntimeResolverStub('/opt/pecie/runtime/pandoc', (request) => {
        capturedResolveRequest = request
      })
    )

    const response = await exportService.exportDocument({
      projectPath: project.projectPath,
      profileId: 'blank-docx',
      format: 'docx',
      outputPath,
      scope: 'whole-project'
    })

    expect(response.success).toBe(true)
    expect(capturedBinary).toBe('/opt/pecie/runtime/pandoc')
    expect(capturedResolveRequest).toEqual({
      capabilityId: 'pandoc',
      allowSystemFallback: false
    })
  })

  it('rejects final exports outside the canonical exports/out directory', async () => {
    const project = await createProject('blank')
    const exportService = new ExportService()

    const response = await exportService.exportDocument({
      projectPath: project.projectPath,
      profileId: 'blank-docx',
      format: 'md',
      outputPath: path.join(path.dirname(project.projectPath), 'outside.md'),
      scope: 'whole-project'
    })

    expect(response.success).toBe(false)
    expect(response.log[0]).toMatch(/export-write-guard/i)
  })

  it('normalizes pandoc template errors with file and line information', async () => {
    const project = await createProject('thesis')
    const outputPath = path.join(project.projectPath, 'exports/out/thesis-preview.pdf')
    const exportService = new ExportService(
      new ProjectFileSystem(),
      async () => {
        const error = new Error('pandoc failed') as Error & { stderr?: string }
        error.stderr = 'Error at exports/templates/thesis/default.tex:27: Undefined control sequence'
        throw error
      },
      createRuntimeResolverStub()
    )

    const response = await exportService.exportDocument({
      projectPath: project.projectPath,
      profileId: 'thesis-pdf',
      format: 'pdf',
      outputPath,
      scope: 'whole-project'
    })

    expect(response.success).toBe(false)
    expect(response.log[0]).toContain('exports/templates/thesis/default.tex')
    expect(response.log[0]).toContain('riga 27')
    expect(response.log[0]).toContain('Undefined control sequence')
  })

  it('normalizes latex errors that expose the failing line as l.<n>', async () => {
    const project = await createProject('thesis')
    const outputPath = path.join(project.projectPath, 'exports/out/thesis-preview.pdf')
    const exportService = new ExportService(
      new ProjectFileSystem(),
      async () => {
        const error = new Error('pandoc failed') as Error & { stderr?: string }
        error.stderr = [
          '! LaTeX Error: Missing \\begin{document}.',
          'exports/templates/thesis/default.tex',
          'l.41 \\maketitle'
        ].join('\n')
        throw error
      },
      createRuntimeResolverStub()
    )

    const response = await exportService.exportDocument({
      projectPath: project.projectPath,
      profileId: 'thesis-pdf',
      format: 'pdf',
      outputPath,
      scope: 'whole-project'
    })

    expect(response.success).toBe(false)
    expect(response.log[0]).toContain('exports/templates/thesis/default.tex')
    expect(response.log[0]).toContain('riga 41')
    expect(response.log[0]).toMatch(/Missing \\begin\{document\}/)
  })

  it('reports invalid export profiles in diagnostics', async () => {
    const project = await createProject('blank')
    const fileSystem = new ProjectFileSystem()
    const exportService = new ExportService(fileSystem)

    await fileSystem.writeJson(project.projectPath, 'exports/profiles/broken.json', {
      id: 'broken',
      schemaVersion: 1,
      label: 'Broken profile',
      format: 'pdf',
      engine: 'xelatex',
      include: {},
      template: 'exports/templates/missing.tex',
      output: {
        filenameFrom: 'project.title',
        directory: 'exports/out'
      }
    })

    const response = await exportService.listProfiles({
      projectPath: project.projectPath
    })

    expect(response.diagnostics.some((diagnostic) => diagnostic.profileId === 'broken')).toBe(true)
  })

  it('flags profiles whose format is not in the registry', async () => {
    const project = await createProject('blank')
    const fileSystem = new ProjectFileSystem()
    const exportService = new ExportService(fileSystem)

    await fileSystem.writeJson(project.projectPath, 'exports/profiles/unknown-format.json', {
      id: 'unknown-format',
      schemaVersion: 1,
      label: 'Unknown format profile',
      format: 'wordstar',
      include: {},
      output: {
        filenameFrom: 'project.title',
        directory: 'exports/out'
      }
    })

    const response = await exportService.listProfiles({
      projectPath: project.projectPath
    })

    const diagnostic = response.diagnostics.find((entry) => entry.profileId === 'unknown-format')
    expect(diagnostic).toBeDefined()
    expect(diagnostic?.message).toMatch(/format.*non supportato/i)
  })

  it('flags profiles whose engine is not allowed for the chosen format', async () => {
    const project = await createProject('blank')
    const fileSystem = new ProjectFileSystem()
    const exportService = new ExportService(fileSystem)

    await fileSystem.writeJson(project.projectPath, 'exports/profiles/bad-engine.json', {
      id: 'bad-engine',
      schemaVersion: 1,
      label: 'Bad engine profile',
      format: 'docx',
      engine: 'xelatex',
      include: {},
      output: {
        filenameFrom: 'project.title',
        directory: 'exports/out'
      }
    })

    const response = await exportService.listProfiles({
      projectPath: project.projectPath
    })

    const diagnostic = response.diagnostics.find((entry) => entry.profileId === 'bad-engine')
    expect(diagnostic).toBeDefined()
    expect(diagnostic?.message).toMatch(/engine.*non valido/i)
  })

  it('flags profiles whose template file is missing', async () => {
    const project = await createProject('blank')
    const fileSystem = new ProjectFileSystem()
    const exportService = new ExportService(fileSystem)

    await fileSystem.writeJson(project.projectPath, 'exports/profiles/missing-template.json', {
      id: 'missing-template',
      schemaVersion: 1,
      label: 'Missing template profile',
      format: 'pdf',
      engine: 'xelatex',
      template: 'exports/templates/does-not-exist.tex',
      include: {},
      output: {
        filenameFrom: 'project.title',
        directory: 'exports/out'
      }
    })

    const response = await exportService.listProfiles({
      projectPath: project.projectPath
    })

    const diagnostic = response.diagnostics.find((entry) => entry.profileId === 'missing-template')
    expect(diagnostic).toBeDefined()
    expect(diagnostic?.message).toMatch(/template non trovato/i)
  })

  it('flags profiles whose theme JSON is malformed', async () => {
    const project = await createProject('blank')
    const fileSystem = new ProjectFileSystem()
    const exportService = new ExportService(fileSystem)

    await fileSystem.writeText(
      project.projectPath,
      'exports/themes/broken-theme.json',
      '{ this is not valid json'
    )
    await fileSystem.writeJson(project.projectPath, 'exports/profiles/broken-theme.json', {
      id: 'broken-theme',
      schemaVersion: 1,
      label: 'Broken theme profile',
      format: 'pdf',
      engine: 'xelatex',
      theme: 'exports/themes/broken-theme.json',
      include: {},
      output: {
        filenameFrom: 'project.title',
        directory: 'exports/out'
      }
    })

    const response = await exportService.listProfiles({
      projectPath: project.projectPath
    })

    const diagnostic = response.diagnostics.find((entry) => entry.profileId === 'broken-theme')
    expect(diagnostic).toBeDefined()
    expect(diagnostic?.message).toMatch(/theme JSON non valido/i)
  })

  it('flags profiles whose citation profile cannot be resolved', async () => {
    const project = await createProject('blank')
    const fileSystem = new ProjectFileSystem()
    const exportService = new ExportService(fileSystem)

    await fileSystem.writeJson(project.projectPath, 'exports/profiles/missing-citation.json', {
      id: 'missing-citation',
      schemaVersion: 1,
      label: 'Missing citation profile',
      format: 'pdf',
      engine: 'xelatex',
      citationProfile: 'thesis-not-installed',
      include: {},
      output: {
        filenameFrom: 'project.title',
        directory: 'exports/out'
      }
    })

    const response = await exportService.listProfiles({
      projectPath: project.projectPath
    })

    const diagnostic = response.diagnostics.find((entry) => entry.profileId === 'missing-citation')
    expect(diagnostic).toBeDefined()
    expect(diagnostic?.message).toMatch(/citation profile non trovato/i)
  })

  it('flags profiles with a future schemaVersion as missing migration', async () => {
    const project = await createProject('blank')
    const fileSystem = new ProjectFileSystem()
    const exportService = new ExportService(fileSystem)

    await fileSystem.writeJson(project.projectPath, 'exports/profiles/from-the-future.json', {
      id: 'from-the-future',
      schemaVersion: 2,
      label: 'Future profile',
      format: 'pdf',
      engine: 'xelatex',
      include: {},
      output: {
        filenameFrom: 'project.title',
        directory: 'exports/out'
      }
    })

    const response = await exportService.listProfiles({
      projectPath: project.projectPath
    })

    const diagnostic = response.diagnostics.find((entry) => entry.profileId === 'from-the-future')
    expect(diagnostic).toBeDefined()
    expect(diagnostic?.message).toMatch(/non supportato.*migration 2->3 assente/i)
  })
})
