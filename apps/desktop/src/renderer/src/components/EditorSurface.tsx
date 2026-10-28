import type React from 'react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'

import Editor from '@monaco-editor/react'
import { marked } from 'marked'
import type * as Monaco from 'monaco-editor'
import { Button, EmptyState } from '@pecie/ui'
import { renderVisualBlocksInMarkdown } from '@pecie/domain'
import { visualBlockInsertCommands } from '@pecie/schemas'

import { t } from '../i18n'
import { useDocumentEditor } from '../hooks/useDocumentEditor'
import { ImageInsertDialog } from './ImageInsertDialog'
import { EditorFooter } from './editor/EditorFooter'
import { EditorFormattingBar, EditorTableDialog } from './editor/EditorFormattingBar'
import { EditorStatusBar } from './editor/EditorStatusBar'
import { EditorTitleField } from './editor/EditorTitleField'
import { EditorWordGoalCard } from './editor/EditorWordGoalCard'
import type { CitationLibraryStatus, FormattingActionDefinition } from './editor/types'
import type { EditorFormatAction, EditorSurfaceProps, EditorViewMode, MonacoEditorComponent } from './types'
import { applyMarkdownFormat, getWordCount, insertMarkdownTable, replaceEditorSelection, sanitizeRenderedMarkdown } from './utils'

