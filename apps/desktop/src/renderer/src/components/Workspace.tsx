import { useCallback, useEffect, useMemo, useState } from 'react'

import type { AttachmentRecord, DocumentRecord, ImportAttachmentsResponse } from '@pecie/schemas'

import { useBinderSelection } from '../hooks/useBinderSelection'
import { t } from '../i18n'
import { BinderPanel } from './BinderPanel'
import { ContextPanel } from './ContextPanel'
import { EditorSurface } from './EditorSurface'
import { GlobalSearchDialog } from './GlobalSearchDialog'
import { ResizeHandle } from './ResizeHandle'
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

  useEffect(() => {
    setEditorSnapshot('')
    setAttachments([])
    setAttachmentsDirectoryPath('')
    setPreferences({ focusMode: false, typewriterMode: false })
    setDirtyDocumentId(null)
    setCurrentWordCount(0)
    setIngestedDocumentId(null)
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

  const handleDocumentSaved = useCallback(
    (document: DocumentRecord) => {
      onProjectChange({
        ...project,
        binder: {
          ...project.binder,
          nodes: project.binder.nodes.map((node) => (node.documentId === document.documentId ? { ...node, title: document.title } : node))
        }
      })
    },
    [onProjectChange, project]
  )

  const writingHubNodes = useMemo(
    () => project.binder.nodes.filter((node) => node.type === 'document' && typeof node.path === 'string' && node.path.startsWith('research/notes/')),
    [project.binder.nodes]
  )

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
        onSelectNode={setSelectedId}
        onToggleBinder={() => setBinderCollapsed((current) => !current)}
        onToggleContext={() => setContextCollapsed((current) => !current)}
        project={project}
        selectedNode={selectedNode}
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
          onManualSaved={onManualDocumentSaved}
          onPreferencesChange={setPreferences}
          onSaveStateChange={(saveState, documentId) => setDirtyDocumentId(saveState === 'dirty' ? documentId : null)}
          onWordCountChange={(wordCount) => setCurrentWordCount(wordCount)}
          preferences={preferences}
          project={project}
          selectedNode={selectedNode}
        />
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
            onOpenWritingHubNode={(nodeId) => setSelectedId(nodeId)}
            onToggleCollapsed={() => setContextCollapsed((current) => !current)}
            project={project}
            selectedNode={selectedNode}
            writingHubNodes={writingHubNodes}
          />
        ) : null}
      </div>
    </main>
  )
}
