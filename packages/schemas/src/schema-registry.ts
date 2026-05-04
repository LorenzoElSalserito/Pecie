export const schemaRegistry = {
  manifest: 'schemas/manifest.schema.json',
  project: 'schemas/project.schema.json',
  binder: 'schemas/binder.schema.json',
  timeline: 'schemas/timeline.schema.json',
  milestones: 'schemas/milestones.schema.json',
  historyRepair: 'schemas/history-repair.schema.json',
  exportProfile: 'schemas/export-profile.schema.json',
  exportRuntimeManifest: 'schemas/export-runtime-manifest.schema.json',
  runtimeCapabilityReport: 'schemas/runtime-capability-report.schema.json',
  exportProfileSupportDecision: 'schemas/export-profile-support-decision.schema.json',
  previewProfileBinding: 'schemas/preview-profile-binding.schema.json',
  paginatedPreview: 'schemas/paginated-preview.schema.json',
  pageBreakMap: 'schemas/page-break-map.schema.json',
  appPreviewSettings: 'schemas/app-preview-settings.schema.json',
  citationProfile: 'schemas/citation-profile.schema.json',
  citationLibrary: 'schemas/citation-library.schema.json',
  researchNote: 'schemas/research-note.schema.json',
  researchLinkMap: 'schemas/research-link-map.schema.json',
  pdfLibrary: 'schemas/pdf-library.schema.json',
  sharePackageManifest: 'schemas/share-package-manifest.schema.json',
  privacyInventory: 'schemas/privacy-inventory.schema.json',
  tutorialScript: 'schemas/tutorial-script.schema.json',
  pluginManifest: 'schemas/plugin-manifest.schema.json'
} as const

export type SchemaName = keyof typeof schemaRegistry