const MonacoEditor = Editor as unknown as MonacoEditorComponent
const WORD_GOAL_STORAGE_KEY = 'pecie.documentWordGoals'
const CITEKEY_PATTERN = /(?:^|[\s([{\u201c\u2018])@([A-Za-z0-9:_-]*)$/

type IngestHighlightState = {
  token: number
  position: number
}

type PageBreakState = {
  binding: {
    profileId: string
    format: string
    supportsPageMarkers: boolean
    previewKind: 'visual' | 'approximate' | 'reader' | 'text'
  }
  pageBreakMap: {
    totalEstimatedPages: number
    breaks: Array<{ sourceOffset: number; estimatedPageNumber: number }>
  }
}

function getPageMarkersPreferenceKey(projectId: string, profileId: string): string {
  return `${projectId}:${profileId}`
}

function getCitationCompletionContext(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position
): { prefix: string; startColumn: number; endColumn: number } | null {
  const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
  const match = linePrefix.match(CITEKEY_PATTERN)
  if (!match) {
    return null
  }

  const prefix = match[1] ?? ''
  return {
    prefix,
    startColumn: position.column - prefix.length - 1,
    endColumn: position.column
  }
}

function toProjectFileBaseUrl(projectPath: string, documentRelativePath: string): string {
  const normalizedProjectPath = projectPath.replace(/\\/g, '/').replace(/\/+$/, '')
  const normalizedDocumentPath = documentRelativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  const documentDirectory = normalizedDocumentPath.includes('/') ? normalizedDocumentPath.slice(0, normalizedDocumentPath.lastIndexOf('/') + 1) : ''
  const prefixedProjectPath = /^[A-Za-z]:\//.test(normalizedProjectPath) ? `/${normalizedProjectPath}` : normalizedProjectPath

  return encodeURI(`file://${prefixedProjectPath}/${documentDirectory}`)
}

function resolvePreviewImageSources(renderedHtml: string, projectPath: string, documentRelativePath: string): string {
  if (typeof DOMParser === 'undefined' || !renderedHtml.includes('<img')) {
    return renderedHtml
  }

  const parser = new DOMParser()
  const parsedDocument = parser.parseFromString(renderedHtml, 'text/html')
  const baseUrl = toProjectFileBaseUrl(projectPath, documentRelativePath)

  parsedDocument.querySelectorAll('img[src]').forEach((image) => {
    const currentSrc = image.getAttribute('src')?.trim()
    if (!currentSrc || /^(?:[a-z]+:|\/)/i.test(currentSrc)) {
      return
    }

    image.setAttribute('src', new URL(currentSrc, baseUrl).toString())
  })

  return parsedDocument.body.innerHTML
}

const formattingShortcuts: Partial<Record<EditorFormatAction, string>> = {
  heading: 'Ctrl+Alt+1',
  bold: 'Ctrl+B',
  italic: 'Ctrl+I',
  underline: 'Ctrl+U',
  strikethrough: 'Ctrl+Shift+X',
  bullets: 'Ctrl+Shift+7',
  numbered: 'Ctrl+Shift+8',
  checklist: 'Ctrl+Shift+9',
  quote: 'Ctrl+Shift+.',
  link: 'Ctrl+K',
  image: 'Ctrl+Shift+I',
  citation: 'Ctrl+Alt+C',
  footnote: 'Ctrl+Alt+F',
  inlineCode: 'Ctrl+E',
  codeBlock: 'Ctrl+Alt+E',
  highlight: 'Ctrl+Alt+H',
  superscript: 'Ctrl+.',
  subscript: 'Ctrl+,',
  table: 'Ctrl+Alt+T'
}

export function EditorSurface({
  locale,
  project,
  appSettings,
  selectedNode,
  reloadToken,
  authorProfile,
  ingestedDocumentId,
  onImportAttachments,
  onAbsorbSupportNode,
  preferences,
  onPreferencesChange,
  onUpdateAppSettings,
  onDocumentSaved,
  onManualSaved,
  onBodySnapshot,
  onSaveStateChange,
  onWordCountChange,
  onSelectionRangeChange,
  onPageMarkersSummaryChange
}: EditorSurfaceProps): React.JSX.Element {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const citationCompletionDisposableRef = useRef<Monaco.IDisposable | null>(null)
  const [monacoTheme, setMonacoTheme] = useState<'vs' | 'vs-dark'>(document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs')
  const [viewMode, setViewMode] = useState<EditorViewMode>('write')

  // The writing font is a bundled webface chosen at runtime: Monaco caches glyph metrics per
  // font-family string, so re-measure whenever a face finishes loading or the catalog choice changes.
  useEffect(() => {
    const remeasure = (): void => {
      monacoRef.current?.editor.remeasureFonts()
    }
    document.fonts.addEventListener('loadingdone', remeasure)
    const observer = new MutationObserver(remeasure)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-font', 'data-ui-zoom'] })
    return () => {
      document.fonts.removeEventListener('loadingdone', remeasure)
      observer.disconnect()
    }
  }, [])
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false)
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false)
  const [isMarkdownToolsOpen, setIsMarkdownToolsOpen] = useState(false)
  const [isWordGoalEditorOpen, setIsWordGoalEditorOpen] = useState(false)
  const [tableRows, setTableRows] = useState(3)
  const [tableColumns, setTableColumns] = useState(3)
  const [wordGoalsByDocument, setWordGoalsByDocument] = useState<Record<string, number>>({})
  const [wordGoalInput, setWordGoalInput] = useState('')
  const [ingestHighlight, setIngestHighlight] = useState<IngestHighlightState | null>(null)
  const [citationLibraryStatus, setCitationLibraryStatus] = useState<CitationLibraryStatus | null>(null)
  const [sessionStartWordCount, setSessionStartWordCount] = useState(0)
  const [pageBreakState, setPageBreakState] = useState<PageBreakState | null>(null)
  const [pageMarkerAnnouncement, setPageMarkerAnnouncement] = useState('')
  const [editorSelectionRangeState, setEditorSelectionRangeState] = useState<{ startOffset: number; endOffset: number } | null>(null)
  const sessionBaselineDocumentIdRef = useRef<string | null>(null)
  const pageMarkerDecorationsRef = useRef<string[]>([])
  const pageMarkerStyleElementRef = useRef<HTMLStyleElement | null>(null)
  const formatPlaceholders: Record<Exclude<EditorFormatAction, 'table'>, string> = {
    heading: t(locale, 'markdownPlaceholderHeading'),
    bold: t(locale, 'markdownPlaceholderBold'),
    italic: t(locale, 'markdownPlaceholderItalic'),
    underline: t(locale, 'markdownPlaceholderUnderline'),
    strikethrough: t(locale, 'markdownPlaceholderStrikethrough'),
    bullets: t(locale, 'markdownPlaceholderBullets'),
    numbered: t(locale, 'markdownPlaceholderNumbered'),
    checklist: t(locale, 'markdownPlaceholderChecklist'),
    quote: t(locale, 'markdownPlaceholderQuote'),
    link: t(locale, 'markdownPlaceholderLink'),
    image: t(locale, 'markdownPlaceholderImage'),
    citation: t(locale, 'markdownPlaceholderCitation'),
    footnote: t(locale, 'markdownPlaceholderFootnote'),
    inlineCode: t(locale, 'markdownPlaceholderInlineCode'),
    codeBlock: t(locale, 'markdownPlaceholderCodeBlock'),
    highlight: t(locale, 'markdownPlaceholderHighlight'),
    superscript: t(locale, 'markdownPlaceholderSuperscript'),
    subscript: t(locale, 'markdownPlaceholderSubscript')
  }
  const formattingActions = useMemo<FormattingActionDefinition[]>(
    () => [
      { action: 'heading', label: t(locale, 'markdownHeading'), icon: 'type-h2', group: 'core' },
      { action: 'bold', label: t(locale, 'markdownBold'), icon: 'type-bold', group: 'core' },
      { action: 'italic', label: t(locale, 'markdownItalic'), icon: 'type-italic', group: 'core' },
      { action: 'underline', label: t(locale, 'markdownUnderline'), icon: 'type-underline', group: 'core' },
      { action: 'strikethrough', label: t(locale, 'markdownStrikethrough'), icon: 'type-strikethrough', group: 'core' },
      { action: 'highlight', label: t(locale, 'markdownHighlight'), icon: 'highlighter', group: 'core' },
      { action: 'quote', label: t(locale, 'markdownQuote'), icon: 'blockquote-left', group: 'core' },
      { action: 'citation', label: t(locale, 'markdownCitation'), icon: 'chat-left-quote', group: 'core' },
      { action: 'link', label: t(locale, 'markdownLink'), icon: 'link-45deg', group: 'core' },
      { action: 'image', label: t(locale, 'markdownImage'), icon: 'card-image', group: 'insert' },
      { action: 'inlineCode', label: t(locale, 'markdownInlineCode'), icon: 'code', group: 'insert' },
      { action: 'codeBlock', label: t(locale, 'markdownCodeBlock'), icon: 'code-square', group: 'insert' },
      { action: 'bullets', label: t(locale, 'markdownBullets'), icon: 'list-ul', group: 'insert' },
      { action: 'numbered', label: t(locale, 'markdownNumbered'), icon: 'list-ol', group: 'insert' },
      { action: 'checklist', label: t(locale, 'markdownChecklist'), icon: 'check2-square', group: 'insert' },
      { action: 'footnote', label: t(locale, 'markdownFootnote'), icon: '123', group: 'insert' },
      { action: 'superscript', label: t(locale, 'markdownSuperscript'), icon: 'superscript', group: 'insert' },
      { action: 'subscript', label: t(locale, 'markdownSubscript'), icon: 'subscript', group: 'insert' },
      { action: 'table', label: t(locale, 'markdownTable'), icon: 'table', group: 'insert' },
      { action: 'visualMermaid', label: t(locale, 'visualBlocksMermaid'), icon: 'diagram-3', group: 'insert' },
      { action: 'visualMarkmap', label: t(locale, 'visualBlocksMarkmap'), icon: 'diagram-2', group: 'insert' },
      { action: 'visualChart', label: t(locale, 'visualBlocksChart'), icon: 'bar-chart-line', group: 'insert' }
    ],
    [locale]
  )
  const { draftBody, draftTitle, documentId, saveState, setDraftBody, setDraftTitle, statusMessage } = useDocumentEditor(
    locale,
    project,
    selectedNode,
    reloadToken ?? 0,
    authorProfile,
    onDocumentSaved,
    onManualSaved
  )
  const deferredDraftBody = useDeferredValue(draftBody)
  const wordCount = useMemo(() => getWordCount(draftBody), [draftBody])
  const activeDocumentId = selectedNode?.documentId ?? null
  const activeProfileId = project.manifest.defaultExportProfile
  const pageMarkersPreferenceKey = getPageMarkersPreferenceKey(project.manifest.projectId, activeProfileId)
  const showPageMarkers = appSettings.preview.pageMarkers.byProjectAndProfile[pageMarkersPreferenceKey]?.showPageMarkers === true
  const currentWordGoal = activeDocumentId ? wordGoalsByDocument[activeDocumentId] ?? null : null
  const wordGoalProgress = currentWordGoal ? Math.min(wordCount / currentWordGoal, 1) : 0
  const sessionWordDelta = wordCount - sessionStartWordCount
  const sessionWordDeltaLabel = `${sessionWordDelta >= 0 ? '+' : ''}${sessionWordDelta.toLocaleString(locale)}`
  const renderedMarkdown = useMemo(
    () =>
      sanitizeRenderedMarkdown(
        resolvePreviewImageSources(
          marked.parse(renderVisualBlocksInMarkdown(draftBody || `# ${t(locale, 'markdownPreviewEmpty')}`), {
            breaks: true,
            gfm: true
          }) as string,
          project.projectPath,
          selectedNode?.path ?? ''
        )
      ),
    [draftBody, locale, project.projectPath, selectedNode?.path]
  )

  useEffect(() => {
    let ignore = false

    void window.pecie
      .invokeSafe('citations:loadLibrary', {
        projectPath: project.projectPath,
        profileId: project.project.defaultCitationProfileId
      })
      .then((response) => {
        if (ignore) {
          return
        }

        setCitationLibraryStatus({
          entryCount: response.library.entries.length,
          diagnosticsCount: response.library.diagnostics.length
        })
      })
      .catch(() => {
        if (!ignore) {
          setCitationLibraryStatus(null)
        }
      })

    return () => {
      ignore = true
    }
  }, [project.project.defaultCitationProfileId, project.projectPath])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setMonacoTheme(document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs')
    })
    observer.observe(document.documentElement, { attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      citationCompletionDisposableRef.current?.dispose()
      citationCompletionDisposableRef.current = null
      pageMarkerStyleElementRef.current?.remove()
      pageMarkerStyleElementRef.current = null
    }
  }, [])

  useEffect(() => {
    try {
      const storedGoals = window.localStorage.getItem(WORD_GOAL_STORAGE_KEY)
      if (!storedGoals) {
        return
      }
      const parsedGoals = JSON.parse(storedGoals) as unknown
      if (!parsedGoals || typeof parsedGoals !== 'object') {
        return
      }
      setWordGoalsByDocument(
        Object.fromEntries(
          Object.entries(parsedGoals).filter((entry): entry is [string, number] => typeof entry[0] === 'string' && Number.isFinite(entry[1]) && entry[1] > 0)
        )
      )
    } catch {
      window.localStorage.removeItem(WORD_GOAL_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(WORD_GOAL_STORAGE_KEY, JSON.stringify(wordGoalsByDocument))
  }, [wordGoalsByDocument])

  useEffect(() => {
    onBodySnapshot(deferredDraftBody)
  }, [deferredDraftBody, onBodySnapshot])

  useEffect(() => {
    onSaveStateChange?.(saveState, documentId)
  }, [documentId, onSaveStateChange, saveState])

  useEffect(() => {
    onWordCountChange?.(wordCount, documentId)
  }, [documentId, onWordCountChange, wordCount])

  useEffect(() => {
    if (selectedNode?.type !== 'document') {
      return
    }
    const timer = window.setTimeout(() => {
      editorRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedNode?.documentId, selectedNode?.type])

  useEffect(() => {
    setViewMode('write')
    setIsTableDialogOpen(false)
    setIsImageDialogOpen(false)
    setIsWordGoalEditorOpen(false)
    setWordGoalInput(activeDocumentId ? String(wordGoalsByDocument[activeDocumentId] ?? '') : '')
    setIngestHighlight(null)
  }, [activeDocumentId, wordGoalsByDocument])

  useEffect(() => {
    if (!documentId) {
      sessionBaselineDocumentIdRef.current = null
      setSessionStartWordCount(0)
      return
    }

    if (saveState === 'saving' || sessionBaselineDocumentIdRef.current === documentId) {
      return
    }

    sessionBaselineDocumentIdRef.current = documentId
    setSessionStartWordCount(wordCount)
  }, [documentId, saveState, wordCount])

  useEffect(() => {
    if (!selectedNode?.documentId || ingestedDocumentId !== selectedNode.documentId) {
      return
    }

    setIngestHighlight({
      token: Date.now(),
      position: 0.5
    })

    const timer = window.setTimeout(() => {
      setIngestHighlight((current) => (current?.position === 0.5 ? null : current))
    }, 1600)

    return () => window.clearTimeout(timer)
  }, [ingestedDocumentId, selectedNode?.documentId])

  useEffect(() => {
    if (!ingestHighlight) {
      return
    }

    const timer = window.setTimeout(() => {
      setIngestHighlight(null)
    }, 1600)

    return () => window.clearTimeout(timer)
  }, [ingestHighlight])

  const toolbarGroups = useMemo(
    () => ({
      core: formattingActions.filter((entry) => entry.group === 'core'),
      insert: formattingActions.filter((entry) => entry.group === 'insert')
    }),
    [formattingActions]
  )

  function formatToolbarTooltip(entry: FormattingActionDefinition): string {
    const shortcut = entry.action in formattingShortcuts ? formattingShortcuts[entry.action as EditorFormatAction] : undefined
    return shortcut ? `${entry.label} - ${shortcut}` : entry.label
  }

  function handleFormattingAction(entry: FormattingActionDefinition): void {
    if (!editorRef.current) return
    if (entry.action === 'table') {
      setIsTableDialogOpen(true)
      return
    }
    if (entry.action === 'image') {
      setIsImageDialogOpen(true)
      return
    }
    if (entry.action === 'citation') {
      replaceEditorSelection(editorRef.current, '@', 1, 1)
      editorRef.current.trigger('pecie-citation', 'editor.action.triggerSuggest', {})
      return
    }
    if (entry.action === 'visualMermaid' || entry.action === 'visualMarkmap' || entry.action === 'visualChart') {
      const command =
        entry.action === 'visualMermaid'
          ? visualBlockInsertCommands.mermaidDiagram
          : entry.action === 'visualMarkmap'
            ? visualBlockInsertCommands.markmapMindmap
            : visualBlockInsertCommands.rechartsStats
      const template = command.templateFactory()
      const snippet = `\`\`\`${command.markdownFence}\n${template}\n\`\`\`\n`
      replaceEditorSelection(editorRef.current, snippet, snippet.length, snippet.length)
      return
    }
    applyMarkdownFormat(editorRef.current, entry.action, formatPlaceholders)
  }

  function handleWordGoalSave(): void {
    if (!activeDocumentId) {
      return
    }
    const normalizedGoal = Number(wordGoalInput.trim())
    if (!Number.isFinite(normalizedGoal) || normalizedGoal <= 0) {
      setWordGoalsByDocument((currentGoals) => {
        const nextGoals = { ...currentGoals }
        delete nextGoals[activeDocumentId]
        return nextGoals
      })
      setWordGoalInput('')
      setIsWordGoalEditorOpen(false)
      return
    }
    setWordGoalsByDocument((currentGoals) => ({
      ...currentGoals,
      [activeDocumentId]: Math.round(normalizedGoal)
    }))
    setIsWordGoalEditorOpen(false)
  }

  async function handleSupportDrop(event: React.DragEvent<HTMLElement>): Promise<void> {
    if (!selectedNode?.documentId || !editorRef.current || !onAbsorbSupportNode) {
      return
    }
    const sourceNodeId = event.dataTransfer.getData('application/x-pecie-support-node')
    if (!sourceNodeId) {
      return
    }
    event.preventDefault()
    const target = editorRef.current.getTargetAtClientPoint(event.clientX, event.clientY)
    const model = editorRef.current.getModel()
    let offset: number | undefined
    if (target?.position && model) {
      offset = model.getOffsetAt(target.position)
    } else if (model) {
      offset = model.getOffsetAt(editorRef.current.getPosition() ?? model.getFullModelRange().getEndPosition())
    }
    const modelLength = model?.getValueLength() ?? 0
    const highlightPosition =
      typeof offset === 'number' && modelLength > 0
        ? Math.min(Math.max(offset / modelLength, 0.08), 0.92)
        : 0.5
    const mergedDocument = await onAbsorbSupportNode({
      sourceNodeId,
      targetDocumentId: selectedNode.documentId,
      insertion: 'offset',
      offset
    })
    if (mergedDocument) {
      setDraftTitle(mergedDocument.title)
      setDraftBody(mergedDocument.body)
      setIngestHighlight({
        token: Date.now(),
        position: highlightPosition
      })
    }
  }

  async function handleFileDrop(event: React.DragEvent<HTMLElement>): Promise<void> {
    if (!onImportAttachments || !event.dataTransfer.types.includes('Files')) {
      return
    }
    event.preventDefault()
    const droppedPaths = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path)
      .filter((value): value is string => Boolean(value))

    if (droppedPaths.length > 0) {
      await onImportAttachments(droppedPaths)
    }
  }

  async function persistPageMarkersPreference(nextValue: boolean): Promise<void> {
    await onUpdateAppSettings({
      ...appSettings,
      preview: {
        ...appSettings.preview,
        pageMarkers: {
          byProjectAndProfile: {
            ...appSettings.preview.pageMarkers.byProjectAndProfile,
            [pageMarkersPreferenceKey]: {
              projectId: project.manifest.projectId,
              profileId: activeProfileId,
              showPageMarkers: nextValue
            }
          }
        }
      }
    })
  }

  useEffect(() => {
    if (!selectedNode?.documentId || !showPageMarkers) {
      setPageBreakState(null)
      setPageMarkerAnnouncement('')
      return
    }

    let ignore = false
    void window.pecie
      .invokeSafe('preview:getPageBreaks', {
        projectPath: project.projectPath,
        documentId: selectedNode.documentId,
        profileId: activeProfileId
      })
      .then((response) => {
        if (!ignore) {
          setPageBreakState(response)
        }
      })
      .catch(() => {
        if (!ignore) {
          setPageBreakState(null)
        }
      })

    return () => {
      ignore = true
    }
  }, [activeProfileId, appSettings.preview.mode, project.projectPath, selectedNode?.documentId, showPageMarkers])

  useEffect(() => {
    if (saveState !== 'saved' || !selectedNode?.documentId || !showPageMarkers) {
      return
    }

    void window.pecie
      .invokeSafe('preview:getPageBreaks', {
        projectPath: project.projectPath,
        documentId: selectedNode.documentId,
        profileId: activeProfileId
      })
      .then((response) => setPageBreakState(response))
      .catch(() => setPageBreakState(null))
  }, [activeProfileId, project.projectPath, saveState, selectedNode?.documentId, showPageMarkers])

  useEffect(() => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) {
      return
    }

    if (pageMarkerStyleElementRef.current === null) {
      const styleElement = document.createElement('style')
      styleElement.dataset.peciePageMarkers = 'true'
      document.head.appendChild(styleElement)
      pageMarkerStyleElementRef.current = styleElement
    }

    if (!showPageMarkers || !pageBreakState?.binding.supportsPageMarkers) {
      pageMarkerStyleElementRef.current.textContent = ''
      pageMarkerDecorationsRef.current = editor.deltaDecorations(pageMarkerDecorationsRef.current, [])
      return
    }

    const rules: string[] = []
    const decorations = pageBreakState.pageBreakMap.breaks.map((entry, index) => {
      const lineNumber = model.getPositionAt(entry.sourceOffset).lineNumber
      const className = `page-marker-glyph--${index}`
      rules.push(`.monaco-editor .${className}::after { content: "p. ${entry.estimatedPageNumber}"; }`)
      return {
        range: {
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: 1
        },
        options: {
          isWholeLine: true,
          glyphMarginClassName: `page-marker-glyph ${className}`,
          glyphMarginHoverMessage: {
            value: t(locale, 'pageMarkersAnnouncement', {
              current: String(entry.estimatedPageNumber),
              total: String(pageBreakState.pageBreakMap.totalEstimatedPages)
            })
          }
        }
      }
    })

    pageMarkerStyleElementRef.current.textContent = rules.join('\n')
    pageMarkerDecorationsRef.current = editor.deltaDecorations(pageMarkerDecorationsRef.current, decorations)
  }, [locale, pageBreakState, showPageMarkers])

  useEffect(() => {
    if (!showPageMarkers || !pageBreakState?.binding.supportsPageMarkers || !editorSelectionRangeState) {
      setPageMarkerAnnouncement('')
      return
    }

    const breaks = pageBreakState.pageBreakMap.breaks
    const currentOffset = editorSelectionRangeState.startOffset
    const currentPage =
      breaks.filter((entry) => entry.sourceOffset <= currentOffset).slice(-1)[0]?.estimatedPageNumber ??
      (pageBreakState.pageBreakMap.totalEstimatedPages > 0 ? 1 : 0)

    if (currentPage > 0) {
      setPageMarkerAnnouncement(
        t(locale, 'pageMarkersAnnouncement', {
          current: String(currentPage),
          total: String(pageBreakState.pageBreakMap.totalEstimatedPages)
        })
      )
    } else {
      setPageMarkerAnnouncement('')
    }
  }, [editorSelectionRangeState, locale, pageBreakState, showPageMarkers])

  useEffect(() => {
    if (!selectedNode?.documentId) {
      onPageMarkersSummaryChange?.(null)
      return
    }

    onPageMarkersSummaryChange?.({
      body: !showPageMarkers
        ? t(locale, 'pageMarkersUnavailable')
        : pageBreakState && !pageBreakState.binding.supportsPageMarkers
          ? t(locale, 'pageMarkersUnsupported')
          : t(locale, 'pageMarkersEstimateBody'),
      announcement: pageMarkerAnnouncement || undefined
    })
  }, [locale, onPageMarkersSummaryChange, pageBreakState, pageMarkerAnnouncement, selectedNode?.documentId, showPageMarkers])

  return (
    <section
      aria-labelledby="editor-surface-title"
      className={`editor-surface${preferences.focusMode ? ' editor-surface--focus' : ''}${
        ingestedDocumentId && ingestedDocumentId === selectedNode?.documentId ? ' editor-surface--ingested' : ''
      }`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault()
        }
      }}
      onDrop={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          void handleFileDrop(event)
        }
      }}
    >
      <div className="editor-sheet">
        {selectedNode?.type === 'document' ? (
          <>
            <EditorStatusBar
              currentWordGoal={currentWordGoal ?? undefined}
              isMarkdownToolsOpen={isMarkdownToolsOpen}
              isWordGoalEditorOpen={isWordGoalEditorOpen}
              locale={locale}
              onPreferencesChange={onPreferencesChange}
              onToggleMarkdownTools={() => {
                setIsMarkdownToolsOpen((current) => {
                  if (current) {
                    setIsTableDialogOpen(false)
                  }
                  return !current
                })
              }}
              onTogglePageMarkers={() => {
                void persistPageMarkersPreference(!showPageMarkers)
              }}
              onToggleWordGoalEditor={() => setIsWordGoalEditorOpen((current) => !current)}
              onViewModeChange={setViewMode}
              preferences={preferences}
              saveState={saveState}
              showPageMarkers={showPageMarkers}
              statusMessage={statusMessage}
              viewMode={viewMode}
              wordCount={wordCount}
            />
            {isMarkdownToolsOpen ? (
              <>
                <EditorFormattingBar describe={formatToolbarTooltip} groups={toolbarGroups} locale={locale} onAction={handleFormattingAction} />
                {isTableDialogOpen ? (
                  <EditorTableDialog
                    columns={tableColumns}
                    locale={locale}
                    onCancel={() => setIsTableDialogOpen(false)}
                    onColumnsChange={setTableColumns}
                    onInsert={() => {
                      if (!editorRef.current) return
                      insertMarkdownTable(editorRef.current, tableRows, tableColumns, t(locale, 'markdownTableCell'), t(locale, 'markdownTableHeader'))
                      setIsTableDialogOpen(false)
                    }}
                    onRowsChange={setTableRows}
                    rows={tableRows}
                  />
                ) : null}
              </>
            ) : null}
            {selectedNode?.type === 'document' && (currentWordGoal || isWordGoalEditorOpen) ? (
              <EditorWordGoalCard
                currentWordGoal={currentWordGoal ?? undefined}
                locale={locale}
                onCancel={() => setIsWordGoalEditorOpen(false)}
                onSave={handleWordGoalSave}
                onWordGoalInputChange={setWordGoalInput}
                progress={wordGoalProgress}
                wordCount={wordCount}
                wordGoalInput={wordGoalInput}
              />
            ) : null}

            <EditorTitleField locale={locale} onChange={setDraftTitle} value={draftTitle} />

            {/* ── Editor area ── */}
            <div className={`editor-layout editor-layout--${viewMode}`}>
              <div
                aria-hidden={viewMode === 'preview'}
                className={`editor-pane editor-pane--editor${viewMode === 'preview' ? ' editor-pane--hidden' : ''}`}
              >
                <div
                  className={`editor-monaco${preferences.typewriterMode ? ' editor-monaco--typewriter' : ''}${ingestHighlight ? ' editor-monaco--ingest-highlight' : ''}`}
                  onDragOver={(event) => {
                    if (event.dataTransfer.types.includes('application/x-pecie-support-node')) {
                      event.preventDefault()
                    }
                  }}
                  onDrop={(event) => {
                    void handleSupportDrop(event)
                  }}
                  style={
                    ingestHighlight
                      ? ({ '--ingest-highlight-position': `${Math.round(ingestHighlight.position * 100)}%` } as React.CSSProperties)
                      : undefined
                  }
                >
                  {ingestHighlight ? <span aria-hidden="true" className="editor-monaco__ingest-flash" key={ingestHighlight.token}></span> : null}
                  <MonacoEditor
                    height="100%"
                    language="markdown"
                    onChange={(value: string | undefined) => setDraftBody(value ?? '')}
                    onMount={(editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
                      editorRef.current = editor
                      monacoRef.current = monaco
                      citationCompletionDisposableRef.current?.dispose()
                      citationCompletionDisposableRef.current = monaco.languages.registerCompletionItemProvider('markdown', {
                        triggerCharacters: ['@'],
                        provideCompletionItems: async (model, position) => {
                          const context = getCitationCompletionContext(model, position)
                          if (!context) {
                            return { suggestions: [] }
                          }

                          const response = await window.pecie.invokeSafe('citations:suggest', {
                            projectPath: project.projectPath,
                            prefix: context.prefix,
                            limit: 8,
                            profileId: project.project.defaultCitationProfileId
                          })

                          return {
                            suggestions: response.suggestions.map((suggestion) => ({
                              label: `@${suggestion.citeKey}`,
                              kind: monaco.languages.CompletionItemKind.Reference,
                              insertText: `[@${suggestion.citeKey}]`,
                              detail: [suggestion.authorsShort, suggestion.year].filter(Boolean).join(' • '),
                              documentation: `${suggestion.displayTitle}\n${suggestion.sourcePath}`,
                              range: new monaco.Range(
                                position.lineNumber,
                                context.startColumn,
                                position.lineNumber,
                                context.endColumn
                              )
                            }))
                          }
                        }
                      })
                      const model = editor.getModel()
                      if (model) {
                        setEditorSelectionRangeState({
                          startOffset: 0,
                          endOffset: 0
                        })
                        onSelectionRangeChange?.({
                          startOffset: 0,
                          endOffset: 0
                        })
                      }
                      editor.onDidChangeCursorSelection((event) => {
                        const currentModel = editor.getModel()
                        if (!currentModel) {
                          setEditorSelectionRangeState(null)
                          onSelectionRangeChange?.(null)
                          return
                        }
                        const nextRange = {
                          startOffset: currentModel.getOffsetAt(event.selection.getStartPosition()),
                          endOffset: currentModel.getOffsetAt(event.selection.getEndPosition())
                        }
                        setEditorSelectionRangeState(nextRange)
                        onSelectionRangeChange?.(nextRange)
                      })
                      editor.focus()
                    }}
                    options={{
                      automaticLayout: true,
                      cursorSurroundingLines: preferences.typewriterMode ? 12 : 3,
                      fontFamily: 'var(--pecie-font-body)',
                      fontSize: preferences.focusMode ? 17 : 16,
                      folding: false,
                      glyphMargin: true,
                      lineHeight: preferences.focusMode ? 32 : 28,
                      lineNumbers: 'off',
                      minimap: { enabled: false },
                      overviewRulerLanes: 0,
                      padding: { top: preferences.typewriterMode ? 96 : 18, bottom: 40 },
                      renderLineHighlight: 'none',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on'
                    }}
                    theme={monacoTheme}
                    value={draftBody}
                  />
                </div>
              </div>
              <div
                aria-hidden={viewMode === 'write'}
                className={`editor-pane editor-pane--preview${viewMode === 'write' ? ' editor-pane--hidden' : ''}`}
              >
                <article className="markdown-render" aria-label={t(locale, 'editorViewPreview')} dangerouslySetInnerHTML={{ __html: renderedMarkdown }}></article>
              </div>
            </div>

            <ImageInsertDialog
              open={isImageDialogOpen}
              locale={locale}
              projectPath={project.projectPath}
              documentRelativePath={selectedNode?.path ?? ''}
              onClose={() => setIsImageDialogOpen(false)}
              onInsert={(snippet) => {
                if (!editorRef.current) return
                replaceEditorSelection(editorRef.current, `${snippet}\n`, 0, snippet.length + 1)
              }}
            />

            <EditorFooter
              citationLibraryStatus={citationLibraryStatus}
              locale={locale}
              preferences={preferences}
              sessionWordDelta={sessionWordDelta}
              sessionWordDeltaLabel={sessionWordDeltaLabel}
              wordCount={wordCount}
            />
          </>
        ) : (
          <EmptyState
            actions={
              <>
                <Button onClick={() => void onImportAttachments?.()} size="sm" type="button" variant="secondary">
                  {t(locale, 'importAttachment')}
                </Button>
                <span className="muted-copy">{t(locale, 'attachmentsDropzoneBody')}</span>
              </>
            }
            body={t(locale, 'emptyStateBody')}
            icon="journal-text"
            premium
            title={t(locale, 'emptyStateTitle')}
            titleId="editor-surface-title"
          />
        )}
      </div>
    </section>
  )
}
