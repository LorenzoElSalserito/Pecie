import type * as Monaco from 'monaco-editor'

import type {
  AppSettings,
  BinderNode,
  SupportedLocale
} from '@pecie/schemas'

import { t } from '../i18n'
import type {
  BinderTemplateId,
  ComposerDraft,
  EditorFormatAction,
  TemplateId,
  VisibleBinderNode
} from './types'

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildExportFilePath(params: {
  directory: string
  extension: string
  projectTitle: string
  scope: 'current-document' | 'whole-project'
  documentTitle?: string
}): string {
  const baseName =
    params.scope === 'whole-project'
      ? params.projectTitle
      : params.documentTitle?.trim() || params.projectTitle

  return `${params.directory}/${slugify(baseName) || 'export'}.${params.extension}`
}

export function defaultComposer(settings: AppSettings): ComposerDraft {
  return {
    title: '',
    projectName: '',
    template: 'blank',
    language: settings.locale,
    directory: settings.workspaceDirectory
  }
}

export function getGreeting(locale: SupportedLocale, now: Date = new Date()): string {
  const hour = now.getHours()

  if (hour < 12) {
    return t(locale, 'greetingMorning')
  }

  if (hour < 18) {
    return t(locale, 'greetingAfternoon')
  }

  return t(locale, 'greetingEvening')
}

export function stringAccentColor(value: string): string {
  let hash = 0

  for (const char of value) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  }

  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 58% 52%)`
}

export function flattenVisibleNodes(nodes: BinderNode[], rootId: string, expandedFolderIds: Set<string>): VisibleBinderNode[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const visibleNodes: VisibleBinderNode[] = []
  const stack: Array<{ nodeId: string; depth: number; parentId: string | null }> = [{ nodeId: rootId, depth: 0, parentId: null }]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) {
      continue
    }

    const node = nodeMap.get(current.nodeId)
    if (!node) {
      continue
    }

    const isExpanded = node.type === 'folder' ? expandedFolderIds.has(node.id) : undefined

    if (current.nodeId !== rootId) {
      visibleNodes.push({
        ...node,
        depth: current.depth,
        parentId: current.parentId,
        isExpanded
      })
    }

    if (current.nodeId !== rootId && node.type === 'folder' && !isExpanded) {
      continue
    }

    const children = node.children ?? []
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({
        nodeId: children[index],
        depth: current.depth + 1,
        parentId: node.id
      })
    }
  }

  return visibleNodes
}

export function getInitialExpandedFolderIds(nodes: BinderNode[], rootId: string, lazyThreshold = 1000): Set<string> {
  const folderIds = nodes.filter((node) => node.type === 'folder').map((node) => node.id)
  if (nodes.length <= lazyThreshold) {
    return new Set(folderIds)
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const expandedIds = new Set<string>([rootId])
  const stack: Array<{ nodeId: string; ancestorFolderIds: string[] }> = [{ nodeId: rootId, ancestorFolderIds: [rootId] }]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) {
      continue
    }

    const node = nodeMap.get(current.nodeId)
    if (!node) {
      continue
    }

    if (current.nodeId !== rootId && node.type === 'document') {
      current.ancestorFolderIds.forEach((folderId) => expandedIds.add(folderId))
      return expandedIds
    }

    const nextAncestors = node.type === 'folder' ? [...current.ancestorFolderIds, node.id] : current.ancestorFolderIds
    const children = node.children ?? []
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({
        nodeId: children[index],
        ancestorFolderIds: nextAncestors
      })
    }
  }

  return expandedIds
}

export function getInsertionOptions(
  locale: SupportedLocale,
  selectedNode: VisibleBinderNode | null,
  rootId: string
): Array<{ value: 'inside-end' | 'inside-start' | 'before' | 'after'; label: string }> {
  if (!selectedNode) {
    return [
      { value: 'inside-end', label: t(locale, 'newNodePositionEnd') },
      { value: 'inside-start', label: t(locale, 'newNodePositionStart') }
    ]
  }

  const options: Array<{ value: 'inside-end' | 'inside-start' | 'before' | 'after'; label: string }> = []
  if (selectedNode.type === 'folder' || selectedNode.id === rootId) {
    options.push({ value: 'inside-start', label: t(locale, 'newNodePositionStart') })
    options.push({ value: 'inside-end', label: t(locale, 'newNodePositionEnd') })
  }

  options.push({ value: 'before', label: t(locale, 'newNodePositionBefore') })
  options.push({ value: 'after', label: t(locale, 'newNodePositionAfter') })

  return options
}

export function getTemplatePreview(title: string, template: BinderTemplateId): string {
  const safeTitle = title.trim() || 'Untitled'

  if (template === 'chapter') {
    return `# ${safeTitle}\n\n## Obiettivo\n\n## Sviluppo\n\n## Chiusura\n`
  }

  if (template === 'notes') {
    return `# ${safeTitle}\n\n- Punto chiave\n- Fonte\n- Da approfondire\n`
  }

  if (template === 'scene') {
    return `# ${safeTitle}\n\n## Contesto\n\n## Azione\n\n## Esito\n`
  }

  return `# ${safeTitle}\n`
}

