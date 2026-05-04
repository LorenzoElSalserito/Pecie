import type React from 'react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'

import Editor from '@monaco-editor/react'
import { marked } from 'marked'
import type * as Monaco from 'monaco-editor'
import { Button } from '@pecie/ui'
import typeH2Icon from 'bootstrap-icons/icons/type-h2.svg'
import typeBoldIcon from 'bootstrap-icons/icons/type-bold.svg'
import typeItalicIcon from 'bootstrap-icons/icons/type-italic.svg'
import typeUnderlineIcon from 'bootstrap-icons/icons/type-underline.svg'
import typeStrikethroughIcon from 'bootstrap-icons/icons/type-strikethrough.svg'
import listUlIcon from 'bootstrap-icons/icons/list-ul.svg'
import listOlIcon from 'bootstrap-icons/icons/list-ol.svg'
import checklistIcon from 'bootstrap-icons/icons/check2-square.svg'
import quoteIcon from 'bootstrap-icons/icons/blockquote-left.svg'
import linkIcon from 'bootstrap-icons/icons/link-45deg.svg'
import imageIcon from 'bootstrap-icons/icons/card-image.svg'
import citationIcon from 'bootstrap-icons/icons/chat-left-quote.svg'
import footnoteIcon from 'bootstrap-icons/icons/123.svg'
import inlineCodeIcon from 'bootstrap-icons/icons/code.svg'
import codeBlockIcon from 'bootstrap-icons/icons/code-square.svg'
import highlightIcon from 'bootstrap-icons/icons/highlighter.svg'
import superscriptIcon from 'bootstrap-icons/icons/superscript.svg'
import subscriptIcon from 'bootstrap-icons/icons/subscript.svg'
import tableIcon from 'bootstrap-icons/icons/table.svg'

import { t } from '../i18n'
import { useDocumentEditor } from '../hooks/useDocumentEditor'
import { ImageInsertDialog } from './ImageInsertDialog'
import type { EditorFormatAction, EditorSurfaceProps, EditorViewMode, MonacoEditorComponent } from './types'
import { applyMarkdownFormat, getWordCount, insertMarkdownTable, replaceEditorSelection, sanitizeRenderedMarkdown } from './utils'

