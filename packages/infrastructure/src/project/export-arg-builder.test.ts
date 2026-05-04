import { describe, expect, it } from 'vitest'

import type { ExportFormat, ExportProfile } from '@pecie/schemas'

import { ProjectFileSystem } from '../fs/project-file-system'
import {
  buildPandocArgs,
  exportFormats,
  resolveCitationPandocArgs,
  toExportProfileFilename
} from './export-arg-builder'

class FakeFileSystem extends ProjectFileSystem {
  public readonly textFiles: Map<string, string>
  public readonly jsonFiles: Map<string, unknown>

  public constructor(input: { textFiles?: Record<string, string>; jsonFiles?: Record<string, unknown> } = {}) {
    super()
    this.textFiles = new Map(Object.entries(input.textFiles ?? {}))
    this.jsonFiles = new Map(Object.entries(input.jsonFiles ?? {}))
  }

  public override resolveProjectPath(_projectPath: string, relativePath: string): string {
    return `/abs/${relativePath}`
  }

  public override async readText(_projectPath: string, relativePath: string): Promise<string> {
    if (!this.textFiles.has(relativePath)) {
      throw new Error(`text not found: ${relativePath}`)
    }
    return this.textFiles.get(relativePath)!
  }

  public override async readJson<T>(_projectPath: string, relativePath: string): Promise<T> {
    if (!this.jsonFiles.has(relativePath)) {
      throw new Error(`json not found: ${relativePath}`)
    }
    return this.jsonFiles.get(relativePath) as T
  }
}

function makeProfile(overrides: Partial<ExportProfile> = {}): ExportProfile {
  return {
    id: 'fixture',
    schemaVersion: 1,
    label: 'Fixture profile',
    format: 'pdf',
    include: {},
    output: {
      filenameFrom: 'project.title',
      directory: 'exports/out'
    },
    ...overrides
  } as ExportProfile
}

describe('toExportProfileFilename', () => {
  it('normalizes diacritics, spaces and uppercase letters', () => {
    expect(toExportProfileFilename('Tesi Filosofia')).toBe('tesi-filosofia.json')
    expect(toExportProfileFilename('  THESIS_PDF  ')).toBe('thesis_pdf.json')
    expect(toExportProfileFilename('!!!')).toBe('profile.json')
  })
})

describe('exportFormats registry', () => {
  it('declares an entry for every ExportFormat literal', () => {
    const expected: ExportFormat[] = ['pdf', 'docx', 'odt', 'rtf', 'epub', 'html', 'latex', 'jats', 'tei', 'md', 'txt']
    expect(Object.keys(exportFormats).sort()).toEqual([...expected].sort())
  })

  it('only declares engines for pdf', () => {
    for (const [format, config] of Object.entries(exportFormats)) {
      if (format === 'pdf') {
        expect(config.engines).toContain('xelatex')
        expect(config.engines).toContain('weasyprint')
      } else {
        expect(config.engines).toEqual([])
      }
    }
  })
})

