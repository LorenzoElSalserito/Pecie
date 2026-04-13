import type {
  BinderDocument,
  BinderNode,
  HistoryRepairResult,
  MilestoneRecord,
  MilestonesSnapshot,
  ProjectManifest,
  ProjectMetadata,
  TimelineAuthorRecord,
  TimelineEventRecord,
  TimelineGroup,
  TimelineSnapshot
} from '../generated/types.generated'
import { assertArray, assertBoolean, assertRecord, assertString, SchemaValidationError } from './assertions'

export function validateManifest(value: unknown): ProjectManifest {
  const schemaName = 'manifest'
  assertRecord(value, schemaName)

  assertString(value.format, 'format', schemaName)
  if (value.format !== 'pecie-project') {
    throw new SchemaValidationError(schemaName, 'Field "format" must be "pecie-project"')
  }

  assertString(value.formatVersion, 'formatVersion', schemaName)
  assertString(value.projectId, 'projectId', schemaName)
  assertString(value.title, 'title', schemaName)
  assertString(value.createdAt, 'createdAt', schemaName)
  assertString(value.appMinVersion, 'appMinVersion', schemaName)
  assertString(value.historyMode, 'historyMode', schemaName)
  assertString(value.contentModel, 'contentModel', schemaName)
  assertString(value.cacheModel, 'cacheModel', schemaName)
  assertString(value.defaultExportProfile, 'defaultExportProfile', schemaName)
  assertString(value.language, 'language', schemaName)
  assertString(value.privacyMode, 'privacyMode', schemaName)
  assertBoolean(value.embeddedHistory, 'embeddedHistory', schemaName)
  assertString(value.a11yProfile, 'a11yProfile', schemaName)
  assertRecord(value.schemaUris, 'schemaUris')
  assertString(value.schemaUris.manifest, 'schemaUris.manifest', schemaName)
  assertString(value.schemaUris.project, 'schemaUris.project', schemaName)
  assertString(value.schemaUris.binder, 'schemaUris.binder', schemaName)
  assertString(value.schemaUris.timeline, 'schemaUris.timeline', schemaName)
  assertString(value.schemaUris.milestones, 'schemaUris.milestones', schemaName)
  assertString(value.schemaUris.historyRepair, 'schemaUris.historyRepair', schemaName)

  return value as unknown as ProjectManifest
}

export function validateProjectMetadata(value: unknown): ProjectMetadata {
  const schemaName = 'project'
  assertRecord(value, schemaName)

  assertString(value.title, 'title', schemaName)
  assertRecord(value.author, schemaName)
  assertString(value.author.name, 'author.name', schemaName)
  assertString(value.author.role, 'author.role', schemaName)
  if (value.authors !== undefined) {
    assertArray(value.authors, 'authors', schemaName)
    value.authors.forEach((author, index) => {
      assertRecord(author, schemaName)
      assertString(author.id, `authors[${index}].id`, schemaName)
      assertString(author.name, `authors[${index}].name`, schemaName)
      assertString(author.role, `authors[${index}].role`, schemaName)
      assertString(author.preferredLanguage, `authors[${index}].preferredLanguage`, schemaName)
      assertString(author.addedAt, `authors[${index}].addedAt`, schemaName)
      assertString(author.lastModifiedAt, `authors[${index}].lastModifiedAt`, schemaName)
      if (author.institutionName !== undefined) {
        assertString(author.institutionName, `authors[${index}].institutionName`, schemaName)
      }
      if (author.department !== undefined) {
        assertString(author.department, `authors[${index}].department`, schemaName)
      }
    })
  }
  if (value.primaryAuthorId !== undefined) {
    assertString(value.primaryAuthorId, 'primaryAuthorId', schemaName)
  }
  if (value.authorshipStats !== undefined) {
    assertArray(value.authorshipStats, 'authorshipStats', schemaName)
    value.authorshipStats.forEach((stat, index) => {
      assertRecord(stat, schemaName)
      assertString(stat.authorId, `authorshipStats[${index}].authorId`, schemaName)
      if (typeof stat.wordCount !== 'number') {
        throw new SchemaValidationError(schemaName, `Field "authorshipStats[${index}].wordCount" must be a number`)
      }
      if (typeof stat.percentage !== 'number') {
        throw new SchemaValidationError(schemaName, `Field "authorshipStats[${index}].percentage" must be a number`)
      }
    })
  }
  assertString(value.documentKind, 'documentKind', schemaName)
  assertString(value.defaultLanguage, 'defaultLanguage', schemaName)
  assertString(value.defaultBibliographyStyle, 'defaultBibliographyStyle', schemaName)
  assertString(value.projectVisibility, 'projectVisibility', schemaName)
  assertBoolean(value.containsSensitiveData, 'containsSensitiveData', schemaName)

  if (value.institution !== undefined) {
    assertRecord(value.institution, schemaName)
    assertString(value.institution.name, 'institution.name', schemaName)
    if (value.institution.department !== undefined) {
      assertString(value.institution.department, 'institution.department', schemaName)
    }
  }

  return value as unknown as ProjectMetadata
}

function validateBinderNode(value: unknown): BinderNode {
  const schemaName = 'binder'
  assertRecord(value, schemaName)
  assertString(value.id, 'nodes[].id', schemaName)
  assertString(value.type, 'nodes[].type', schemaName)
  assertString(value.title, 'nodes[].title', schemaName)

  if (value.children !== undefined) {
    assertArray(value.children, 'nodes[].children', schemaName)
    value.children.forEach((childId) => assertString(childId, 'nodes[].children[]', schemaName))
  }

  if (value.path !== undefined) {
    assertString(value.path, 'nodes[].path', schemaName)
  }

  if (value.documentId !== undefined) {
    assertString(value.documentId, 'nodes[].documentId', schemaName)
  }

  return value as unknown as BinderNode
}