const MonacoEditor = Editor as unknown as MonacoEditorComponent
const WORD_GOAL_STORAGE_KEY = 'pecie.documentWordGoals'
const CITEKEY_PATTERN = /(?:^|[\s([{\u201c\u2018])@([A-Za-z0-9:_-]*)$/

type FormattingActionDefinition = {
  action: EditorFormatAction
  label: string
  icon: string
  group: 'core' | 'insert'
}

type IngestHighlightState = {
  token: number
  position: number
}

type CitationLibraryStatus = {
  entryCount: number
  diagnosticsCount: number
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
  onSelectionRangeChange
}: EditorSurfaceProps): React.JSX.Element {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const citationCompletionDisposableRef = useRef<Monaco.IDisposable | null>(null)
  const [monacoTheme, setMonacoTheme] = useState<'vs' | 'vs-dark'>(document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs')
  const [viewMode, setViewMode] = useState<EditorViewMode>('write')
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false)
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false)
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
      { action: 'heading', label: t(locale, 'markdownHeading'), icon: typeH2Icon, group: 'core' },
      { action: 'bold', label: t(locale, 'markdownBold'), icon: typeBoldIcon, group: 'core' },
      { action: 'italic', label: t(locale, 'markdownItalic'), icon: typeItalicIcon, group: 'core' },
      { action: 'underline', label: t(locale, 'markdownUnderline'), icon: typeUnderlineIcon, group: 'core' },
      { action: 'strikethrough', label: t(locale, 'markdownStrikethrough'), icon: typeStrikethroughIcon, group: 'core' },
      { action: 'highlight', label: t(locale, 'markdownHighlight'), icon: highlightIcon, group: 'core' },
      { action: 'quote', label: t(locale, 'markdownQuote'), icon: quoteIcon, group: 'core' },
      { action: 'citation', label: t(locale, 'markdownCitation'), icon: citationIcon, group: 'core' },
      { action: 'link', label: t(locale, 'markdownLink'), icon: linkIcon, group: 'core' },
      { action: 'image', label: t(locale, 'markdownImage'), icon: imageIcon, group: 'insert' },
      { action: 'inlineCode', label: t(locale, 'markdownInlineCode'), icon: inlineCodeIcon, group: 'insert' },
      { action: 'codeBlock', label: t(locale, 'markdownCodeBlock'), icon: codeBlockIcon, group: 'insert' },
      { action: 'bullets', label: t(locale, 'markdownBullets'), icon: listUlIcon, group: 'insert' },
      { action: 'numbered', label: t(locale, 'markdownNumbered'), icon: listOlIcon, group: 'insert' },
      { action: 'checklist', label: t(locale, 'markdownChecklist'), icon: checklistIcon, group: 'insert' },
      { action: 'footnote', label: t(locale, 'markdownFootnote'), icon: footnoteIcon, group: 'insert' },
      { action: 'superscript', label: t(locale, 'markdownSuperscript'), icon: superscriptIcon, group: 'insert' },
      { action: 'subscript', label: t(locale, 'markdownSubscript'), icon: subscriptIcon, group: 'insert' },
      { action: 'table', label: t(locale, 'markdownTable'), icon: tableIcon, group: 'insert' }
    ],
    [locale]
  )
  const { draftBody, draftTitle, documentId, saveNow, saveState, setDraftBody, setDraftTitle, statusMessage } = useDocumentEditor(
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
          marked.parse(draftBody || `# ${t(locale, 'markdownPreviewEmpty')}`, {
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
    const shortcut = formattingShortcuts[entry.action]
    return shortcut ? `${entry.label} - ${shortcut}` : entry.label
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
            {/* ── Row 1: Status bar ── */}
            <div className="editor-statusbar">
              <div className="editor-statusbar__left" role="status" aria-live="polite">
                <span className={`save-indicator save-indicator--${saveState}`} aria-hidden="true"></span>
                <span>{statusMessage}</span>
                <span className="editor-statusbar__divider" aria-hidden="true"></span>
                <span className="editor-statusbar__metric">{wordCount} {t(locale, 'wordCount').toLowerCase()}</span>
                {currentWordGoal ? (
                  <>
                    <span className="editor-statusbar__divider" aria-hidden="true"></span>
                    <span className="editor-statusbar__goal-copy">
                      {t(locale, 'wordGoalProgress', { current: String(wordCount), goal: String(currentWordGoal) })}
                    </span>
                  </>
                ) : null}
              </div>
              <div className="editor-statusbar__right">
                <button
                  aria-expanded={isWordGoalEditorOpen}
                  className={`toggle-chip${currentWordGoal ? ' toggle-chip--accent' : ''}`}
                  onClick={() => setIsWordGoalEditorOpen((current) => !current)}
                  type="button"
                >
                  {currentWordGoal ? t(locale, 'editWordGoal') : t(locale, 'setWordGoal')}
                </button>
                <button
                  aria-pressed={showPageMarkers}
                  className={`toggle-chip${showPageMarkers ? ' toggle-chip--accent' : ''}`}
                  onClick={() => {
                    void persistPageMarkersPreference(!showPageMarkers)
                  }}
                  type="button"
                >
                  {t(locale, 'showPageMarkers')}
                </button>
                <div aria-label={t(locale, 'editorViewMode')} className="segmented-control" role="tablist">
                  {([
                    ['write', t(locale, 'editorViewWrite')],
                    ['preview', t(locale, 'editorViewPreview')],
                    ['split', t(locale, 'editorViewSplit')]
                  ] as Array<[EditorViewMode, string]>).map(([mode, label]) => (
                    <button
                      aria-selected={viewMode === mode}
                      className={`segmented-control__item${viewMode === mode ? ' segmented-control__item--active' : ''}`}
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      role="tab"
                      tabIndex={viewMode === mode ? 0 : -1}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  aria-pressed={preferences.focusMode}
                  className="toggle-chip"
                  onClick={() => onPreferencesChange({ ...preferences, focusMode: !preferences.focusMode })}
                  type="button"
                >
                  {t(locale, 'focusMode')}
                </button>
                <button
                  aria-pressed={preferences.typewriterMode}
                  className="toggle-chip"
                  onClick={() => onPreferencesChange({ ...preferences, typewriterMode: !preferences.typewriterMode })}
                  type="button"
                >
                  {t(locale, 'typewriterMode')}
                </button>
                <Button onClick={() => void saveNow('manual')} size="sm" variant="secondary">
                  {t(locale, 'saveNow')}
                </Button>
              </div>
            </div>
            {selectedNode?.type === 'document' && (currentWordGoal || isWordGoalEditorOpen) ? (
              <div className="editor-goal-card">
                <div className="editor-goal-card__header">
                  <div className="editor-goal-card__summary">
                    <strong>{t(locale, 'wordGoalLabel')}</strong>
                    <span>
                      {currentWordGoal
                        ? t(locale, 'wordGoalProgress', { current: String(wordCount), goal: String(currentWordGoal) })
                        : t(locale, 'wordGoalUnset')}
                    </span>
                  </div>
                  <label className="editor-goal-card__field">
                    <span>{t(locale, 'wordGoalInputLabel')}</span>
                    <input
                      inputMode="numeric"
                      min={1}
                      onChange={(event) => setWordGoalInput(event.target.value)}
                      placeholder="5000"
                      type="number"
                      value={wordGoalInput}
                    />
                  </label>
                  <div className="editor-goal-card__actions">
                    <Button onClick={() => setIsWordGoalEditorOpen(false)} size="sm" type="button" variant="ghost">
                      {t(locale, 'cancel')}
                    </Button>
                    <Button
                      disabled={!wordGoalInput.trim() && !currentWordGoal}
                      onClick={handleWordGoalSave}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      {wordGoalInput.trim() ? t(locale, 'saveWordGoal') : t(locale, 'clearWordGoal')}
                    </Button>
                  </div>
                </div>
                <div
                  aria-hidden="true"
                  className="editor-word-goal-progress"
                >
                  <span className="editor-word-goal-progress__fill" style={{ width: `${wordGoalProgress * 100}%` }}></span>
                </div>
              </div>
            ) : null}

            <div className="editor-page-markers-meta" aria-live="polite">
              <strong>{t(locale, 'pageMarkersEstimated')}</strong>
              <span>
                {!showPageMarkers
                  ? t(locale, 'pageMarkersUnavailable')
                  : pageBreakState && !pageBreakState.binding.supportsPageMarkers
                    ? t(locale, 'pageMarkersUnsupported')
                    : t(locale, 'pageMarkersEstimateBody')}
              </span>
              {pageMarkerAnnouncement ? <span className="sr-only">{pageMarkerAnnouncement}</span> : null}
            </div>

            {/* ── Title (inline editable) ── */}
            <div className="editor-title-field">
              <input
                aria-label={t(locale, 'editorTitle')}
                className="editor-title-input"
                id="editor-surface-title"
                placeholder={t(locale, 'projectTitlePlaceholder')}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
              />
            </div>

            {/* ── Table dialog (inline) ── */}
            {isTableDialogOpen ? (
              <section className="context-card context-card--soft">
                <div className="section-heading section-heading--compact">
                  <h3>{t(locale, 'markdownTableDialogTitle')}</h3>
                </div>
                <div className="field-grid">
                  <label className="field">
                    <span>{t(locale, 'markdownTableRows')}</span>
                    <input max={20} min={1} onChange={(event) => setTableRows(Number(event.target.value) || 1)} type="number" value={tableRows} />
                  </label>
                  <label className="field">
                    <span>{t(locale, 'markdownTableColumns')}</span>
                    <input max={10} min={1} onChange={(event) => setTableColumns(Number(event.target.value) || 1)} type="number" value={tableColumns} />
                  </label>
                </div>
                <div className="dialog-actions dialog-actions--inline">
                  <Button onClick={() => setIsTableDialogOpen(false)} size="sm" type="button" variant="ghost">
                    {t(locale, 'cancel')}
                  </Button>
                  <Button
                    onClick={() => {
                      if (!editorRef.current) return
                      insertMarkdownTable(editorRef.current, tableRows, tableColumns, t(locale, 'markdownTableCell'), t(locale, 'markdownTableHeader'))
                      setIsTableDialogOpen(false)
                    }}
                    size="sm"
                    type="button"
                  >
                    {t(locale, 'insertTable')}
                  </Button>
                </div>
              </section>
            ) : null}

            {/* ── Row 2: Formatting toolbar ── */}
            <div className="editor-formatting-bar">
              {(['core', 'insert'] as const).map((groupKey) => (
                <div className="editor-formatting-bar__group" key={groupKey}>
                  <span className="editor-formatting-bar__label">{t(locale, groupKey === 'core' ? 'formattingGroupCore' : 'formattingGroupInsert')}</span>
                  <div className="editor-formatting-bar__chips" aria-label={t(locale, 'markdownAssist')} role="toolbar">
                    {toolbarGroups[groupKey].map((entry) => (
                      <button
                        aria-label={formatToolbarTooltip(entry)}
                        className="format-chip"
                        key={entry.action}
                        onClick={() => {
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
                          applyMarkdownFormat(editorRef.current, entry.action, formatPlaceholders)
                        }}
                        title={formatToolbarTooltip(entry)}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className="format-chip__icon"
                          style={{ '--format-icon': `url(${entry.icon})` } as React.CSSProperties}
                        ></span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

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
                      padding: { top: preferences.typewriterMode ? 96 : 28, bottom: 48 },
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

            {/* ── Compact status footer ── */}
            <div className="editor-footer">
              <span>{wordCount} {t(locale, 'wordCount').toLowerCase()}</span>
              {citationLibraryStatus ? (
                <>
                  <span className="editor-footer__divider" aria-hidden="true"></span>
                  <span>
                    {t(locale, 'citationLibraryReady', {
                      count: citationLibraryStatus.entryCount.toLocaleString(locale)
                    })}
                    {citationLibraryStatus.diagnosticsCount > 0
                      ? ` · ${t(locale, 'citationLibraryIssues', {
                          count: citationLibraryStatus.diagnosticsCount.toLocaleString(locale)
                        })}`
                      : ''}
                  </span>
                </>
              ) : null}
              <span className="editor-footer__divider" aria-hidden="true"></span>
              <span
                className={`editor-footer__session${
                  sessionWordDelta > 0
                    ? ' editor-footer__session--positive'
                    : sessionWordDelta < 0
                      ? ' editor-footer__session--negative'
                      : ''
                }`}
              >
                {t(locale, 'sessionProgress', { count: sessionWordDeltaLabel })}
              </span>
              <span>{preferences.focusMode ? `${t(locale, 'focusMode')}: ${t(locale, 'enabled')}` : ''}</span>
              <span>{preferences.typewriterMode ? `${t(locale, 'typewriterMode')}: ${t(locale, 'enabled')}` : ''}</span>
              <span className="editor-footer__shortcut">Cmd/Ctrl+S</span>
            </div>
          </>
        ) : (
          <div className="empty-state empty-state--premium">
            <div aria-hidden="true" className="empty-state__icon empty-state__icon--large">
              <i className="bi bi-journal-text"></i>
            </div>
            <h2 className="empty-state__title" id="editor-surface-title">{t(locale, 'emptyStateTitle')}</h2>
            <p>{t(locale, 'emptyStateBody')}</p>
            <div className="empty-state__actions">
              <Button onClick={() => void onImportAttachments?.()} size="sm" type="button" variant="secondary">
                {t(locale, 'importAttachment')}
              </Button>
              <span className="muted-copy">{t(locale, 'attachmentsDropzoneBody')}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
