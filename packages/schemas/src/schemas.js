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
};
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
};
export const binderSchema = {
    $id: 'binder.schema.json',
    type: 'object',
    required: ['rootId', 'nodes']
};
export const timelineSchema = {
    $id: 'timeline.schema.json',
    type: 'object',
    required: ['version', 'generatedAt', 'events', 'groups', 'integrityReport']
};
export const milestonesSchema = {
    $id: 'milestones.schema.json',
    type: 'object',
    required: ['version', 'generatedAt', 'milestones']
};
export const historyRepairSchema = {
    $id: 'history-repair.schema.json',
    type: 'object',
    required: ['totalCommits', 'eventsOk', 'eventsRepaired', 'eventsMissingCommit', 'eventsMissingMetadata', 'warnings']
};
export const exportProfileSchema = {
    $id: 'export-profile.schema.json',
    type: 'object',
    required: ['id', 'schemaVersion', 'label', 'format', 'include', 'output']
};
export const previewProfileBindingSchema = {
    $id: 'preview-profile-binding.schema.json',
    type: 'object',
    required: ['projectId', 'profileId', 'format', 'supportsPageMarkers', 'previewKind']
};
export const paginatedPreviewSchema = {
    $id: 'paginated-preview.schema.json',
    type: 'object',
    required: ['profileId', 'format', 'mode', 'paginated', 'totalPages', 'pages', 'generatedAt', 'cacheKey', 'warnings']
};
export const pageBreakMapSchema = {
    $id: 'page-break-map.schema.json',
    type: 'object',
    required: ['profileId', 'format', 'mode', 'pipeline', 'totalEstimatedPages', 'breaks', 'computedAt', 'cacheKey']
};
export const citationProfileSchema = {
    $id: 'citation-profile.schema.json',
    type: 'object',
    required: ['id', 'schemaVersion', 'label', 'bibliographySources', 'citationStyle', 'locale', 'linkCitations', 'suppressBibliography']
};
export const citationLibrarySchema = {
    $id: 'citation-library.schema.json',
    type: 'object',
    required: ['version', 'generatedAt', 'profile', 'entries', 'sources', 'diagnostics']
};
export const researchNoteSchema = {
    $id: 'research-note.schema.json',
    type: 'object',
    required: ['id', 'title', 'kind', 'path', 'includeInExport', 'createdAt', 'updatedAt']
};
export const researchLinkMapSchema = {
    $id: 'research-link-map.schema.json',
    type: 'object',
    required: ['version', 'generatedAt', 'links']
};
export const pdfLibrarySchema = {
    $id: 'pdf-library.schema.json',
    type: 'object',
    required: ['version', 'generatedAt', 'items']
};
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
};
export const privacyInventorySchema = {
    $id: 'privacy-inventory.schema.json',
    type: 'object',
    required: ['generatedAt', 'items', 'totals']
};
export const tutorialScriptSchema = {
    $id: 'tutorial-script.schema.json',
    type: 'object',
    required: ['id', 'schemaVersion', 'icon', 'titleKey', 'steps']
};
export const pluginManifestSchema = {
    $id: 'plugin-manifest.schema.json',
    type: 'object',
    required: ['id', 'schemaVersion', 'label', 'version', 'entryPoint', 'permissions', 'hooks']
};
