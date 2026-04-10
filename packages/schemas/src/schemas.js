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