export function getWordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0
}

export function isSupportNoteNode(node: Pick<BinderNode, 'type' | 'path'> | null | undefined): boolean {
  return node?.type === 'document' && typeof node.path === 'string' && node.path.startsWith('research/notes/')
}

export function sanitizeRenderedMarkdown(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|embed)[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son[a-z]+="[^"]*"/gi, '')
    .replace(/\son[a-z]+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

export function formatFileSize(sizeBytes: number, locale: SupportedLocale): string {
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: sizeBytes >= 1024 * 1024 ? 1 : 0
  })

  if (sizeBytes >= 1024 * 1024) {
    return `${formatter.format(sizeBytes / (1024 * 1024))} MB`
  }

  if (sizeBytes >= 1024) {
    return `${formatter.format(sizeBytes / 1024)} KB`
  }

  return `${formatter.format(sizeBytes)} B`
}

export function replaceEditorSelection(
  editor: Monaco.editor.IStandaloneCodeEditor,
  nextText: string,
  selectionStartOffset: number,
  selectionEndOffset: number
): void {
  const model = editor.getModel()
  const selection = editor.getSelection()
  if (!model || !selection) {
    return
  }

  const rangeStartOffset = model.getOffsetAt(selection.getStartPosition())

  editor.pushUndoStop()
  editor.executeEdits('pecie-markdown-toolbar', [
    {
      range: selection,
      text: nextText,
      forceMoveMarkers: true
    }
  ])

  const updatedModel = editor.getModel()
  if (!updatedModel) {
    return
  }

  const nextStart = updatedModel.getPositionAt(rangeStartOffset + selectionStartOffset)
  const nextEnd = updatedModel.getPositionAt(rangeStartOffset + selectionEndOffset)
  editor.setSelection({
    startLineNumber: nextStart.lineNumber,
    startColumn: nextStart.column,
    endLineNumber: nextEnd.lineNumber,
    endColumn: nextEnd.column
  })
  editor.focus()
  editor.pushUndoStop()
}

export function wrapSelection(
  editor: Monaco.editor.IStandaloneCodeEditor,
  prefix: string,
  suffix: string,
  placeholder: string
): void {
  const model = editor.getModel()
  const selection = editor.getSelection()
  if (!model || !selection) {
    return
  }

  const selectedText = model.getValueInRange(selection)
  if (selectedText.length > 0) {
    const text = `${prefix}${selectedText}${suffix}`
    replaceEditorSelection(editor, text, prefix.length, prefix.length + selectedText.length)
    return
  }

  const text = `${prefix}${placeholder}${suffix}`
  replaceEditorSelection(editor, text, prefix.length, prefix.length + placeholder.length)
}

export function prependLines(
  editor: Monaco.editor.IStandaloneCodeEditor,
  prefixFactory: (index: number) => string,
  placeholder: string
): void {
  const model = editor.getModel()
  const selection = editor.getSelection()
  if (!model || !selection) {
    return
  }

  const selectedText = model.getValueInRange(selection)
  const base = selectedText.length > 0 ? selectedText : placeholder
  const text = base
    .split('\n')
    .map((line, index) => `${prefixFactory(index)}${line}`)
    .join('\n')

  replaceEditorSelection(editor, text, 0, text.length)
}

