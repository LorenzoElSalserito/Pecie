import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  AttachmentRecord,
  DiffDocumentResponse,
  DocumentRecord,
  ImportAttachmentsResponse,
  ListTimelineResponse,
  RestoreDocumentResponse
} from '@pecie/schemas'

import { useBinderSelection } from '../hooks/useBinderSelection'
import { t } from '../i18n'
import { BinderPanel } from './BinderPanel'
import { ContextPanel } from './ContextPanel'
import { CorkboardView } from './CorkboardView'
import { EditorSurface } from './EditorSurface'
import { GlobalSearchDialog } from './GlobalSearchDialog'
import { HistoryDiffDialog } from './HistoryDiffDialog'
import { OutlinerView } from './OutlinerView'
import { ResizeHandle } from './ResizeHandle'
import { ScriveningsView } from './ScriveningsView'
import { TimelineView } from './TimelineView'
import type { WorkspaceProps } from './types'
import { WorkspaceHeader } from './WorkspaceHeader'

const DEFAULT_BINDER_WIDTH = 280
const DEFAULT_CONTEXT_WIDTH = 300
const MIN_PANEL_WIDTH = 200
const MAX_PANEL_WIDTH = 480

const milestoneThresholds = [1000, 5000, 10000, 25000, 50000] as const

function getLayoutStorageKey(projectPath: string): string {
  return `pecie.workspaceLayout:${projectPath}`
}

