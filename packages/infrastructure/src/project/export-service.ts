import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { type BinderNode, type ExportDocumentRequest, type ExportDocumentResponse, validateProjectMetadata } from '@pecie/schemas'

import { ProjectFileSystem } from '../fs/project-file-system'
import { normalizeProjectMetadata } from './project-authorship'

const execFileAsync = promisify(execFile)

export class ExportService {
  public constructor(private readonly fileSystem = new ProjectFileSystem()) {}

  public async exportDocument(request: ExportDocumentRequest): Promise<ExportDocumentResponse> {
    const binder = await this.fileSystem.readJson<{ rootId: string; nodes: BinderNode[] }>(
      request.projectPath,
      'binder.json'
    )
    const project = normalizeProjectMetadata(
      validateProjectMetadata(await this.fileSystem.readJson(request.projectPath, 'project.json')),
      new Date().toISOString()
    )

    const selectedNodes =
      request.scope === 'current-document'
        ? binder.nodes.filter((node) => node.documentId === request.documentId)
        : binder.nodes.filter((node) => node.type === 'document')

    const markdownParts: string[] = []
    const exportedDocuments: Array<{
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
    }> = []
    for (const node of selectedNodes) {
      if (node.type !== 'document' || !node.path) {
        continue
      }

      const raw = await this.fileSystem.readText(request.projectPath, node.path)
      const frontmatter = this.parseFrontmatter(raw)
      if (request.scope === 'whole-project' && frontmatter.includeInExport === false) {
        continue
      }
      const blockContributions = this.parseBlockContributions(frontmatter)
      const sectionContributions = this.parseSectionContributions(frontmatter)
      exportedDocuments.push({
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
      markdownParts.push(this.stripFrontmatter(raw))
    }

    if (markdownParts.length === 0) {
      return {
        success: false,
        log: ['Nessun documento esportabile selezionato.']
      }
    }

    const tempDir = await mkdtemp(path.join(tmpdir(), 'pecie-export-'))
    const inputPath = path.join(tempDir, 'export.md')

    try {
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
        relevantAuthorIds.length > 0
          ? project.authors.filter((author) => relevantAuthorIds.includes(author.id))
          : project.authors
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
          ...document,
          authorName: relevantAuthors.find((author) => author.id === document.authorId)?.name ?? '',
          contributorNames: document.contributorAuthorIds
            .map((authorId) => relevantAuthors.find((author) => author.id === authorId)?.name ?? '')
            .filter(Boolean),
          lastModifiedByAuthorName:
            relevantAuthors.find((author) => author.id === document.lastModifiedByAuthorId)?.name ?? '',
          blockContributions: document.blockContributions.map((entry) => ({
            ...entry,
            authorName: relevantAuthors.find((author) => author.id === entry.authorId)?.name ?? '',
            percentage:
              document.blockContributions.reduce((sum, current) => sum + current.wordCount, 0) > 0
                ? Number(
                    (
                      (entry.wordCount /
                        document.blockContributions.reduce((sum, current) => sum + current.wordCount, 0)) *
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
      const markdownBody = markdownParts
        .map((markdown, index) => {
          const documentNode = selectedNodes[index]
          if (request.format === 'md' || request.format === 'txt' || documentNode?.type !== 'document' || !documentNode.path) {
            return markdown
          }

          return this.rewriteImagePathsForExport(markdown, request.projectPath, documentNode.path)
        })
        .join('\n\n')
      const exportPayload = `${this.toYamlFrontmatter(metadata)}\n${markdownBody}`

      if (request.format === 'md') {
        await writeFile(request.outputPath, exportPayload, 'utf8')
        return {
          success: true,
          outputPath: request.outputPath,
          log: ['Export MD completato.', `Output: ${request.outputPath}`]
        }
      }

      if (request.format === 'txt') {
        await writeFile(request.outputPath, this.toPlainText(project.title, markdownBody), 'utf8')
        return {
          success: true,
          outputPath: request.outputPath,
          log: ['Export TXT completato.', `Output: ${request.outputPath}`]
        }
      }

      await writeFile(inputPath, exportPayload, 'utf8')
      await execFileAsync('pandoc', this.createPandocArgs(inputPath, request))

      return {
        success: true,
        outputPath: request.outputPath,
        log: [`Export ${request.format.toUpperCase()} completato.`, `Output: ${request.outputPath}`]
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Export non riuscito. Verifica che Pandoc sia installato.'
      return {
        success: false,
        log: [message]
      }
    } finally {
      await rm(tempDir, { force: true, recursive: true })
    }
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

  private createPandocArgs(inputPath: string, request: ExportDocumentRequest): string[] {
    const args = [inputPath, '-o', request.outputPath]

    if (request.format === 'latex') {
      args.push('-t', 'latex')
    }

    if (request.format === 'jats') {
      args.push('-t', 'jats')
    }

    if (request.format === 'tei') {
      args.push('-t', 'tei')
    }

    return args
  }
}
