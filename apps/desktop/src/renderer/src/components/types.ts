import type React from 'react'

import type {
  AddBinderNodeResponse,
  AppBootstrapResponse,
  AppSettings,
  AttachmentRecord,
  AttachmentPreviewResponse,
  AbsorbBinderNodeResponse,
  AuthorProfile,
  BinderNode,
  CreateProjectResponse,
  DocumentRecord,
  DiffDocumentResponse,
  ListTimelineResponse,
  OpenProjectResponse,
  RestoreDocumentResponse,
  RestoreSelectionResponse,
  SupportedLocale
} from '@pecie/schemas'

export type TemplateId = 'blank' | 'thesis' | 'paper' | 'book' | 'manual' | 'journal' | 'article' | 'videoScript' | 'screenplay'
export type LoadedProject = CreateProjectResponse | OpenProjectResponse | null
export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
export type VisibleBinderNode = BinderNode & { depth: number; parentId: string | null; isExpanded?: boolean }
export type BinderTemplateId = 'blank' | 'chapter' | 'notes' | 'scene'
export type ToastTone = 'success' | 'info' | 'error'
export type EditorFormatAction =
  | 'heading'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'bullets'
  | 'numbered'
  | 'checklist'
  | 'quote'
  | 'link'
  | 'image'
  | 'citation'
  | 'footnote'
  | 'inlineCode'
  | 'codeBlock'
  | 'highlight'
  | 'superscript'
  | 'subscript'
  | 'table'
export type EditorViewMode = 'write' | 'preview' | 'split'
export type WorkspaceViewMode = 'editor' | 'timeline' | 'outliner' | 'corkboard' | 'scrivenings'
export type BinderDropPlacement = 'before' | 'after' | 'inside'
export type ExportFormatId = 'pdf' | 'docx' | 'odt' | 'rtf' | 'epub' | 'latex' | 'jats' | 'tei' | 'md' | 'txt'
export type GuideCenterSection = 'quick-start' | 'ui-tour' | 'markdown-guide' | 'how-to' | 'shortcuts'

export type ToastItem = {
  id: string
  tone: ToastTone
  message: string
}

export type ComposerDraft = {
  title: string
  projectName: string
  template: TemplateId
  language: SupportedLocale
  directory: string
}

export type WorkspacePreferences = {
  focusMode: boolean
  typewriterMode: boolean
}

export type WorkspaceFieldsProps = {
  locale: SupportedLocale
  settings: AppSettings
  setSettings: (settings: AppSettings) => void
}

export type AuthorFieldsProps = WorkspaceFieldsProps
  & {
    nameError?: string | null
  }

export type SetupWizardProps = {
  bootstrap: AppBootstrapResponse
  onPreviewChange?: (preview: Pick<AppSettings, 'theme' | 'fontPreference' | 'uiZoom'> | null) => void
  onComplete: (settings: AppSettings) => Promise<void>
}

export type SettingsDialogProps = {
  open: boolean
  settings: AppSettings
  appDataDirectory: string
  currentProjectPath?: string
  onPreviewChange?: (preview: Pick<AppSettings, 'theme' | 'fontPreference' | 'uiZoom'> | null) => void
  onClose: () => void
  onPrepareUninstall: () => Promise<void>
  onSave: (settings: AppSettings) => Promise<void>
}

export type OpenProjectDialogProps = {
  open: boolean
  locale: SupportedLocale
  workspaceDirectory: string
  recentProjectPaths: string[]
  onClose: () => void
  onOpenProject: (projectPath: string) => Promise<void>
}

export type ProjectLibraryDialogProps = {
  open: boolean
  locale: SupportedLocale
  settings: AppSettings
  currentProjectPath?: string
  onClose: () => void
  onOpenProject: (projectPath: string) => Promise<void>
  onArchiveProject: (projectPath: string) => Promise<void>
  onRestoreProject: (projectPath: string) => Promise<void>
  onDeleteProject: (projectPath: string) => Promise<void>
}

export type LauncherProps = {
  settings: AppSettings
  appVersion: string
  quickResume?: AppBootstrapResponse['quickResume']
  onOpenGuide: () => void
  onOpenInfo: () => void
  onOpenProjectLibrary: () => void
  onOpenProjectDialog: () => void
  onOpenSettings: () => void
  onOpenRecentProject: (projectPath: string) => Promise<void>
  onProjectCreated: (project: CreateProjectResponse) => Promise<void> | void
}