export function Workspace({
  locale,
  project,
  authorProfile,
  onSelectionChange,
  onProjectChange,
  onManualDocumentSaved,
  onNotify,
  onPreviewAttachment,
  onOpenGuide,
  onBackToProjects,
  onManageProjects,
  onNewProject,
  onOpenProject,
  onOpenExport,
  onOpenSettings
}: WorkspaceProps): React.JSX.Element {
  const { selectedId, selectedNode, setSelectedId, toggleFolder, visibleNodes } = useBinderSelection(project)
  const [editorSnapshot, setEditorSnapshot] = useState('')
  const [attachments, setAttachments] = useState<AttachmentRecord[]>([])
  const [attachmentsDirectoryPath, setAttachmentsDirectoryPath] = useState('')
  const [maxAttachmentSizeBytes, setMaxAttachmentSizeBytes] = useState(500 * 1024 * 1024)
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [attachmentsBusy, setAttachmentsBusy] = useState(false)
  const [binderCollapsed, setBinderCollapsed] = useState(true)
  const [contextCollapsed, setContextCollapsed] = useState(true)
  const [preferences, setPreferences] = useState({ focusMode: false, typewriterMode: false })
  const [dirtyDocumentId, setDirtyDocumentId] = useState<string | null>(null)
  const [currentWordCount, setCurrentWordCount] = useState(0)
  const [celebratedMilestones, setCelebratedMilestones] = useState<string[]>([])
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false)
  const [ingestedDocumentId, setIngestedDocumentId] = useState<string | null>(null)
  const [binderWidth, setBinderWidth] = useState(DEFAULT_BINDER_WIDTH)
  const [contextWidth, setContextWidth] = useState(DEFAULT_CONTEXT_WIDTH)
  const [timeline, setTimeline] = useState<ListTimelineResponse | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [editorReloadToken, setEditorReloadToken] = useState(0)
  const [historyDialogState, setHistoryDialogState] = useState<{
    mode: 'diff' | 'restore'
    title: string
    subtitle?: string
    sourceTimelineEventId?: string
    diff: DiffDocumentResponse | RestoreDocumentResponse['preview']
  } | null>(null)
  const [historyDialogBusy, setHistoryDialogBusy] = useState(false)
  const [workspaceView, setWorkspaceView] = useState<'editor' | 'timeline' | 'outliner' | 'corkboard' | 'scrivenings'>('editor')
  const [documentSummaries, setDocumentSummaries] = useState<
    Array<{
      nodeId: string
      documentId: string
      title: string
      path: string
      status: string
      tags: string[]
      summary: string
      includeInExport: boolean
      updatedAt: string
      wordCount: number
      body: string
    }>
  >([])
  const [editorSelectionRange, setEditorSelectionRange] = useState<{ startOffset: number; endOffset: number } | null>(null)

  useEffect(() => {
    setEditorSnapshot('')
    setAttachments([])
    setAttachmentsDirectoryPath('')
    setPreferences({ focusMode: false, typewriterMode: false })
    setDirtyDocumentId(null)
    setCurrentWordCount(0)
    setIngestedDocumentId(null)
    setTimeline(null)
    setWorkspaceView('editor')
    setDocumentSummaries([])
    setEditorSelectionRange(null)
  }, [project.projectPath])

  useEffect(() => {
    const layoutKey = getLayoutStorageKey(project.projectPath)
    const storedLayout = window.localStorage.getItem(layoutKey)

    if (!storedLayout) {
      setBinderCollapsed(true)
      setContextCollapsed(true)
      setBinderWidth(DEFAULT_BINDER_WIDTH)
      setContextWidth(DEFAULT_CONTEXT_WIDTH)
      return
    }

    try {
      const parsedLayout = JSON.parse(storedLayout) as {
        binderCollapsed?: boolean
        contextCollapsed?: boolean
        binderWidth?: number
        contextWidth?: number
      }

      setBinderCollapsed(parsedLayout.binderCollapsed ?? true)
      setContextCollapsed(parsedLayout.contextCollapsed ?? true)
      setBinderWidth(
        typeof parsedLayout.binderWidth === 'number'
          ? Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, parsedLayout.binderWidth))
          : DEFAULT_BINDER_WIDTH
      )
      setContextWidth(
        typeof parsedLayout.contextWidth === 'number'
          ? Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, parsedLayout.contextWidth))
          : DEFAULT_CONTEXT_WIDTH
      )
    } catch {
      window.localStorage.removeItem(layoutKey)
      setBinderCollapsed(true)
      setContextCollapsed(true)
      setBinderWidth(DEFAULT_BINDER_WIDTH)
      setContextWidth(DEFAULT_CONTEXT_WIDTH)
    }
  }, [project.projectPath])

  useEffect(() => {
    window.localStorage.setItem(
      getLayoutStorageKey(project.projectPath),
      JSON.stringify({
        binderCollapsed,
        contextCollapsed,
        binderWidth,
        contextWidth
      })
    )
  }, [binderCollapsed, binderWidth, contextCollapsed, contextWidth, project.projectPath])

  useEffect(() => {
    if (!selectedNode?.documentId) {
      return
    }
    const milestone = [...milestoneThresholds].reverse().find((threshold) => currentWordCount >= threshold)
    if (!milestone) {
      return
    }
    const milestoneKey = `${selectedNode.documentId}:${milestone}`
    if (celebratedMilestones.includes(milestoneKey)) {
      return
    }
    setCelebratedMilestones((current) => [...current, milestoneKey])
    onNotify(
      t(locale, 'toastMilestoneReached', {
        count: milestone.toLocaleString(locale),
        document: selectedNode.title
      }),
      'info'
    )
  }, [celebratedMilestones, currentWordCount, locale, onNotify, selectedNode?.documentId, selectedNode?.title])

  useEffect(() => {
    onSelectionChange(selectedNode)
  }, [onSelectionChange, selectedNode])

  const refreshAttachments = useCallback(async () => {
    setAttachmentsLoading(true)
    try {
      const response = await window.pecie.invokeSafe('attachment:list', { projectPath: project.projectPath })
      setAttachments(response.items)
      setAttachmentsDirectoryPath(response.attachmentsDirectoryPath)
      setMaxAttachmentSizeBytes(response.maxFileSizeBytes)
    } finally {
      setAttachmentsLoading(false)
    }
  }, [project.projectPath])

  useEffect(() => {
    void refreshAttachments()
  }, [refreshAttachments])

  const refreshTimeline = useCallback(async () => {
    setTimelineLoading(true)
    try {
      const response = await window.pecie.invokeSafe('history:listTimeline', {
        projectPath: project.projectPath
      })
      setTimeline(response)
    } finally {
      setTimelineLoading(false)
    }
  }, [project.projectPath])

  useEffect(() => {
    void refreshTimeline()
  }, [refreshTimeline])

  const refreshDocumentSummaries = useCallback(async () => {
    const documentNodes = project.binder.nodes.filter(
      (node): node is typeof node & { documentId: string; path: string } =>
        node.type === 'document' && typeof node.documentId === 'string' && typeof node.path === 'string'
    )
    const loadedDocuments = await Promise.all(
      documentNodes.map(async (node) => {
        const response = await window.pecie.invokeSafe('document:load', {
          projectPath: project.projectPath,
          documentId: node.documentId
        })
        const tags = Array.isArray(response.document.frontmatter.tags)
          ? response.document.frontmatter.tags.filter((tag): tag is string => typeof tag === 'string')
          : []
        const status = typeof response.document.frontmatter.status === 'string' ? response.document.frontmatter.status : 'draft'
        const summary = typeof response.document.frontmatter.summary === 'string' ? response.document.frontmatter.summary : ''
        const includeInExport =
          typeof response.document.frontmatter.includeInExport === 'boolean' ? response.document.frontmatter.includeInExport : true
        const updatedAt = typeof response.document.frontmatter.updatedAt === 'string' ? response.document.frontmatter.updatedAt : ''
        const wordCount = response.document.body.trim() ? response.document.body.trim().split(/\s+/).length : 0
        return {
          nodeId: node.id,
          documentId: node.documentId,
          title: response.document.title,
          path: response.document.path,
          status,
          tags,
          summary,
          includeInExport,
          updatedAt,
          wordCount,
          body: response.document.body
        }
      })
    )
    setDocumentSummaries(loadedDocuments)
  }, [project.binder.nodes, project.projectPath])

  useEffect(() => {
    void refreshDocumentSummaries()
  }, [refreshDocumentSummaries])

  const handleDocumentSaved = useCallback(
    (document: DocumentRecord) => {
      onProjectChange({
        ...project,
        binder: {
          ...project.binder,
          nodes: project.binder.nodes.map((node) => (node.documentId === document.documentId ? { ...node, title: document.title } : node))
        }
      })
      setDocumentSummaries((current) =>
        current.map((item) =>
          item.documentId === document.documentId
            ? {
                ...item,
                title: document.title,
                path: document.path,
                status: typeof document.frontmatter.status === 'string' ? document.frontmatter.status : item.status,
                tags: Array.isArray(document.frontmatter.tags)
                  ? document.frontmatter.tags.filter((tag): tag is string => typeof tag === 'string')
                  : item.tags,
                summary: typeof document.frontmatter.summary === 'string' ? document.frontmatter.summary : item.summary,
                includeInExport:
                  typeof document.frontmatter.includeInExport === 'boolean'
                    ? document.frontmatter.includeInExport
                    : item.includeInExport,
                updatedAt: typeof document.frontmatter.updatedAt === 'string' ? document.frontmatter.updatedAt : item.updatedAt,
                wordCount: document.body.trim() ? document.body.trim().split(/\s+/).length : 0,
                body: document.body
              }
            : item
        )
      )
    },
    [onProjectChange, project]
  )

  const writingHubNodes = useMemo(
    () => project.binder.nodes.filter((node) => node.type === 'document' && typeof node.path === 'string' && node.path.startsWith('research/notes/')),
    [project.binder.nodes]
  )

  const scriveningsDocuments = useMemo(() => {
    if (!selectedNode) {
      return documentSummaries
    }
    if (selectedNode.type === 'document') {
      return documentSummaries.filter((item) => item.nodeId === selectedNode.id)
    }
    const descendantIds = new Set<string>()
    const queue = [...(selectedNode.children ?? [])]
    while (queue.length > 0) {
      const nextId = queue.shift()
      if (!nextId) continue
      descendantIds.add(nextId)
      const nextNode = project.binder.nodes.find((node) => node.id === nextId)
      if (nextNode?.children) {
        queue.push(...nextNode.children)
      }
    }
    return documentSummaries.filter((item) => descendantIds.has(item.nodeId))
  }, [documentSummaries, project.binder.nodes, selectedNode])

  const handleOpenPreviousVersionDiff = useCallback(async () => {
    if (!selectedNode?.documentId) {
      return
    }
    const diff = await window.pecie.invokeSafe('history:diffDocument', {
      projectPath: project.projectPath,
      documentId: selectedNode.documentId,
      baseline: { kind: 'previous-version' }
    })
    setHistoryDialogState({
      mode: 'diff',
      title: t(locale, 'comparePreviousVersion'),
      subtitle: selectedNode.title,
      sourceTimelineEventId: undefined,
      diff
    })
  }, [locale, project.projectPath, selectedNode])

  const handleOpenTimelineDiff = useCallback(
    async (timelineEventId: string, kind: 'checkpoint' | 'milestone' | 'restore') => {
      if (!selectedNode?.documentId) {
        return
      }
      const diff = await window.pecie.invokeSafe('history:diffDocument', {
        projectPath: project.projectPath,
        documentId: selectedNode.documentId,
        baseline: { kind, timelineEventId }
      })
      setHistoryDialogState({
        mode: 'diff',
        title: t(locale, 'compareWithHistoricalVersion'),
        subtitle: selectedNode.title,
        sourceTimelineEventId: timelineEventId,
        diff
      })
    },
    [locale, project.projectPath, selectedNode]
  )

  const handleOpenRestorePreview = useCallback(
    async (timelineEventId: string) => {
      if (!selectedNode?.documentId) {
        return
      }
      const response = await window.pecie.invokeSafe('history:restoreDocument', {
        projectPath: project.projectPath,
        documentId: selectedNode.documentId,
        sourceTimelineEventId: timelineEventId,
        mode: 'preview',
        authorProfile
      })
      setHistoryDialogState({
        mode: 'restore',
        title: t(locale, 'restoreDocumentTitle'),
        subtitle: selectedNode.title,
        sourceTimelineEventId: timelineEventId,
        diff: response.preview
      })
    },
    [authorProfile, locale, project.projectPath, selectedNode]
  )

  const handleCreateMilestone = useCallback(
    async ({ label, noteMarkdown }: { label: string; noteMarkdown?: string }) => {
      await window.pecie.invokeSafe('history:createMilestone', {
        projectPath: project.projectPath,
        label,
        noteMarkdown,
        authorProfile
      })
      await refreshTimeline()
      await refreshDocumentSummaries()
      onNotify(t(locale, 'timelineMilestoneCreated'), 'success')
    },
    [authorProfile, locale, onNotify, project.projectPath, refreshDocumentSummaries, refreshTimeline]
  )

  const handleRepairTimeline = useCallback(async () => {
    await window.pecie.invokeSafe('history:repairTimeline', {
      projectPath: project.projectPath
    })
    await refreshTimeline()
    await refreshDocumentSummaries()
    onNotify(t(locale, 'timelineRepaired'), 'info')
  }, [locale, onNotify, project.projectPath, refreshDocumentSummaries, refreshTimeline])

  const importAttachments = useCallback(
    async (paths?: string[]) => {
      const pickedPaths =
        paths && paths.length > 0
          ? paths
          : (
              await window.pecie.invokeSafe('path:pickFiles', {
                defaultPath: attachmentsDirectoryPath || project.projectPath,
                allowMultiple: true
              })
            ).paths

      if (pickedPaths.length === 0) return
      setAttachmentsBusy(true)
      try {
        const response: ImportAttachmentsResponse = await window.pecie.invokeSafe('attachment:import', {
          projectPath: project.projectPath,
          sourcePaths: pickedPaths
        })
        setAttachments(response.items)
        setAttachmentsDirectoryPath(response.attachmentsDirectoryPath)
        setMaxAttachmentSizeBytes(response.maxFileSizeBytes)
        if (response.imported.length > 0) onNotify(t(locale, 'attachmentsImported', { count: String(response.imported.length) }))
        if (response.skipped.length > 0) onNotify(t(locale, 'attachmentsSkipped', { count: String(response.skipped.length) }), 'info')
      } finally {
        setAttachmentsBusy(false)
      }
    },
    [attachmentsDirectoryPath, locale, onNotify, project.projectPath]
  )

  return (
    <main className="workspace-shell">
      <GlobalSearchDialog
        locale={locale}
        onClose={() => setIsGlobalSearchOpen(false)}
        onOpenAttachment={(relativePath) => {
          const attachment = attachments.find((entry) => entry.relativePath === relativePath)
          if (attachment) {
            onPreviewAttachment(attachment)
          }
          setIsGlobalSearchOpen(false)
        }}
        onOpenDocument={(documentId) => {
          const matchingNode = project.binder.nodes.find((node) => node.documentId === documentId)
          if (matchingNode) setSelectedId(matchingNode.id)
          setIsGlobalSearchOpen(false)
        }}
        open={isGlobalSearchOpen}
        projectPath={project.projectPath}
      />
      <HistoryDiffDialog
        busy={historyDialogBusy}
        canRestore={historyDialogState?.mode === 'restore'}
        diff={historyDialogState?.diff ?? null}
        locale={locale}
        onClose={() => setHistoryDialogState(null)}
        onRestore={
          historyDialogState?.mode === 'restore' && historyDialogState.sourceTimelineEventId && selectedNode?.documentId
            ? async () => {
                const documentId = selectedNode.documentId
                const sourceTimelineEventId = historyDialogState.sourceTimelineEventId
                setHistoryDialogBusy(true)
                try {
                  const response = await window.pecie.invokeSafe('history:restoreDocument', {
                    projectPath: project.projectPath,
                    documentId: documentId!,
                    sourceTimelineEventId: sourceTimelineEventId!,
                    mode: 'apply',
                    authorProfile
                  })
                  if (response.restoredDocument) {
                    handleDocumentSaved(response.restoredDocument)
                  }
                  setEditorReloadToken((current) => current + 1)
                  await refreshTimeline()
                  setHistoryDialogState(null)
                  onNotify(t(locale, 'documentRestoredFromHistory'), 'success')
                } finally {
                  setHistoryDialogBusy(false)
                }
              }
            : undefined
        }
        onRestoreSelection={
          historyDialogState?.mode === 'diff' && selectedNode?.documentId && historyDialogState.sourceTimelineEventId
            ? async (selection) => {
                if (!editorSelectionRange) {
                  return
                }
                setHistoryDialogBusy(true)
                try {
                  const response = await window.pecie.invokeSafe('history:restoreSelection', {
                    projectPath: project.projectPath,
                    documentId: selectedNode.documentId!,
                    sourceTimelineEventId: historyDialogState.sourceTimelineEventId!,
                    sourceSelection: selection,
                    insertAt:
                      editorSelectionRange.endOffset > editorSelectionRange.startOffset
                        ? {
                            kind: 'replace-selection',
                            startOffset: editorSelectionRange.startOffset,
                            endOffset: editorSelectionRange.endOffset
                          }
                        : {
                            kind: 'cursor',
                            offset: editorSelectionRange.startOffset
                          },
                    authorProfile
                  })
                  handleDocumentSaved(response.restoredDocument)
                  setEditorReloadToken((current) => current + 1)
                  await refreshTimeline()
                  await refreshDocumentSummaries()
                  setHistoryDialogState(null)
                  onNotify(t(locale, 'selectionRestoredFromHistory'), 'success')
                } finally {
                  setHistoryDialogBusy(false)
                }
              }
            : undefined
        }
        open={Boolean(historyDialogState)}
        subtitle={historyDialogState?.subtitle}
        title={historyDialogState?.title ?? ''}
      />
      <WorkspaceHeader
        binderCollapsed={binderCollapsed}
        contextCollapsed={contextCollapsed}
        hasUnsavedChanges={dirtyDocumentId !== null}
        locale={locale}
        onBackToProjects={onBackToProjects}
        onManageProjects={onManageProjects}
        onNewProject={onNewProject}
        onOpenExport={onOpenExport}
        onOpenGuide={onOpenGuide}
        onOpenProject={onOpenProject}
        onOpenSettings={onOpenSettings}
        onChangeWorkspaceView={setWorkspaceView}
        onSelectNode={setSelectedId}
        onToggleBinder={() => setBinderCollapsed((current) => !current)}
        onToggleContext={() => setContextCollapsed((current) => !current)}
        project={project}
        selectedNode={selectedNode}
        workspaceView={workspaceView}
      />
      <div
        className={`workspace-grid${preferences.focusMode ? ' workspace-grid--focus' : ''}${binderCollapsed ? ' workspace-grid--binder-collapsed' : ''}${contextCollapsed ? ' workspace-grid--context-collapsed' : ''}`}
        style={!preferences.focusMode ? { '--binder-width': `${binderWidth}px`, '--context-width': `${contextWidth}px` } as React.CSSProperties : undefined}
      >
        <BinderPanel
          attachments={attachments}
          attachmentsBusy={attachmentsBusy}
          attachmentsLoading={attachmentsLoading}
          dirtyDocumentId={dirtyDocumentId}
          collapsed={binderCollapsed}
          locale={locale}
          onAbsorbSupportNode={async ({ sourceNodeId, targetDocumentId, insertion, offset }) => {
            const response = await window.pecie.invokeSafe('binder:absorb-node', {
              projectPath: project.projectPath,
              sourceNodeId,
              targetDocumentId,
              insertion,
              offset
            })
            onProjectChange({
              ...project,
              binder: response.binder
            })
            const targetNode = response.binder.nodes.find((node) => node.documentId === targetDocumentId)
            if (targetNode) {
              setSelectedId(targetNode.id)
              setIngestedDocumentId(targetDocumentId)
              window.setTimeout(() => setIngestedDocumentId((current) => (current === targetDocumentId ? null : current)), 1800)
            }
            onNotify(t(locale, 'noteMergedIntoDocument'), 'success')
            return response
          }}
          onBinderChange={(binder) => onProjectChange({ ...project, binder })}
          onImportAttachments={importAttachments}
          onOpenAttachment={onPreviewAttachment}
          onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
          onToggleCollapsed={() => setBinderCollapsed((current) => !current)}
          project={project}
          projectTitle={project.manifest.title}
          selectedId={selectedId}
          selectedNode={selectedNode}
          setSelectedId={setSelectedId}
          toggleFolder={toggleFolder}
          visibleNodes={visibleNodes}
        />
        {!binderCollapsed && !preferences.focusMode ? (
          <ResizeHandle
            side="left"
            onResize={(delta) => setBinderWidth((w) => Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, w + delta)))}
            onResizeEnd={() => undefined}
          />
        ) : null}
        {workspaceView === 'editor' ? (
          <EditorSurface
            authorProfile={authorProfile}
            ingestedDocumentId={ingestedDocumentId}
            locale={locale}
            onImportAttachments={importAttachments}
            onAbsorbSupportNode={
              selectedNode?.documentId
                ? async ({ sourceNodeId, targetDocumentId, insertion, offset }) => {
                    const response = await window.pecie.invokeSafe('binder:absorb-node', {
                      projectPath: project.projectPath,
                      sourceNodeId,
                      targetDocumentId,
                      insertion,
                      offset
                    })
                    onProjectChange({
                      ...project,
                      binder: response.binder
                    })
                    setIngestedDocumentId(targetDocumentId)
                    window.setTimeout(
                      () => setIngestedDocumentId((current) => (current === targetDocumentId ? null : current)),
                      1800
                    )
                    onNotify(t(locale, 'noteMergedIntoDocument'), 'success')
                    return response.targetDocument
                  }
                : undefined
            }
            onBodySnapshot={setEditorSnapshot}
            onDocumentSaved={handleDocumentSaved}
            onManualSaved={() => {
              onManualDocumentSaved()
              void refreshTimeline()
              void refreshDocumentSummaries()
            }}
            onPreferencesChange={setPreferences}
            reloadToken={editorReloadToken}
            onSaveStateChange={(saveState, documentId) => setDirtyDocumentId(saveState === 'dirty' ? documentId : null)}
            onSelectionRangeChange={setEditorSelectionRange}
            onWordCountChange={(wordCount) => setCurrentWordCount(wordCount)}
            preferences={preferences}
            project={project}
            selectedNode={selectedNode}
          />
        ) : workspaceView === 'timeline' ? (
          <TimelineView
            locale={locale}
            onCreateMilestone={handleCreateMilestone}
            onOpenPreviousVersionDiff={handleOpenPreviousVersionDiff}
            onOpenRestorePreview={handleOpenRestorePreview}
            onOpenTimelineDiff={handleOpenTimelineDiff}
            onRepairTimeline={handleRepairTimeline}
            selectedNode={selectedNode}
            timeline={timeline}
            timelineLoading={timelineLoading}
          />
        ) : workspaceView === 'outliner' ? (
          <OutlinerView
            documents={documentSummaries}
            locale={locale}
            onSelectNode={(nodeId) => {
              setSelectedId(nodeId)
            }}
            selectedNodeId={selectedNode?.id ?? null}
          />
        ) : workspaceView === 'corkboard' ? (
          <CorkboardView
            documents={documentSummaries}
            locale={locale}
            onSelectNode={(nodeId) => {
              setSelectedId(nodeId)
            }}
            selectedNodeId={selectedNode?.id ?? null}
          />
        ) : (
          <ScriveningsView
            documents={scriveningsDocuments}
            locale={locale}
            onSelectNode={(nodeId) => {
              setSelectedId(nodeId)
            }}
            selectedNodeId={selectedNode?.id ?? null}
            title={selectedNode?.title ?? project.manifest.title}
          />
        )}
        {!preferences.focusMode && !contextCollapsed ? (
          <ResizeHandle
            side="right"
            onResize={(delta) => setContextWidth((w) => Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, w - delta)))}
            onResizeEnd={() => undefined}
          />
        ) : null}
        {!preferences.focusMode ? (
          <ContextPanel
            attachments={attachments}
            attachmentsBusy={attachmentsBusy}
            attachmentsDirectoryPath={attachmentsDirectoryPath}
            attachmentsLoading={attachmentsLoading}
            collapsed={contextCollapsed}
            draftBody={editorSnapshot}
            locale={locale}
            manifest={project.manifest}
            maxAttachmentSizeBytes={maxAttachmentSizeBytes}
            onImportAttachments={() => importAttachments()}
            onOpenTimelineWorkspace={() => setWorkspaceView('timeline')}
            onOpenAttachment={(absolutePath) => {
              const attachment = attachments.find((entry) => entry.absolutePath === absolutePath) ?? null
              if (attachment) {
                onPreviewAttachment(attachment)
              }
            }}
            onOpenAttachmentsDirectory={() => {
              if (!attachmentsDirectoryPath) return
              void window.pecie.invokeSafe('path:openInFileManager', { path: attachmentsDirectoryPath })
            }}
            onOpenPreviousVersionDiff={handleOpenPreviousVersionDiff}
            onOpenWritingHubNode={(nodeId) => setSelectedId(nodeId)}
            onToggleCollapsed={() => setContextCollapsed((current) => !current)}
            project={project}
            selectedNode={selectedNode}
            timeline={timeline}
            timelineLoading={timelineLoading}
            writingHubNodes={writingHubNodes}
          />
        ) : null}
      </div>
    </main>
  )
}
