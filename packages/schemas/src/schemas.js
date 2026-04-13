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
