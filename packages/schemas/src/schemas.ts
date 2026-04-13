import type {
  BinderDocument,
  HistoryRepairResult,
  MilestonesSnapshot,
  ProjectManifest,
  ProjectMetadata,
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

export type SchemaDocument = {
  manifest: ProjectManifest
  project: ProjectMetadata
  binder: BinderDocument
  timeline: TimelineSnapshot
  milestones: MilestonesSnapshot
  historyRepair: HistoryRepairResult
}