export type WorkspaceHeaderProps = {
  locale: SupportedLocale
  project: NonNullable<LoadedProject>
  selectedNode: VisibleBinderNode | null
  hasUnsavedChanges: boolean
  onBackToProjects: () => void
  onManageProjects: () => void
  onSelectNode: (nodeId: string) => void
  onToggleBinder: () => void
  onToggleContext: () => void
  onNewProject: () => void
  onOpenProject: () => void
  onOpenExport: () => void
  onOpenGuide: () => void
  onOpenSettings: () => void
  binderCollapsed: boolean
  contextCollapsed: boolean
  workspaceView: WorkspaceViewMode
  onChangeWorkspaceView: (view: WorkspaceViewMode) => void
}

export type BinderNodeDialogProps = {
  open: boolean
  locale: SupportedLocale
  projectPath: string
  parentTitle: string
  documentOptions: Array<{ documentId: string; label: string }>
  placementOptions: Array<{ value: 'inside-end' | 'inside-start' | 'before' | 'after'; label: string }>
  onClose: () => void
  onCreate: (payload: {
    nodeType: 'folder' | 'document'
    title: string
    description: string
    template: BinderTemplateId
    placement: 'inside-end' | 'inside-start' | 'before' | 'after'
    duplicateFromDocumentId?: string
  }) => Promise<void>
}

export type BinderPanelProps = {
  locale: SupportedLocale
  project: NonNullable<LoadedProject>
  projectTitle: string
  attachments: AttachmentRecord[]
  attachmentsBusy: boolean
  attachmentsLoading: boolean
  selectedNode: VisibleBinderNode | null
  selectedId: string
  setSelectedId: (nodeId: string) => void
  toggleFolder: (nodeId: string) => boolean
  visibleNodes: VisibleBinderNode[]
  collapsed: boolean
  onToggleCollapsed: () => void
  onBinderChange: (binder: NonNullable<LoadedProject>['binder']) => void
  onOpenAttachment: (attachment: AttachmentRecord) => void
  onImportAttachments: (paths?: string[]) => Promise<void>
  onOpenGlobalSearch: () => void
  onAbsorbSupportNode: (payload: {
    sourceNodeId: string
    targetDocumentId: string
    insertion: 'prepend' | 'append' | 'offset'
    offset?: number
  }) => Promise<AbsorbBinderNodeResponse>
  dirtyDocumentId?: string | null
}

export type EditorSurfaceProps = {
  locale: SupportedLocale
  project: NonNullable<LoadedProject>
  selectedNode: VisibleBinderNode | null
  reloadToken?: number
  authorProfile: AuthorProfile
  ingestedDocumentId?: string | null
  onImportAttachments?: (paths?: string[]) => Promise<void>
  onAbsorbSupportNode?: (payload: {
    sourceNodeId: string
    targetDocumentId: string
    insertion: 'prepend' | 'append' | 'offset'
    offset?: number
  }) => Promise<DocumentRecord | void>
  preferences: WorkspacePreferences
  onPreferencesChange: (preferences: WorkspacePreferences) => void
  onDocumentSaved: (document: DocumentRecord) => void
  onManualSaved: () => void
  onBodySnapshot: (body: string) => void
  onSaveStateChange?: (saveState: SaveState, documentId: string | null) => void
  onWordCountChange?: (wordCount: number, documentId: string | null) => void
  onSelectionRangeChange?: (range: { startOffset: number; endOffset: number } | null) => void
}

export type WorkspaceDocumentSummary = {
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
}

