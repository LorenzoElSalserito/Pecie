import type {
  BinderDocument,
  CitationLibrary,
  CitationProfile,
  ExportProfile,
  ExportProfileSupportDecision,
  ExportRuntimeManifest,
  HistoryRepairResult,
  PageBreakMap,
  PdfLibrarySnapshot,
  PaginatedPreview,
  PrivacyInventoryResponse,
  PluginManifest,
  MilestonesSnapshot,
  ProjectManifest,
  ProjectMetadata,
  PreviewProfileBinding,
  ResearchLinkMap,
  ResearchNoteRecord,
  RuntimeCapabilityReport,
  SharePackageManifest,
  TutorialScript,
  TimelineSnapshot
} from './generated/types.generated'

export const manifestSchema = {
  $id: 'manifest.schema.json',
  type: 'object',
  required: [
    'format',
    'formatVersion',
    'projectId',
    'title',
    'createdAt',
    'appMinVersion',
    'historyMode',
    'contentModel',
    'cacheModel',
    'defaultExportProfile',
    'language',
    'privacyMode',
    'embeddedHistory',
    'a11yProfile',
    'schemaUris'
  ]
} as const satisfies Record<string, unknown>

export const projectSchema = {
  $id: 'project.schema.json',
  type: 'object',
  required: [
    'title',
    'author',
    'documentKind',
    'defaultLanguage',
    'defaultBibliographyStyle',
    'projectVisibility',
    'containsSensitiveData'
  ]
} as const satisfies Record<string, unknown>

export const binderSchema = {
  $id: 'binder.schema.json',
  type: 'object',
  required: ['rootId', 'nodes']
} as const satisfies Record<string, unknown>

export const timelineSchema = {
  $id: 'timeline.schema.json',
  type: 'object',
  required: ['version', 'generatedAt', 'events', 'groups', 'integrityReport']
} as const satisfies Record<string, unknown>

export const milestonesSchema = {
  $id: 'milestones.schema.json',
  type: 'object',
  required: ['version', 'generatedAt', 'milestones']
} as const satisfies Record<string, unknown>

export const historyRepairSchema = {
  $id: 'history-repair.schema.json',
  type: 'object',
  required: ['totalCommits', 'eventsOk', 'eventsRepaired', 'eventsMissingCommit', 'eventsMissingMetadata', 'warnings']
} as const satisfies Record<string, unknown>

export const exportProfileSchema = {
  $id: 'export-profile.schema.json',
  type: 'object',
  required: ['id', 'schemaVersion', 'label', 'format', 'include', 'output']
} as const satisfies Record<string, unknown>

export const exportRuntimeManifestSchema = {
  $id: 'export-runtime-manifest.schema.json',
  type: 'object',
  required: ['schemaVersion', 'runtimeVersion', 'platform', 'arch', 'bundledCapabilities']
} as const satisfies Record<string, unknown>

export const runtimeCapabilityReportSchema = {
  $id: 'runtime-capability-report.schema.json',
  type: 'object',
  required: ['capabilityId', 'distribution', 'status', 'source', 'messageKey']
} as const satisfies Record<string, unknown>

export const exportProfileSupportDecisionSchema = {
  $id: 'export-profile-support-decision.schema.json',
  type: 'object',
  required: ['profileId', 'supported', 'availability', 'requiredCapabilities', 'missingCapabilities', 'messageKey']
} as const satisfies Record<string, unknown>

export const previewProfileBindingSchema = {
  $id: 'preview-profile-binding.schema.json',
  type: 'object',
  required: ['projectId', 'profileId', 'format', 'supportsPageMarkers', 'previewKind']
} as const satisfies Record<string, unknown>

export const paginatedPreviewSchema = {
  $id: 'paginated-preview.schema.json',
  type: 'object',
  required: ['profileId', 'format', 'mode', 'paginated', 'totalPages', 'pages', 'generatedAt', 'cacheKey', 'warnings']
} as const satisfies Record<string, unknown>

export const pageBreakMapSchema = {
  $id: 'page-break-map.schema.json',
  type: 'object',
  required: ['profileId', 'format', 'mode', 'pipeline', 'totalEstimatedPages', 'breaks', 'computedAt', 'cacheKey']
} as const satisfies Record<string, unknown>

export const citationProfileSchema = {
  $id: 'citation-profile.schema.json',
  type: 'object',
  required: ['id', 'schemaVersion', 'label', 'bibliographySources', 'citationStyle', 'locale', 'linkCitations', 'suppressBibliography']
} as const satisfies Record<string, unknown>

export const citationLibrarySchema = {
  $id: 'citation-library.schema.json',
  type: 'object',
  required: ['version', 'generatedAt', 'profile', 'entries', 'sources', 'diagnostics']
} as const satisfies Record<string, unknown>

export const researchNoteSchema = {
  $id: 'research-note.schema.json',
  type: 'object',
  required: ['id', 'title', 'kind', 'path', 'includeInExport', 'createdAt', 'updatedAt']
} as const satisfies Record<string, unknown>

export const researchLinkMapSchema = {
  $id: 'research-link-map.schema.json',
  type: 'object',
  required: ['version', 'generatedAt', 'links']
} as const satisfies Record<string, unknown>

export const pdfLibrarySchema = {
  $id: 'pdf-library.schema.json',
  type: 'object',
  required: ['version', 'generatedAt', 'items']
} as const satisfies Record<string, unknown>

export const sharePackageManifestSchema = {
  $id: 'share-package-manifest.schema.json',
  type: 'object',
  required: [
    'sharePackageVersion',
    'projectId',
    'projectTitle',
    'createdAt',
    'include',
    'selectedMilestoneIds',
    'privacyWarnings',
    'excludedPaths'
  ]
} as const satisfies Record<string, unknown>

export const privacyInventorySchema = {
  $id: 'privacy-inventory.schema.json',
  type: 'object',
  required: ['generatedAt', 'items', 'totals']
} as const satisfies Record<string, unknown>

export const tutorialScriptSchema = {
  $id: 'tutorial-script.schema.json',
  type: 'object',
  required: ['id', 'schemaVersion', 'icon', 'titleKey', 'steps']
} as const satisfies Record<string, unknown>

export const pluginManifestSchema = {
  $id: 'plugin-manifest.schema.json',
  type: 'object',
  required: ['id', 'schemaVersion', 'label', 'version', 'entryPoint', 'permissions', 'hooks']
} as const satisfies Record<string, unknown>

export type SchemaDocument = {
  manifest: ProjectManifest
  project: ProjectMetadata
  binder: BinderDocument
  timeline: TimelineSnapshot
  milestones: MilestonesSnapshot
  historyRepair: HistoryRepairResult
  exportProfile: ExportProfile
  exportRuntimeManifest: ExportRuntimeManifest
  runtimeCapabilityReport: RuntimeCapabilityReport
  exportProfileSupportDecision: ExportProfileSupportDecision
  previewProfileBinding: PreviewProfileBinding
  paginatedPreview: PaginatedPreview
  pageBreakMap: PageBreakMap
  citationProfile: CitationProfile
  citationLibrary: CitationLibrary
  researchNote: ResearchNoteRecord
  researchLinkMap: ResearchLinkMap
  pdfLibrary: PdfLibrarySnapshot
  sharePackageManifest: SharePackageManifest
  privacyInventory: PrivacyInventoryResponse
  tutorialScript: TutorialScript
  pluginManifest: PluginManifest
}
