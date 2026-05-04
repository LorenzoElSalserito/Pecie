import path from 'node:path'

import {
  type CitationAuthor,
  type CitationProfileDiagnostic,
  type CitationLibrary,
  type CitationLibraryDiagnostic,
  type CitationLibraryEntry,
  type CitationProfile,
  type ListCitationProfilesRequest,
  type ListCitationProfilesResponse,
  type SaveCitationProfileRequest,
  type SaveCitationProfileResponse,
  type SetDefaultCitationProfileRequest,
  type SetDefaultCitationProfileResponse,
  type CitationSourceFormat,
  type LoadCitationLibraryRequest,
  type LoadCitationLibraryResponse,
  type SuggestCiteKeyRequest,
  type SuggestCiteKeyResponse,
  validateCitationProfile,
  validateProjectMetadata
} from '@pecie/schemas'

import { ProjectFileSystem } from '../fs/project-file-system'

const DEFAULT_CITATION_PROFILE_PATH = 'citations/profiles/default.json'
const DEFAULT_BIBLIOGRAPHY_PATH = 'citations/references.bib'
const CITATION_PROFILES_DIRECTORY = 'citations/profiles'

export class CitationService {
  public constructor(private readonly fileSystem: ProjectFileSystem = new ProjectFileSystem()) {}

  public async loadLibrary(input: LoadCitationLibraryRequest): Promise<LoadCitationLibraryResponse> {
    const profile = await this.resolveCitationProfile(input.projectPath, input.profileId)
    const diagnostics: CitationLibraryDiagnostic[] = []
    const entriesByKey = new Map<string, CitationLibraryEntry>()
    const sources: CitationLibrary['sources'] = []

    for (const sourcePath of profile.bibliographySources) {
      const sourceFormat = this.detectSourceFormat(sourcePath)
      if (!sourceFormat) {
        diagnostics.push({
          sourcePath,
          severity: 'warning',
          message: `Unsupported citation source format for ${sourcePath}.`
        })
        continue
      }

      try {
        const rawSource = await this.fileSystem.readText(input.projectPath, sourcePath)
        const parsedEntries =
          sourceFormat === 'bibtex'
            ? this.parseBibtexSource(rawSource, sourcePath, diagnostics)
            : this.parseCslJsonSource(rawSource, sourcePath, diagnostics)

        let sourceEntryCount = 0
        for (const entry of parsedEntries) {
          if (entriesByKey.has(entry.citeKey)) {
            diagnostics.push({
              sourcePath,
              severity: 'warning',
              message: `Duplicate citekey "${entry.citeKey}" ignored.`
            })
            continue
          }

          entriesByKey.set(entry.citeKey, entry)
          sourceEntryCount += 1
        }

        sources.push({
          path: sourcePath,
          format: sourceFormat,
          entryCount: sourceEntryCount
        })
      } catch (error) {
        diagnostics.push({
          sourcePath,
          severity: 'error',
          message: error instanceof Error ? error.message : `Unable to read citation source ${sourcePath}.`
        })
      }
    }

    const library: CitationLibrary = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      profile,
      entries: [...entriesByKey.values()].sort((left, right) => left.citeKey.localeCompare(right.citeKey)),
      sources,
      diagnostics
    }