export function validateBinderDocument(value: unknown): BinderDocument {
  const schemaName = 'binder'
  assertRecord(value, schemaName)
  assertString(value.rootId, 'rootId', schemaName)
  assertArray(value.nodes, 'nodes', schemaName)

  const nodes = value.nodes.map((node) => validateBinderNode(node))

  const rootNode = nodes.find((node) => node.id === value.rootId)
  if (!rootNode) {
    throw new SchemaValidationError(schemaName, 'rootId must reference an existing node')
  }

  return { rootId: value.rootId, nodes }
}

function validateTimelineAuthorRecord(value: unknown, schemaName: string, path: string): TimelineAuthorRecord {
  assertRecord(value, schemaName)
  assertString(value.pecieAuthorId, `${path}.pecieAuthorId`, schemaName)
  assertString(value.pecieDisplayName, `${path}.pecieDisplayName`, schemaName)
  assertString(value.gitName, `${path}.gitName`, schemaName)
  assertString(value.gitEmail, `${path}.gitEmail`, schemaName)
  return value as unknown as TimelineAuthorRecord
}

function validateTimelineEventRecord(value: unknown, index: number): TimelineEventRecord {
  const schemaName = 'timeline'
  assertRecord(value, schemaName)
  assertString(value.timelineEventId, `events[${index}].timelineEventId`, schemaName)
  assertString(value.commitHash, `events[${index}].commitHash`, schemaName)
  assertString(value.kind, `events[${index}].kind`, schemaName)
  assertString(value.label, `events[${index}].label`, schemaName)
  assertString(value.createdAt, `events[${index}].createdAt`, schemaName)
  validateTimelineAuthorRecord(value.author, schemaName, `events[${index}].author`)
  assertArray(value.touchedPaths, `events[${index}].touchedPaths`, schemaName)
  value.touchedPaths.forEach((item, itemIndex) => assertString(item, `events[${index}].touchedPaths[${itemIndex}]`, schemaName))
  assertString(value.integrity, `events[${index}].integrity`, schemaName)
  if (value.noteMarkdown !== undefined) {
    assertString(value.noteMarkdown, `events[${index}].noteMarkdown`, schemaName)
  }
  return value as unknown as TimelineEventRecord
}

function validateTimelineGroup(value: unknown, index: number): TimelineGroup {
  const schemaName = 'timeline'
  assertRecord(value, schemaName)
  assertString(value.groupId, `groups[${index}].groupId`, schemaName)
  assertString(value.label, `groups[${index}].label`, schemaName)
  assertString(value.dayKey, `groups[${index}].dayKey`, schemaName)
  assertString(value.sessionLabel, `groups[${index}].sessionLabel`, schemaName)
  assertArray(value.eventIds, `groups[${index}].eventIds`, schemaName)
  value.eventIds.forEach((item, itemIndex) => assertString(item, `groups[${index}].eventIds[${itemIndex}]`, schemaName))
  return value as unknown as TimelineGroup
}

export function validateHistoryRepairResult(value: unknown): HistoryRepairResult {
  const schemaName = 'historyRepair'
  assertRecord(value, schemaName)
  for (const field of ['totalCommits', 'eventsOk', 'eventsRepaired', 'eventsMissingCommit', 'eventsMissingMetadata'] as const) {
    if (typeof value[field] !== 'number') {
      throw new SchemaValidationError(schemaName, `Field "${field}" must be a number`)
    }
  }
  assertArray(value.warnings, 'warnings', schemaName)
  value.warnings.forEach((warning, index) => assertString(warning, `warnings[${index}]`, schemaName))
  return value as unknown as HistoryRepairResult
}

export function validateTimelineSnapshot(value: unknown): TimelineSnapshot {
  const schemaName = 'timeline'
  assertRecord(value, schemaName)
  assertString(value.version, 'version', schemaName)
  assertString(value.generatedAt, 'generatedAt', schemaName)
  assertArray(value.events, 'events', schemaName)
  assertArray(value.groups, 'groups', schemaName)
  const events = value.events.map((event, index) => validateTimelineEventRecord(event, index))
  const groups = value.groups.map((group, index) => validateTimelineGroup(group, index))
  const integrityReport = validateHistoryRepairResult(value.integrityReport)
  return {
    version: value.version as TimelineSnapshot['version'],
    generatedAt: value.generatedAt,
    events,
    groups,
    integrityReport
  }
}

function validateMilestoneRecord(value: unknown, index: number): MilestoneRecord {
  const schemaName = 'milestones'
  assertRecord(value, schemaName)
  assertString(value.timelineEventId, `milestones[${index}].timelineEventId`, schemaName)
  assertString(value.commitHash, `milestones[${index}].commitHash`, schemaName)
  assertString(value.label, `milestones[${index}].label`, schemaName)
  assertString(value.createdAt, `milestones[${index}].createdAt`, schemaName)
  if (value.noteMarkdown !== undefined) {
    assertString(value.noteMarkdown, `milestones[${index}].noteMarkdown`, schemaName)
  }
  return value as unknown as MilestoneRecord
}

export function validateMilestonesSnapshot(value: unknown): MilestonesSnapshot {
  const schemaName = 'milestones'
  assertRecord(value, schemaName)
  assertString(value.version, 'version', schemaName)
  assertString(value.generatedAt, 'generatedAt', schemaName)
  assertArray(value.milestones, 'milestones', schemaName)
  return {
    version: value.version as MilestonesSnapshot['version'],
    generatedAt: value.generatedAt,
    milestones: value.milestones.map((milestone, index) => validateMilestoneRecord(milestone, index))
  }
}