describe('buildPandocArgs', () => {
  const projectPath = '/workspace/project.pe'

  it('uses output extension inference for pdf/docx/odt/rtf and skips -t', async () => {
    const fileSystem = new FakeFileSystem()
    for (const format of ['pdf', 'docx', 'odt', 'rtf'] as const) {
      const args = await buildPandocArgs({
        fileSystem,
        projectPath,
        inputPath: '/tmp/in.md',
        outputPath: `/tmp/out.${format}`,
        profile: makeProfile({ format })
      })
      expect(args.includes('-t')).toBe(false)
      expect(args.slice(0, 5)).toEqual(['/tmp/in.md', '-f', 'markdown+citations', '-o', `/tmp/out.${format}`])
    }
  })

  it('emits explicit -t for non-extension-inferred formats', async () => {
    const fileSystem = new FakeFileSystem()
    const cases: Array<[ExportFormat, string]> = [
      ['epub', 'epub3'],
      ['html', 'html5'],
      ['latex', 'latex'],
      ['jats', 'jats'],
      ['tei', 'tei'],
      ['md', 'gfm'],
      ['txt', 'plain']
    ]

    for (const [format, pandocTo] of cases) {
      const args = await buildPandocArgs({
        fileSystem,
        projectPath,
        inputPath: '/tmp/in.md',
        outputPath: `/tmp/out.${format}`,
        profile: makeProfile({ format })
      })
      expect(args).toContain('-t')
      const flagIndex = args.indexOf('-t')
      expect(args[flagIndex + 1]).toBe(pandocTo)
    }
  })

  it('appends --pdf-engine, --template, --toc and pecie-page-numbering when set', async () => {
    const fileSystem = new FakeFileSystem({ textFiles: { 'exports/templates/thesis.tex': '\\documentclass{}' } })
    const args = await buildPandocArgs({
      fileSystem,
      projectPath,
      inputPath: '/tmp/in.md',
      outputPath: '/tmp/out.pdf',
      profile: makeProfile({
        format: 'pdf',
        engine: 'xelatex',
        template: 'exports/templates/thesis.tex',
        toc: true,
        pageNumbering: 'roman-then-arabic'
      })
    })
    expect(args).toContain('--pdf-engine=xelatex')
    expect(args).toContain('--template')
    expect(args[args.indexOf('--template') + 1]).toBe('/abs/exports/templates/thesis.tex')
    expect(args).toContain('--toc')
    expect(args).toContain('-M')
    expect(args).toContain('pecie-page-numbering=roman-then-arabic')
  })

  it('passes standalone html flags and css theme for weasyprint pdf profiles', async () => {
    const fileSystem = new FakeFileSystem({
      textFiles: {
        'exports/themes/github-markdown.css': 'body { color: #24292f; }'
      }
    })

    const args = await buildPandocArgs({
      fileSystem,
      projectPath,
      inputPath: '/tmp/in.md',
      outputPath: '/tmp/out.pdf',
      profile: makeProfile({
        format: 'pdf',
        engine: 'weasyprint',
        theme: 'exports/themes/github-markdown.css'
      })
    })

    expect(args).toContain('--pdf-engine=weasyprint')
    expect(args).toContain('--standalone')
    expect(args).toContain('--css')
    expect(args[args.indexOf('--css') + 1]).toBe('/abs/exports/themes/github-markdown.css')
  })

  it('does not append citation flags when no citation profile is set', async () => {
    const fileSystem = new FakeFileSystem()
    const args = await buildPandocArgs({
      fileSystem,
      projectPath,
      inputPath: '/tmp/in.md',
      outputPath: '/tmp/out.pdf',
      profile: makeProfile({ format: 'pdf' })
    })
    expect(args).not.toContain('--citeproc')
    expect(args).not.toContain('--bibliography')
  })

  it('appends --citeproc, --bibliography and link-citations when citation profile is set', async () => {
    const fileSystem = new FakeFileSystem({
      textFiles: {
        'citations/csl/apa.csl': '<style xmlns="http://purl.org/net/xbiblio/csl"></style>'
      },
      jsonFiles: {
        'citations/profiles/thesis-main.json': {
          id: 'thesis-main',
          schemaVersion: 1,
          label: 'Tesi APA',
          bibliographySources: ['citations/references.bib'],
          citationStyle: 'citations/csl/apa.csl',
          locale: 'it-IT',
          linkCitations: true,
          suppressBibliography: false,
          bibliographyTitle: { 'it-IT': 'Bibliografia', 'en-US': 'References' }
        }
      }
    })

    const args = await buildPandocArgs({
      fileSystem,
      projectPath,
      inputPath: '/tmp/in.md',
      outputPath: '/tmp/out.pdf',
      profile: makeProfile({ format: 'pdf', citationProfile: 'thesis-main' })
    })

    expect(args).toContain('--citeproc')
    expect(args).toContain('--bibliography')
    expect(args[args.indexOf('--bibliography') + 1]).toBe('/abs/citations/references.bib')
    expect(args).toContain('--csl')
    expect(args[args.indexOf('--csl') + 1]).toBe('/abs/citations/csl/apa.csl')
    expect(args).toContain('link-citations=true')
  })

  it('skips --csl when the CSL file is empty', async () => {
    const fileSystem = new FakeFileSystem({
      textFiles: { 'citations/csl/apa.csl': '   ' },
      jsonFiles: {
        'citations/profiles/thesis-main.json': {
          id: 'thesis-main',
          schemaVersion: 1,
          label: 'Tesi APA',
          bibliographySources: ['citations/references.bib'],
          citationStyle: 'citations/csl/apa.csl',
          locale: 'it-IT',
          linkCitations: false,
          suppressBibliography: true,
          bibliographyTitle: { 'it-IT': 'Bibliografia', 'en-US': 'References' }
        }
      }
    })

    const args = await buildPandocArgs({
      fileSystem,
      projectPath,
      inputPath: '/tmp/in.md',
      outputPath: '/tmp/out.pdf',
      profile: makeProfile({ format: 'pdf', citationProfile: 'thesis-main' })
    })

    expect(args).not.toContain('--csl')
    expect(args).toContain('link-citations=false')
    expect(args).toContain('suppress-bibliography=true')
  })

  it('citation override wins over the profile citationProfile field', async () => {
    const fileSystem = new FakeFileSystem({
      jsonFiles: {
        'citations/profiles/override.json': {
          id: 'override',
          schemaVersion: 1,
          label: 'Override',
          bibliographySources: ['citations/override.bib'],
          citationStyle: 'citations/csl/override.csl',
          locale: 'en-US',
          linkCitations: false,
          suppressBibliography: false,
          bibliographyTitle: { 'en-US': 'References' }
        }
      }
    })

    const args = await buildPandocArgs({
      fileSystem,
      projectPath,
      inputPath: '/tmp/in.md',
      outputPath: '/tmp/out.pdf',
      profile: makeProfile({ format: 'pdf', citationProfile: 'thesis-main' }),
      citationProfileOverride: 'override'
    })

    expect(args).toContain('/abs/citations/override.bib')
  })
})

describe('resolveCitationPandocArgs', () => {
  it('returns an empty array when no citation profile id is provided', async () => {
    const fileSystem = new FakeFileSystem()
    expect(await resolveCitationPandocArgs(fileSystem, '/workspace/project.pe', undefined)).toEqual([])
    expect(await resolveCitationPandocArgs(fileSystem, '/workspace/project.pe', '   ')).toEqual([])
  })

  it('throws a structured error when the citation profile is missing', async () => {
    const fileSystem = new FakeFileSystem()
    await expect(
      resolveCitationPandocArgs(fileSystem, '/workspace/project.pe', 'missing')
    ).rejects.toThrow(/citation profile non trovato o non valido/)
  })
})