export function applyMarkdownFormat(
  editor: Monaco.editor.IStandaloneCodeEditor,
  action: Exclude<EditorFormatAction, 'table'>,
  placeholders: Record<Exclude<EditorFormatAction, 'table'>, string>
): void {
  if (action === 'heading') {
    prependLines(editor, () => '# ', placeholders.heading)
    return
  }

  if (action === 'bold') {
    wrapSelection(editor, '**', '**', placeholders.bold)
    return
  }

  if (action === 'italic') {
    wrapSelection(editor, '_', '_', placeholders.italic)
    return
  }

  if (action === 'underline') {
    wrapSelection(editor, '<u>', '</u>', placeholders.underline)
    return
  }

  if (action === 'strikethrough') {
    wrapSelection(editor, '~~', '~~', placeholders.strikethrough)
    return
  }

  if (action === 'bullets') {
    prependLines(editor, () => '- ', placeholders.bullets)
    return
  }

  if (action === 'numbered') {
    prependLines(editor, (index) => `${index + 1}. `, placeholders.numbered)
    return
  }

  if (action === 'checklist') {
    prependLines(editor, () => '- [ ] ', placeholders.checklist)
    return
  }

  if (action === 'quote') {
    prependLines(editor, () => '> ', placeholders.quote)
    return
  }

  if (action === 'citation') {
    wrapSelection(editor, '“', '”', placeholders.citation)
    return
  }

  if (action === 'footnote') {
    const placeholder = placeholders.footnote
    const footnote = `[^1]`
    const definition = `\n\n[^1]: ${placeholder}`
    wrapSelection(editor, footnote, definition, placeholder)
    return
  }

  if (action === 'link') {
    const placeholder = placeholders.link
    wrapSelection(editor, `[`, '](https://example.com)', placeholder)
    return
  }

  if (action === 'image') {
    const placeholder = placeholders.image
    wrapSelection(editor, '![', '](images/image.jpg)', placeholder)
    return
  }

  if (action === 'inlineCode') {
    wrapSelection(editor, '`', '`', placeholders.inlineCode)
    return
  }

  if (action === 'codeBlock') {
    wrapSelection(editor, '```text\n', '\n```', placeholders.codeBlock)
    return
  }

  if (action === 'highlight') {
    wrapSelection(editor, '==', '==', placeholders.highlight)
    return
  }

  if (action === 'superscript') {
    wrapSelection(editor, '^', '^', placeholders.superscript)
    return
  }

  if (action === 'subscript') {
    wrapSelection(editor, '~', '~', placeholders.subscript)
  }
}

export function insertMarkdownTable(
  editor: Monaco.editor.IStandaloneCodeEditor,
  rows: number,
  columns: number,
  cellLabel: string,
  headerLabel: string
): void {
  const safeRows = Math.max(1, rows)
  const safeColumns = Math.max(1, columns)
  const header = Array.from({ length: safeColumns }, (_, index) => `${headerLabel} ${index + 1}`)
  const separator = Array.from({ length: safeColumns }, () => '---')
  const body = Array.from({ length: safeRows }, () =>
    Array.from({ length: safeColumns }, (_, index) => `${cellLabel} ${index + 1}`)
  )
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`)
  ]

  replaceEditorSelection(editor, `${lines.join('\n')}\n`, 0, lines.join('\n').length)
}

export async function logEvent(
  level: 'info' | 'warn' | 'error',
  category: 'renderer' | 'main' | 'project' | 'settings' | 'export' | 'navigation' | 'bug-report',
  event: string,
  message: string,
  context?: Record<string, string | number | boolean | null>
): Promise<void> {
  await window.pecie.invokeSafe('log:event', {
    level,
    category,
    event,
    message,
    context
  })
}

export function pathLabel(projectPath: string): string {
  return projectPath.split('/').at(-1) ?? projectPath
}

export function formatTemplateLabel(locale: SupportedLocale, templateId: TemplateId): string {
  return t(locale, `template_${templateId}`)
}

export function formatTemplateDescription(locale: SupportedLocale, templateId: TemplateId): string {
  return t(locale, `template_${templateId}_desc`)
}

export function formatTemplateBestFor(locale: SupportedLocale, templateId: TemplateId): string {
  return t(locale, `template_${templateId}_fit`)
}

export function formatTemplateStructure(locale: SupportedLocale, templateId: TemplateId): string {
  return t(locale, `template_${templateId}_structure`)
}

export function formatTemplateOutcome(locale: SupportedLocale, templateId: TemplateId): string {
  return t(locale, `template_${templateId}_outcome`)
}

export function formatNodeType(locale: SupportedLocale, nodeType: BinderNode['type'] | undefined): string {
  if (nodeType === 'document') {
    return t(locale, 'nodeTypeDocumentShort')
  }

  if (nodeType === 'folder') {
    return t(locale, 'nodeTypeFolderShort')
  }

  return t(locale, 'notAvailable')
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

export function createToast(message: string, tone: 'success' | 'info' | 'error' = 'success') {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    tone
  }
}

export function formatRelativeTime(isoDate: string, locale: SupportedLocale): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then

  if (Number.isNaN(diffMs) || diffMs < 0) return ''

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return t(locale, 'timeJustNow')
  if (minutes < 60) return t(locale, 'timeMinutesAgo', { count: String(minutes) })
  if (hours < 24) return t(locale, 'timeHoursAgo', { count: String(hours) })
  if (days < 7) return t(locale, 'timeDaysAgo', { count: String(days) })

  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(isoDate))
}

export function formatSessionDuration(startMs: number): string {
  const elapsed = Math.floor((Date.now() - startMs) / 1000)
  const hours = Math.floor(elapsed / 3600)
  const minutes = Math.floor((elapsed % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
