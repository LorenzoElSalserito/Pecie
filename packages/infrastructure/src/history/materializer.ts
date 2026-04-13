import { createHash } from 'node:crypto'

import type {
  HistoryRepairResult,
  MilestoneRecord,
  TimelineEventRecord,
  TimelineGroup,
  TimelineIntegrity,
  TimelineSnapshot
} from '@pecie/schemas'

import { parseCommitMessage, type CommitMessageKind } from './commit-message-format'
import type { GitCommit } from './git-adapter'

type EditorialMeta = {
  timelineEventId: string
  commitHash: string
  kind: CommitMessageKind | 'unknown'
  label?: string
  noteMarkdown?: string
}

export type EditorialMetaIndex = {
  milestonesByCommitHash: Map<string, MilestoneRecord>
  timelineByCommitHash: Map<string, EditorialMeta>
}

export interface HistoryMaterializerInput {
  gitLog: ReadonlyArray<GitCommit>
  editorialMeta: Readonly<EditorialMetaIndex>
  generatedAt: string
}

export interface TimelineMaterializationResult {
  snapshot: TimelineSnapshot
  milestones: MilestoneRecord[]
}

function buildTimelineEventId(commitHash: string): string {
  const hex = createHash('sha256').update(commitHash).digest('hex')
  return `evt-${hex.slice(0, 12)}-${hex.slice(12, 20)}`
}

function normalizeIntegrity(kind: CommitMessageKind | 'unknown', hasMeta: boolean): TimelineIntegrity {
  if (kind === 'unknown') {
    return 'repaired'
  }
  if (!hasMeta && kind === 'milestone') {
    return 'missing-metadata'
  }
  return 'ok'
}

function buildGroupLabel(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00.000Z`).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  })
}

export function materializeTimeline(input: HistoryMaterializerInput): TimelineMaterializationResult {
  const warnings: string[] = []
  const events: TimelineEventRecord[] = []
  const milestones: MilestoneRecord[] = []

  for (const commit of [...input.gitLog].reverse()) {
    const parsed = parseCommitMessage(commit.subject)
    if (parsed.kind === 'unknown') {
      continue
    }

    const meta = input.editorialMeta.timelineByCommitHash.get(commit.hash)
    const milestoneMeta = input.editorialMeta.milestonesByCommitHash.get(commit.hash)
    const timelineEventId = meta?.timelineEventId ?? milestoneMeta?.timelineEventId ?? buildTimelineEventId(commit.hash)
    const label = meta?.label?.trim() || milestoneMeta?.label?.trim() || parsed.label || 'Versione senza etichetta'
    const integrity = normalizeIntegrity(parsed.kind, Boolean(meta || milestoneMeta))

    if (integrity === 'missing-metadata') {
      warnings.push(`Milestone senza metadata editoriali per commit ${commit.hash.slice(0, 7)}`)
    }

    const event: TimelineEventRecord = {
      timelineEventId,
      commitHash: commit.hash,
      kind: parsed.kind,
      label,
      noteMarkdown: meta?.noteMarkdown ?? milestoneMeta?.noteMarkdown,
      createdAt: commit.createdAt,
      author: {
        pecieAuthorId: 'local-author',
        pecieDisplayName: commit.authorName || 'Autore locale',
        gitName: commit.authorName || 'Pecie',
        gitEmail: commit.authorEmail || 'local@pecie.app'
      },
      touchedPaths: commit.touchedPaths,
      integrity
    }

    events.push(event)

    if (event.kind === 'milestone') {
      milestones.push({
        timelineEventId: event.timelineEventId,
        commitHash: event.commitHash,
        label: event.label,
        noteMarkdown: event.noteMarkdown,
        createdAt: event.createdAt
      })
    }
  }

  const groupedEvents = new Map<string, TimelineEventRecord[]>()
  for (const event of events) {
    const dayKey = event.createdAt.slice(0, 10)
    const items = groupedEvents.get(dayKey) ?? []
    items.push(event)
    groupedEvents.set(dayKey, items)
  }

  const groups: TimelineGroup[] = [...groupedEvents.entries()].map(([dayKey, dayEvents]) => ({
    groupId: `day-${dayKey}`,
    label: buildGroupLabel(dayKey),
    dayKey,
    sessionLabel: `${dayEvents.length} eventi`,
    eventIds: dayEvents.map((event) => event.timelineEventId)
  }))

  const integrityReport: HistoryRepairResult = {
    totalCommits: input.gitLog.length,
    eventsOk: events.filter((event) => event.integrity === 'ok').length,
    eventsRepaired: events.filter((event) => event.integrity === 'repaired').length,
    eventsMissingCommit: 0,
    eventsMissingMetadata: events.filter((event) => event.integrity === 'missing-metadata').length,
    warnings
  }

  return {
    snapshot: {
      version: '1.0.0',
      generatedAt: input.generatedAt,
      events,
      groups,
      integrityReport
    },
    milestones
  }
}
