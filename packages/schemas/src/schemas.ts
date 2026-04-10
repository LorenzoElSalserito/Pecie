import type { BinderDocument, ProjectManifest, ProjectMetadata } from './generated/types.generated'

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

export type SchemaDocument = {
  manifest: ProjectManifest
  project: ProjectMetadata
  binder: BinderDocument
}
