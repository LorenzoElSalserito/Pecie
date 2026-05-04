import { createHash, randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import {
  type CreateResearchLinkRequest,
  type CreateResearchLinkResponse,
  type CreateResearchNoteRequest,
  type CreateResearchNoteResponse,
  type GetResearchGraphRequest,
  type GetResearchGraphResponse,
  type ImportPdfRequest,
  type ImportPdfResponse,
  type ListPdfLibraryRequest,
  type ListPdfLibraryResponse,
  type ListResearchNotesRequest,
  type ListResearchNotesResponse,
  type PdfLibraryItem,
  type PdfLibrarySnapshot,
  type ResearchLinkMap,
  type ResearchLinkRecord,
  type ResearchNoteKind,
  type ResearchNoteRecord,
  validateBinderDocument,
  validatePdfLibrary,
  validateResearchLinkMap,
  validateResearchNote
} from '@pecie/schemas'

import { ProjectFileSystem } from '../fs/project-file-system'

const NOTES_DIRECTORY = 'research/notes'
const PDF_LIBRARY_PATH = 'research/pdf-library.json'
const LINK_MAP_PATH = 'research/link-map.json'
const PDF_DIRECTORY = 'assets/pdf'

export class ResearchService {
  public constructor(private readonly fileSystem: ProjectFileSystem = new ProjectFileSystem()) {}

  public async listResearchNotes(input: ListResearchNotesRequest): Promise<ListResearchNotesResponse> {
    const notes = await this.readResearchNotes(input.projectPath)
    return { notes }
  }

  public async createResearchNote(input: CreateResearchNoteRequest): Promise<CreateResearchNoteResponse> {
    const createdAt = new Date().toISOString()
    const noteId = `research-note-${randomUUID()}`
    const title = input.title.trim() || 'Research note'
    const note: ResearchNoteRecord = {
      id: noteId,
      title,
      kind: input.kind,
      path: `${NOTES_DIRECTORY}/${this.slugify(title)}-${noteId.slice(-8)}.md`,
      includeInExport: false,
      createdAt,
      updatedAt: createdAt,
      body: input.body?.trim() ?? ''
    }

    await this.fileSystem.writeText(input.projectPath, note.path, this.serializeResearchNote(note))
    return { note }
  }

  public async listPdfLibrary(input: ListPdfLibraryRequest): Promise<ListPdfLibraryResponse> {
    return {
      library: await this.readPdfLibrary(input.projectPath)
    }
  }

  public async importPdf(input: ImportPdfRequest): Promise<ImportPdfResponse> {
    const library = await this.readPdfLibrary(input.projectPath)
    const imported: PdfLibraryItem[] = []
    const skipped: ImportPdfResponse['skipped'] = []
    const items = [...library.items]

    for (const sourcePath of input.sourcePaths) {
      const extension = path.extname(sourcePath).toLowerCase()
      if (extension !== '.pdf') {
        skipped.push({ sourcePath, reason: 'Only PDF files are supported in the research library.' })
        continue
      }

      const buffer = await readFile(sourcePath)
      const fileStats = await stat(sourcePath)
      const sha256 = createHash('sha256').update(buffer).digest('hex')
      const existing = items.find((item) => item.sha256 === sha256)
      if (existing) {
        imported.push(existing)
        continue
      }

      const importedAt = new Date().toISOString()
      const originalFilename = path.basename(sourcePath)
      const displayName = path.basename(originalFilename, '.pdf')
      const relativePath = `${PDF_DIRECTORY}/${this.slugify(displayName)}-${sha256.slice(0, 8)}.pdf`

      await this.fileSystem.copyIntoProject(input.projectPath, sourcePath, relativePath)

      const item: PdfLibraryItem = {
        id: `pdf-${randomUUID()}`,
        relativePath,
        originalFilename,
        displayName,
        mimeType: 'application/pdf',
        byteSize: fileStats.size,
        sha256,
        importedAt
      }

      items.push(item)
      imported.push(item)
    }

    const snapshot: PdfLibrarySnapshot = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      items: items.sort((left, right) => right.importedAt.localeCompare(left.importedAt))
    }
    await this.fileSystem.writeJson(input.projectPath, PDF_LIBRARY_PATH, snapshot)

    return {
      imported,
      skipped,
      library: snapshot
    }
  }

  public async getResearchGraph(input: GetResearchGraphRequest): Promise<GetResearchGraphResponse> {
    return {
      graph: await this.readLinkMap(input.projectPath)
    }
  }

  public async createLink(input: CreateResearchLinkRequest): Promise<CreateResearchLinkResponse> {
    await this.assertEntityExists(input.projectPath, input.sourceType, input.sourceId)
    await this.assertEntityExists(input.projectPath, input.targetType, input.targetId)

    const graph = await this.readLinkMap(input.projectPath)
    const existing =
      graph.links.find(
        (link) =>
          link.sourceType === input.sourceType &&
          link.sourceId === input.sourceId &&
          link.targetType === input.targetType &&
          link.targetId === input.targetId &&
          link.relation === input.relation
      ) ?? null

    if (existing) {
      return {
        graph,
        createdLink: existing
      }
    }

    const createdLink: ResearchLinkRecord = {
      id: `research-link-${randomUUID()}`,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      targetType: input.targetType,
      targetId: input.targetId,
      relation: input.relation,
      createdAt: new Date().toISOString()
    }

    const nextGraph: ResearchLinkMap = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      links: [...graph.links, createdLink]
    }
    await this.fileSystem.writeJson(input.projectPath, LINK_MAP_PATH, nextGraph)

    return {
      graph: nextGraph,
      createdLink
    }
  }

  private async readResearchNotes(projectPath: string): Promise<ResearchNoteRecord[]> {
    try {
      const entries = await this.fileSystem.listEntries(projectPath, NOTES_DIRECTORY)
      const notes = await Promise.all(
        entries
          .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.md')
          .map(async (entry) => {
            const relativePath = `${NOTES_DIRECTORY}/${entry.name}`
            const raw = await this.fileSystem.readText(projectPath, relativePath)
            return this.parseResearchNote(relativePath, raw)
          })
      )

      return notes
        .filter((note): note is ResearchNoteRecord => note !== null)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    } catch {
      return []
    }
  }

  private parseResearchNote(relativePath: string, rawDocument: string): ResearchNoteRecord | null {
    const frontmatter = this.parseFrontmatter(rawDocument)
    if (frontmatter.type !== 'research-note' || typeof frontmatter.researchNoteId !== 'string') {
      return null
    }

    return validateResearchNote({
      id: frontmatter.researchNoteId,
      title: typeof frontmatter.title === 'string' ? frontmatter.title : path.basename(relativePath, '.md'),
      kind: this.normalizeResearchKind(frontmatter.kind),
      path: relativePath,
      includeInExport: false,
      createdAt: typeof frontmatter.createdAt === 'string' ? frontmatter.createdAt : new Date().toISOString(),
      updatedAt: typeof frontmatter.updatedAt === 'string' ? frontmatter.updatedAt : new Date().toISOString(),
      body: this.stripFrontmatter(rawDocument)
    })
  }

  private async readPdfLibrary(projectPath: string): Promise<PdfLibrarySnapshot> {
    try {
      return validatePdfLibrary(await this.fileSystem.readJson(projectPath, PDF_LIBRARY_PATH))
    } catch {
      return {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        items: []
      }
    }
  }

  private async readLinkMap(projectPath: string): Promise<ResearchLinkMap> {
    try {
      return validateResearchLinkMap(await this.fileSystem.readJson(projectPath, LINK_MAP_PATH))
    } catch {
      return {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        links: []
      }
    }
  }

  private async assertEntityExists(
    projectPath: string,
    type: CreateResearchLinkRequest['sourceType'],
    id: string
  ): Promise<void> {
    if (type === 'note') {
      const notes = await this.readResearchNotes(projectPath)
      if (!notes.some((note) => note.id === id)) {
        throw new Error(`Research note not found: ${id}`)
      }
      return
    }

    if (type === 'pdf') {
      const library = await this.readPdfLibrary(projectPath)
      if (!library.items.some((item) => item.id === id)) {
        throw new Error(`Research PDF not found: ${id}`)
      }
      return
    }

    const binder = validateBinderDocument(await this.fileSystem.readJson(projectPath, 'binder.json'))
    if (!binder.nodes.some((node) => node.documentId === id)) {
      throw new Error(`Binder document not found: ${id}`)
    }
  }

  private serializeResearchNote(note: ResearchNoteRecord): string {
    const frontmatter = [
      '---',
      `title: ${note.title}`,
      'type: research-note',
      `researchNoteId: ${note.id}`,
      `kind: ${note.kind}`,
      'includeInExport: false',
      `createdAt: ${note.createdAt}`,
      `updatedAt: ${note.updatedAt}`,
      '---',
      ''
    ].join('\n')

    return `${frontmatter}${note.body}`
  }

  private parseFrontmatter(rawDocument: string): Record<string, string | boolean> {
    if (!rawDocument.startsWith('---')) {
      return {}
    }

    const parts = rawDocument.split('---')
    if (parts.length < 3) {
      return {}
    }

    const frontmatter: Record<string, string | boolean> = {}
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
      frontmatter[key] = rawValue === 'false' ? false : rawValue === 'true' ? true : rawValue
    }

    return frontmatter
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

  private normalizeResearchKind(value: unknown): ResearchNoteKind {
    return value === 'methodological' || value === 'discarded' || value === 'supervision' ? value : 'idea'
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
}