export type ContextPanelProps = {
  locale: SupportedLocale
  project: NonNullable<LoadedProject>
  manifest: OpenProjectResponse['manifest']
  selectedNode: BinderNode | null
  draftBody: string
  writingHubNodes: BinderNode[]
  attachments: AttachmentRecord[]
  attachmentsDirectoryPath: string
  maxAttachmentSizeBytes: number
  attachmentsLoading: boolean
  attachmentsBusy: boolean
  timeline: ListTimelineResponse | null
  timelineLoading: boolean
  onOpenTimelineWorkspace: () => void
  onOpenPreviousVersionDiff: () => Promise<void>
  onOpenWritingHubNode: (nodeId: string) => void
  onImportAttachments: () => void
  onOpenAttachmentsDirectory: () => void
  onOpenAttachment: (absolutePath: string) => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

export type HistoryDiffDialogProps = {
  open: boolean
  locale: SupportedLocale
  title: string
  subtitle?: string
  diff: DiffDocumentResponse | RestoreDocumentResponse['preview'] | null
  busy?: boolean
  canRestore?: boolean
  onClose: () => void
  onRestore?: () => Promise<void>
  onRestoreSelection?: (selection: { startOffset: number; endOffset: number }) => Promise<void>
}

export type WorkspaceProps = {
  locale: SupportedLocale
  project: NonNullable<LoadedProject>
  authorProfile: AuthorProfile
  onSelectionChange: (node: BinderNode | null) => void
  onProjectChange: (project: NonNullable<LoadedProject>) => void
  onManualDocumentSaved: () => void
  onNotify: (message: string, tone?: ToastTone) => void
  onPreviewAttachment: (attachment: AttachmentRecord | null) => void
  onOpenGuide: () => void
  onBackToProjects: () => void
  onManageProjects: () => void
  onNewProject: () => void
  onOpenProject: () => void
  onOpenExport: () => void
  onOpenSettings: () => void
}

export type OutlinerViewProps = {
  locale: SupportedLocale
  documents: WorkspaceDocumentSummary[]
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
}

export type CorkboardViewProps = {
  locale: SupportedLocale
  documents: WorkspaceDocumentSummary[]
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
}

export type ScriveningsViewProps = {
  locale: SupportedLocale
  title: string
  documents: WorkspaceDocumentSummary[]
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
}

export type TimelineViewProps = {
  locale: SupportedLocale
  selectedNode: BinderNode | null
  timeline: ListTimelineResponse | null
  timelineLoading: boolean
  onOpenPreviousVersionDiff: () => Promise<void>
  onOpenTimelineDiff: (timelineEventId: string, kind: 'checkpoint' | 'milestone' | 'restore') => Promise<void>
  onOpenRestorePreview: (timelineEventId: string) => Promise<void>
  onCreateMilestone: (payload: { label: string; noteMarkdown?: string }) => Promise<void>
  onRepairTimeline: () => Promise<void>
}

export type GlobalSearchDialogProps = {
  open: boolean
  locale: SupportedLocale
  projectPath: string
  onClose: () => void
  onOpenDocument: (documentId: string) => void
  onOpenAttachment: (relativePath: string) => void
}

export type ExportDialogProps = {
  open: boolean
  locale: SupportedLocale
  project: NonNullable<LoadedProject> | null
  selectedNode: BinderNode | null
  workspaceDirectory: string
  onClose: () => void
}

export type OnboardingOverlayProps = {
  open: boolean
  locale: SupportedLocale
  onClose: () => void
}

export type AttachmentPreviewDialogProps = {
  open: boolean
  locale: SupportedLocale
  attachment: AttachmentRecord | null
  preview: AttachmentPreviewResponse['preview'] | null
  onClose: () => void
}

export type ImageInsertDialogProps = {
  open: boolean
  locale: SupportedLocale
  projectPath: string
  documentRelativePath: string
  onClose: () => void
  onInsert: (markdownSnippet: string) => void
}

export type GuideCenterDialogProps = {
  open: boolean
  locale: SupportedLocale
  initialSection: GuideCenterSection
  onClose: () => void
}

export type InfoDialogProps = {
  open: boolean
  locale: SupportedLocale
  version: string
  onClose: () => void
}

export type ToastViewportProps = {
  toasts: ToastItem[]
  dismissLabel: string
  onDismiss: (toastId: string) => void
}

export type MonacoEditorComponent = (props: Record<string, unknown>) => React.JSX.Element

export const templateIds: TemplateId[] = ['blank', 'thesis', 'paper', 'book', 'manual', 'journal', 'article', 'videoScript', 'screenplay']
export const authorRoles: AuthorProfile['role'][] = ['student', 'researcher', 'writer', 'editor', 'author']
export const exportFormats: Array<{ id: ExportFormatId; label: string; extension: string }> = [
  { id: 'pdf', label: 'PDF', extension: 'pdf' },
  { id: 'docx', label: 'DOCX', extension: 'docx' },
  { id: 'odt', label: 'ODT', extension: 'odt' },
  { id: 'rtf', label: 'RTF', extension: 'rtf' },
  { id: 'epub', label: 'EPUB', extension: 'epub' },
  { id: 'latex', label: 'LaTeX', extension: 'tex' },
  { id: 'jats', label: 'JATS XML', extension: 'xml' },
  { id: 'tei', label: 'TEI XML', extension: 'xml' },
  { id: 'md', label: 'MD', extension: 'md' },
  { id: 'txt', label: 'TXT', extension: 'txt' }
]

export type AddBinderNodeResult = AddBinderNodeResponse
