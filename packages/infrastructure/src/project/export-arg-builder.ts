import {
  type CitationProfile,
  type ExportFormat,
  type ExportProfile,
  validateCitationProfile
} from '@pecie/schemas'

import { ProjectFileSystem } from '../fs/project-file-system'

export const exportFormats = {
  pdf: { pandocTo: 'pdf', engines: ['xelatex', 'pdflatex', 'lualatex', 'weasyprint'] },
  docx: { pandocTo: 'docx', engines: [] },
  odt: { pandocTo: 'odt', engines: [] },
  rtf: { pandocTo: 'rtf', engines: [] },
  epub: { pandocTo: 'epub3', engines: [] },
  html: { pandocTo: 'html5', engines: [] },
  latex: { pandocTo: 'latex', engines: [] },
  jats: { pandocTo: 'jats', engines: [] },
  tei: { pandocTo: 'tei', engines: [] },
  md: { pandocTo: 'gfm', engines: [] },
  txt: { pandocTo: 'plain', engines: [] }
} as const satisfies Record<ExportFormat, { pandocTo: string; engines: readonly string[] }>

const FORMATS_INFERRED_FROM_OUTPUT_EXTENSION: ReadonlySet<ExportFormat> = new Set(['pdf', 'docx', 'odt', 'rtf'])

export function toExportProfileFilename(profileId: string): string {
  const normalized = profileId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${normalized || 'profile'}.json`
}

export async function readCitationProfile(
  fileSystem: ProjectFileSystem,
  projectPath: string,
  citationProfileId: string
): Promise<CitationProfile> {
  const sourcePath = `citations/profiles/${toExportProfileFilename(citationProfileId)}`
  try {
    return validateCitationProfile(await fileSystem.readJson(projectPath, sourcePath))
  } catch {
    throw new Error(`Profilo export: citation profile non trovato o non valido (${sourcePath}).`)
  }
}

export async function resolveCitationPandocArgs(
  fileSystem: ProjectFileSystem,
  projectPath: string,
  citationProfileId?: string
): Promise<string[]> {
  const normalizedId = citationProfileId?.trim()
  if (!normalizedId) {
    return []
  }

  const profile = await readCitationProfile(fileSystem, projectPath, normalizedId)
  const args = ['--citeproc']

  for (const bibliographySource of profile.bibliographySources) {
    args.push('--bibliography', fileSystem.resolveProjectPath(projectPath, bibliographySource))
  }

  const cslPath = fileSystem.resolveProjectPath(projectPath, profile.citationStyle)
  const rawCsl = await fileSystem.readText(projectPath, profile.citationStyle).catch(() => '')
  if (rawCsl.trim().length > 0) {
    args.push('--csl', cslPath)
  }

  args.push('-M', `link-citations=${profile.linkCitations ? 'true' : 'false'}`)
  if (profile.suppressBibliography) {
    args.push('-M', 'suppress-bibliography=true')
  }

  return args
}

export interface BuildPandocArgsInput {
  fileSystem: ProjectFileSystem
  projectPath: string
  inputPath: string
  outputPath: string
  profile: ExportProfile
  citationProfileOverride?: string
  pdfEngineExecutablePath?: string
}

export async function buildPandocArgs(input: BuildPandocArgsInput): Promise<string[]> {
  const { fileSystem, projectPath, inputPath, outputPath, profile, citationProfileOverride, pdfEngineExecutablePath } = input
  const formatConfig = exportFormats[profile.format]
  const args = [inputPath, '-f', 'markdown+citations', '-o', outputPath]

  if (!FORMATS_INFERRED_FROM_OUTPUT_EXTENSION.has(profile.format)) {
    args.push('-t', formatConfig.pandocTo)
  }

  if (profile.engine) {
    args.push(`--pdf-engine=${pdfEngineExecutablePath ?? profile.engine}`)
  }

  if (profile.engine === 'weasyprint') {
    args.push('--standalone')
    if (profile.theme) {
      args.push('--css', fileSystem.resolveProjectPath(projectPath, profile.theme))
    }
  }

  if (profile.template) {
    args.push('--template', fileSystem.resolveProjectPath(projectPath, profile.template))
  }

  if (profile.toc) {
    args.push('--toc')
  }

  if (profile.pageNumbering) {
    args.push('-M', `pecie-page-numbering=${profile.pageNumbering}`)
  }

  args.push(
    ...(await resolveCitationPandocArgs(
      fileSystem,
      projectPath,
      citationProfileOverride?.trim() || profile.citationProfile
    ))
  )

  return args
}