    return { library }
  }

  public async suggest(input: SuggestCiteKeyRequest): Promise<SuggestCiteKeyResponse> {
    const normalizedPrefix = input.prefix.replace(/^@+/, '').trim().toLowerCase()
    const library = (await this.loadLibrary({ projectPath: input.projectPath, profileId: input.profileId })).library
    const limit = Math.max(1, Math.min(input.limit, 50))

    const suggestions = library.entries
      .filter((entry) => {
        if (!normalizedPrefix) {
          return true
        }

        const haystack = [entry.citeKey, entry.title, entry.authorsShort].join(' ').toLowerCase()
        return haystack.includes(normalizedPrefix)
      })
      .sort((left, right) => {
        const leftStarts = left.citeKey.toLowerCase().startsWith(normalizedPrefix) ? 0 : 1
        const rightStarts = right.citeKey.toLowerCase().startsWith(normalizedPrefix) ? 0 : 1
        if (leftStarts !== rightStarts) {
          return leftStarts - rightStarts
        }
        return left.citeKey.localeCompare(right.citeKey)
      })
      .slice(0, limit)
      .map((entry) => ({
        citeKey: entry.citeKey,
        displayTitle: entry.title,
        authorsShort: entry.authorsShort,
        year: entry.year,
        sourcePath: entry.sourcePath
      }))

    return { suggestions }
  }

  public async listProfiles(input: ListCitationProfilesRequest): Promise<ListCitationProfilesResponse> {
    const diagnostics: CitationProfileDiagnostic[] = []
    const defaultProfileId = await this.readDefaultProfileId(input.projectPath)
    const profiles = await this.readProfiles(input.projectPath, diagnostics)

    return {
      defaultProfileId,
      diagnostics,
      profiles: profiles
        .map(({ profile, sourcePath }) => ({
          id: profile.id,
          label: profile.label,
          locale: profile.locale,
          bibliographySourceCount: profile.bibliographySources.length,
          citationStyle: profile.citationStyle,
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

  public async saveProfile(input: SaveCitationProfileRequest): Promise<SaveCitationProfileResponse> {
    const profile = validateCitationProfile(input.profile)
    const targetPath = `${CITATION_PROFILES_DIRECTORY}/${this.toProfileFilename(profile.id)}`

    await this.fileSystem.writeJson(input.projectPath, targetPath, profile)

    const defaultProfileId = input.setAsDefault ? await this.persistDefaultProfileId(input.projectPath, profile.id) : await this.readDefaultProfileId(input.projectPath)

    return {
      profile,
      savedPath: targetPath,
      defaultProfileId
    }
  }

  public async setDefaultProfile(input: SetDefaultCitationProfileRequest): Promise<SetDefaultCitationProfileResponse> {
    await this.resolveCitationProfile(input.projectPath, input.profileId)
    await this.persistDefaultProfileId(input.projectPath, input.profileId)
    return { profileId: input.profileId }
  }

  private async resolveCitationProfile(projectPath: string, requestedProfileId?: string): Promise<CitationProfile> {
    try {
      const targetProfileId = requestedProfileId?.trim() || (await this.readDefaultProfileId(projectPath))
      return validateCitationProfile(
        await this.fileSystem.readJson(projectPath, `${CITATION_PROFILES_DIRECTORY}/${this.toProfileFilename(targetProfileId)}`)
      )
    } catch {
      if (!requestedProfileId || requestedProfileId === 'default') {
        return this.createFallbackProfile()
      }
    }

    return this.createFallbackProfile()
  }

  private async readProfiles(
    projectPath: string,
    diagnostics: CitationProfileDiagnostic[]
  ): Promise<Array<{ profile: CitationProfile; sourcePath: string }>> {
    try {
      const entries = await this.fileSystem.listEntries(projectPath, CITATION_PROFILES_DIRECTORY)
      const profiles: Array<{ profile: CitationProfile; sourcePath: string }> = []

      for (const entry of entries) {
        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.json') {
          continue
        }

        const sourcePath = `${CITATION_PROFILES_DIRECTORY}/${entry.name}`
        try {
          const profile = validateCitationProfile(await this.fileSystem.readJson(projectPath, sourcePath))
          profiles.push({ profile, sourcePath })
        } catch (error) {
          diagnostics.push({
            profileId: path.basename(entry.name, '.json'),
            sourcePath,
            severity: 'error',
            message: error instanceof Error ? error.message : 'Unable to validate citation profile.'
          })
        }
      }

      if (profiles.length === 0) {
        profiles.push({ profile: this.createFallbackProfile(), sourcePath: DEFAULT_CITATION_PROFILE_PATH })
      }

      return profiles
    } catch {
      return [{ profile: this.createFallbackProfile(), sourcePath: DEFAULT_CITATION_PROFILE_PATH }]
    }
  }

  private async readDefaultProfileId(projectPath: string): Promise<string> {
    try {
      const project = validateProjectMetadata(await this.fileSystem.readJson(projectPath, 'project.json'))
      return project.defaultCitationProfileId?.trim() || 'default'
    } catch {
      return 'default'
    }
  }

  private async persistDefaultProfileId(projectPath: string, profileId: string): Promise<string> {
    const project = validateProjectMetadata(await this.fileSystem.readJson(projectPath, 'project.json'))
    await this.fileSystem.writeJson(projectPath, 'project.json', {
      ...project,
      defaultCitationProfileId: profileId
    })
    return profileId
  }

  private toProfileFilename(profileId: string): string {
    const normalized = profileId.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
    return `${normalized || 'profile'}.json`
  }

  private createFallbackProfile(): CitationProfile {
    return {
      id: 'default',
      schemaVersion: 1,
      label: 'Default citation profile',
      bibliographySources: [DEFAULT_BIBLIOGRAPHY_PATH],
      citationStyle: 'citations/csl/apa.csl',
      locale: 'en-US',
      linkCitations: false,
      suppressBibliography: false,
      bibliographyTitle: {
        'it-IT': 'Bibliografia',
        'en-US': 'References'
      }
    }
  }

  private detectSourceFormat(sourcePath: string): CitationSourceFormat | null {
    const extension = path.extname(sourcePath).toLowerCase()
    if (extension === '.bib') {
      return 'bibtex'
    }
    if (extension === '.json') {
      return 'cslJson'
    }
    return null
  }

  private parseBibtexSource(
    source: string,
    sourcePath: string,
    diagnostics: CitationLibraryDiagnostic[]
  ): CitationLibraryEntry[] {
    const entries: CitationLibraryEntry[] = []
    let cursor = 0

    while (cursor < source.length) {
      const atIndex = source.indexOf('@', cursor)
      if (atIndex === -1) {
        break
      }

      const typeMatch = /@([a-zA-Z]+)/.exec(source.slice(atIndex))
      if (!typeMatch) {
        break
      }

      const typeEnd = atIndex + typeMatch[0].length
      const opener = source[typeEnd]
      if (opener !== '{' && opener !== '(') {
        cursor = typeEnd
        continue
      }

      const closer = opener === '{' ? '}' : ')'
      let depth = 1
      let index = typeEnd + 1
      let inQuotes = false

      while (index < source.length && depth > 0) {
        const current = source[index]
        if (current === '"' && source[index - 1] !== '\\') {
          inQuotes = !inQuotes
        } else if (!inQuotes) {
          if (current === opener) {
            depth += 1
          } else if (current === closer) {
            depth -= 1
          }
        }
        index += 1
      }

      if (depth > 0) {
        diagnostics.push({
          sourcePath,
          severity: 'warning',
          message: 'Skipping malformed BibTeX entry with unbalanced braces.'
        })
        break
      }

      const rawEntry = source.slice(typeEnd + 1, Math.max(typeEnd + 1, index - 1)).trim()
      cursor = index

      const firstComma = this.findTopLevelComma(rawEntry)
      if (firstComma === -1) {
        diagnostics.push({
          sourcePath,
          severity: 'warning',
          message: 'Skipping malformed BibTeX entry without citekey separator.'
        })
        continue
      }

      const citeKey = rawEntry.slice(0, firstComma).trim()
      const fields = this.parseBibtexFields(rawEntry.slice(firstComma + 1))
      const title = fields.title ?? citeKey
      const authors = this.parseBibtexAuthors(fields.author)
      entries.push({
        citeKey,
        sourcePath,
        sourceFormat: 'bibtex',
        title,
        authors,
        authorsShort: this.formatAuthorsShort(authors),
        year: this.parseIssuedYear(fields.year),
        containerTitle: fields.journal ?? fields.booktitle ?? fields.publisher
      })
    }

    return entries
  }

  private findTopLevelComma(value: string): number {
    let depth = 0
    let inQuotes = false

    for (let index = 0; index < value.length; index += 1) {
      const current = value[index]
      if (current === '"' && value[index - 1] !== '\\') {
        inQuotes = !inQuotes
        continue
      }
      if (inQuotes) {
        continue
      }
      if (current === '{') {
        depth += 1
      } else if (current === '}') {
        depth = Math.max(0, depth - 1)
      } else if (current === ',' && depth === 0) {
        return index
      }
    }

    return -1
  }

  private parseBibtexFields(value: string): Record<string, string> {
    const fields: Record<string, string> = {}
    let cursor = 0

    while (cursor < value.length) {
      while (cursor < value.length && /[\s,]/.test(value[cursor])) {
        cursor += 1
      }
      if (cursor >= value.length) {
        break
      }

      const equalsIndex = value.indexOf('=', cursor)
      if (equalsIndex === -1) {
        break
      }

      const key = value.slice(cursor, equalsIndex).trim().toLowerCase()
      cursor = equalsIndex + 1
      while (cursor < value.length && /\s/.test(value[cursor])) {
        cursor += 1
      }

      const { rawValue, nextCursor } = this.readBibtexValue(value, cursor)
      cursor = nextCursor
      fields[key] = this.normalizeBibtexValue(rawValue)
    }

    return fields
  }

  private readBibtexValue(value: string, startIndex: number): { rawValue: string; nextCursor: number } {
    const opener = value[startIndex]
    if (opener === '{' || opener === '"') {
      let depth = opener === '{' ? 1 : 0
      let index = startIndex + 1

      while (index < value.length) {
        const current = value[index]
        if (opener === '{') {
          if (current === '{') {
            depth += 1
          } else if (current === '}') {
            depth -= 1
            if (depth === 0) {
              return {
                rawValue: value.slice(startIndex + 1, index),
                nextCursor: index + 1
              }
            }
          }
        } else if (current === '"' && value[index - 1] !== '\\') {
          return {
            rawValue: value.slice(startIndex + 1, index),
            nextCursor: index + 1
          }
        }
        index += 1
      }
    }

    let index = startIndex
    while (index < value.length && value[index] !== ',') {
      index += 1
    }
    return {
      rawValue: value.slice(startIndex, index),
      nextCursor: index
    }
  }

  private normalizeBibtexValue(value: string): string {
    return value
      .replace(/[{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private parseBibtexAuthors(rawAuthors: string | undefined): CitationAuthor[] {
    if (!rawAuthors) {
      return []
    }

    return rawAuthors
      .split(/\s+and\s+/i)
      .map((author) => author.trim())
      .filter(Boolean)
      .map((author) => {
        if (author.includes(',')) {
          const [family, given] = author.split(',', 2).map((segment) => segment.trim())
          return { family, given }
        }

        const parts = author.split(/\s+/).filter(Boolean)
        if (parts.length === 1) {
          return { literal: parts[0] }
        }

        return {
          given: parts.slice(0, -1).join(' '),
          family: parts.at(-1)
        }
      })
  }

  private parseCslJsonSource(
    source: string,
    sourcePath: string,
    diagnostics: CitationLibraryDiagnostic[]
  ): CitationLibraryEntry[] {
    const parsed = JSON.parse(source) as unknown
    if (!Array.isArray(parsed)) {
      diagnostics.push({
        sourcePath,
        severity: 'warning',
        message: 'CSL JSON source must be an array of entries.'
      })
      return []
    }

    return parsed.flatMap((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        diagnostics.push({
          sourcePath,
          severity: 'warning',
          message: `Skipping invalid CSL JSON entry at index ${index}.`
        })
        return []
      }

      const record = entry as Record<string, unknown>
      const citeKey = typeof record.id === 'string' && record.id.trim().length > 0 ? record.id.trim() : `csl-${index + 1}`
      const authors = this.parseCslAuthors(record.author)
      return [
        {
          citeKey,
          sourcePath,
          sourceFormat: 'cslJson',
          title: typeof record.title === 'string' && record.title.trim().length > 0 ? record.title.trim() : citeKey,
          authors,
          authorsShort: this.formatAuthorsShort(authors),
          year: this.parseCslYear(record.issued),
          containerTitle: typeof record['container-title'] === 'string' ? record['container-title'] : undefined
        }
      ]
    })
  }

  private parseCslAuthors(value: unknown): CitationAuthor[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.flatMap((author) => {
      if (!author || typeof author !== 'object') {
        return []
      }

      const record = author as Record<string, unknown>
      const citationAuthor: CitationAuthor = {}
      if (typeof record.family === 'string' && record.family.trim().length > 0) {
        citationAuthor.family = record.family.trim()
      }
      if (typeof record.given === 'string' && record.given.trim().length > 0) {
        citationAuthor.given = record.given.trim()
      }
      if (typeof record.literal === 'string' && record.literal.trim().length > 0) {
        citationAuthor.literal = record.literal.trim()
      }
      return citationAuthor.family || citationAuthor.given || citationAuthor.literal ? [citationAuthor] : []
    })
  }

  private parseCslYear(value: unknown): number | undefined {
    if (!value || typeof value !== 'object') {
      return undefined
    }

    const record = value as Record<string, unknown>
    if (Array.isArray(record['date-parts']) && Array.isArray(record['date-parts'][0]) && typeof record['date-parts'][0][0] === 'number') {
      return record['date-parts'][0][0]
    }

    if (typeof record.raw === 'string') {
      return this.parseIssuedYear(record.raw)
    }

    return undefined
  }

  private parseIssuedYear(value: string | undefined): number | undefined {
    if (!value) {
      return undefined
    }

    const match = value.match(/\d{4}/)
    return match ? Number(match[0]) : undefined
  }

  private formatAuthorsShort(authors: CitationAuthor[]): string {
    const labels = authors
      .map((author) => author.family ?? author.literal ?? author.given ?? '')
      .filter((value) => value.trim().length > 0)

    if (labels.length === 0) {
      return 'Unknown author'
    }
    if (labels.length === 1) {
      return labels[0]
    }
    if (labels.length === 2) {
      return `${labels[0]} & ${labels[1]}`
    }
    return `${labels[0]} et al.`
  }
}
