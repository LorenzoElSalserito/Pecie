import type {
  AuthorProfile,
  CreateCheckpointRequest,
  CreateCheckpointResponse,
  CreateMilestoneRequest,
  CreateMilestoneResponse,
  DiffDocumentResponse,
  ListTimelineRequest,
  ListTimelineResponse,
  MilestonesSnapshot,
  RepairTimelineRequest,
  RepairTimelineResponse,
  RestoreDocumentResponse,
  TimelineEventRecord,
  TimelineSnapshot
} from '@pecie/schemas'
import { validateMilestonesSnapshot, validateTimelineSnapshot } from '@pecie/schemas'

import { AppLoggerService } from '../logging/app-logger-service'
import { ProjectFileSystem } from '../fs/project-file-system'
import { buildFallbackLabel } from './checkpoint-policy'
import { commitMessageFormat } from './commit-message-format'
import { GitAdapter } from './git-adapter'
import { materializeTimeline } from './materializer'

function toGitIdentity(author: AuthorProfile): { name: string; email: string } {
  const normalizedName = author.name.trim() || 'Pecie'
  const localPart = normalizedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'pecie'

  return {
    name: normalizedName,
    email: `${localPart}@pecie.local`
  }
}

function emptyTimelineSnapshot(nowIso: string): TimelineSnapshot {
  return {
    version: '1.0.0',
    generatedAt: nowIso,
    events: [],
    groups: [],
    integrityReport: {
      totalCommits: 0,
      eventsOk: 0,
      eventsRepaired: 0,
      eventsMissingCommit: 0,
      eventsMissingMetadata: 0,
      warnings: []
    }
  }
}

function emptyMilestonesSnapshot(nowIso: string): MilestonesSnapshot {
  return {
    version: '1.0.0',
    generatedAt: nowIso,
    milestones: []
  }
}

type ResolvedHistoryBaseline =
  | {
      kind: 'previous-version'
      label: string
      createdAt: string
      content: string
    }
  | {
      kind: 'timeline-event'
      label: string
      createdAt: string
      content: string
      sourceEvent: TimelineEventRecord
    }

export class HistoryService {
  public constructor(
    private readonly fileSystem: ProjectFileSystem = new ProjectFileSystem(),
    private readonly git: GitAdapter = new GitAdapter(),
    private readonly logger?: AppLoggerService
  ) {}

  public async initialize(projectPath: string): Promise<void> {
    await this.writeTimelineMaterialization(projectPath)
  }

  public async createCheckpoint(input: CreateCheckpointRequest): Promise<CreateCheckpointResponse> {
    const hasChanges = await this.git.hasChanges(input.projectPath)
    if (!hasChanges) {
      return {
        created: false,
        reason: 'no-content-change'
      }
    }

    await this.git.addAll(input.projectPath)
    const label =
      input.label?.trim() ||
      buildFallbackLabel({
        trigger: 'onManualSave',
        documentTitle: input.documentTitle,
        binderPath: input.binderPath,
        nowIso: new Date().toISOString()
      })
    await this.git.commit(input.projectPath, commitMessageFormat.checkpoint({ label }), toGitIdentity(input.authorProfile))
    const { event } = await this.writeTimelineMaterialization(input.projectPath)

    return {
      created: true,
      reason: 'content-changed',
      event
    }
  }

  public async createMilestone(input: CreateMilestoneRequest): Promise<CreateMilestoneResponse> {
    const hasChanges = await this.git.hasChanges(input.projectPath)
    if (!hasChanges) {
      throw new Error('La milestone richiede modifiche non ancora registrate.')
    }

    await this.git.addAll(input.projectPath)
    await this.git.commit(
      input.projectPath,
      commitMessageFormat.milestone({ label: input.label.trim() }),
      toGitIdentity(input.authorProfile)
    )
    const { event } = await this.writeTimelineMaterialization(input.projectPath)
    if (!event) {
      throw new Error('Impossibile materializzare la milestone.')
    }

    return { event }
  }

  public async listTimeline(input: ListTimelineRequest): Promise<ListTimelineResponse> {
    const snapshot = await this.readTimelineSnapshot(input.projectPath)
    const filteredEvents = input.includeBootstrap ? snapshot.events : snapshot.events.filter((event) => event.kind !== 'bootstrap')
    const eventsById = new Map(filteredEvents.map((event) => [event.timelineEventId, event]))

    return {
      snapshot: {
        ...snapshot,
        events: filteredEvents,
        groups: snapshot.groups.filter((group) => group.eventIds.some((eventId) => eventsById.has(eventId)))
      },
      groups: snapshot.groups
        .map((group) => ({
          ...group,
          events: group.eventIds
            .map((eventId) => eventsById.get(eventId))
            .filter((event): event is TimelineEventRecord => Boolean(event))
            .map((event) => ({
              timelineEventId: event.timelineEventId,
              kind: event.kind,
              label: event.label,
              noteMarkdown: event.noteMarkdown,
              createdAt: event.createdAt,
              authorDisplayName: event.author.pecieDisplayName,
              touchedPaths: event.touchedPaths,
              integrity: event.integrity,
              isRepairable: event.integrity !== 'ok',
              commitHashShort: event.commitHash.slice(0, 7)
            }))
        }))
        .filter((group) => group.events.length > 0)
    }
  }

  public async repairTimeline(input: RepairTimelineRequest): Promise<RepairTimelineResponse> {
    const { snapshot, milestones } = await this.writeTimelineMaterialization(input.projectPath)
    return {
      snapshot,
      milestones,
      result: snapshot.integrityReport
    }
  }

  public async diffDocument(input: {
    projectPath: string
    relativePath: string
    currentContent: string
    baseline: { kind: 'previous-version' } | { kind: 'timeline-event'; timelineEventId: string }
  }): Promise<DiffDocumentResponse> {
    const baseline = await this.resolveBaseline(input.projectPath, input.relativePath, input.baseline)
    return {
      before: {
        content: baseline.content,
        createdAt: baseline.createdAt,
        label: baseline.label
      },
      after: {
        content: input.currentContent,
        createdAt: new Date().toISOString(),
        label: 'Versione corrente'
      }
    }
  }

  public async previewRestoreDocument(input: {
    projectPath: string
    relativePath: string
    currentContent: string
    sourceTimelineEventId: string
  }): Promise<RestoreDocumentResponse> {
    const baseline = await this.resolveBaseline(input.projectPath, input.relativePath, {
      kind: 'timeline-event',
      timelineEventId: input.sourceTimelineEventId
    })
    return {
      preview: {
        before: {
          content: input.currentContent,
          createdAt: new Date().toISOString(),
          label: 'Versione corrente'
        },
        after: {
          content: baseline.content,
          createdAt: baseline.createdAt,
          label: baseline.label
        },
        warning: 'Il ripristino puo reintrodurre testo eliminato o sostituire contenuto divergente.'
      }
    }
  }

  public async readHistoricalDocument(input: {
    projectPath: string
    relativePath: string
    sourceTimelineEventId: string
  }): Promise<string> {
    const baseline = await this.resolveBaseline(input.projectPath, input.relativePath, {
      kind: 'timeline-event',
      timelineEventId: input.sourceTimelineEventId
    })
    return baseline.content
  }

  public async readHistoricalBodySelection(input: {
    projectPath: string
    relativePath: string
    sourceTimelineEventId: string
    startOffset: number
    endOffset: number
  }): Promise<string> {
    const content = await this.readHistoricalDocument({
      projectPath: input.projectPath,
      relativePath: input.relativePath,
      sourceTimelineEventId: input.sourceTimelineEventId
    })
    const boundedStart = Math.max(0, Math.min(input.startOffset, content.length))
    const boundedEnd = Math.max(boundedStart, Math.min(input.endOffset, content.length))
    return content.slice(boundedStart, boundedEnd)
  }

  public async commitRestore(input: {
    projectPath: string
    sourceTimelineEventId: string
    authorProfile: AuthorProfile
  }): Promise<TimelineEventRecord> {
    const timeline = await this.readTimelineSnapshot(input.projectPath)
    let sourceEvent = timeline.events.find((event) => event.timelineEventId === input.sourceTimelineEventId)
    if (!sourceEvent) {
      const rebuilt = await this.writeTimelineMaterialization(input.projectPath)
      sourceEvent = rebuilt.snapshot.events.find((event) => event.timelineEventId === input.sourceTimelineEventId)
    }
    if (!sourceEvent) {
      throw new Error(`Evento timeline non trovato: ${input.sourceTimelineEventId}`)
    }

    await this.git.addAll(input.projectPath)
    await this.git.commit(
      input.projectPath,
      commitMessageFormat.restore({ label: sourceEvent.label }),
      toGitIdentity(input.authorProfile)
    )
    const { event } = await this.writeTimelineMaterialization(input.projectPath)
    if (!event) {
      throw new Error('Impossibile materializzare il restore.')
    }
    return event
  }

  private async readTimelineSnapshot(projectPath: string): Promise<TimelineSnapshot> {
    try {
      return validateTimelineSnapshot(await this.fileSystem.readJson(projectPath, 'history/timeline.json'))
    } catch {
      const snapshot = emptyTimelineSnapshot(new Date().toISOString())
      await this.fileSystem.writeJson(projectPath, 'history/timeline.json', snapshot)
      return snapshot
    }
  }

  private async readMilestonesSnapshot(projectPath: string): Promise<MilestonesSnapshot> {
    try {
      return validateMilestonesSnapshot(await this.fileSystem.readJson(projectPath, 'history/milestones.json'))
    } catch {
      const snapshot = emptyMilestonesSnapshot(new Date().toISOString())
      await this.fileSystem.writeJson(projectPath, 'history/milestones.json', snapshot)
      return snapshot
    }
  }

  private async resolveBaseline(
    projectPath: string,
    relativePath: string,
    baseline: { kind: 'previous-version' } | { kind: 'timeline-event'; timelineEventId: string }
  ): Promise<ResolvedHistoryBaseline> {
    if (baseline.kind === 'previous-version') {
      const history = await this.git.listFileHistory(projectPath, relativePath)
      const commitHash = history[0]
      if (!commitHash) {
        return {
          kind: 'previous-version',
          label: 'Nessuna versione precedente',
          createdAt: new Date().toISOString(),
          content: ''
        }
      }
      const gitLog = await this.git.log(projectPath)
      const commit = gitLog.find((entry) => entry.hash === commitHash)
      return {
        kind: 'previous-version',
        label: 'Versione precedente',
        createdAt: commit?.createdAt ?? new Date().toISOString(),
        content: await this.git.showFile(projectPath, commitHash, relativePath)
      }
    }

    const timeline = await this.readTimelineSnapshot(projectPath)
    let sourceEvent = timeline.events.find((event) => event.timelineEventId === baseline.timelineEventId)
    if (!sourceEvent) {
      const rebuilt = await this.writeTimelineMaterialization(projectPath)
      sourceEvent = rebuilt.snapshot.events.find((event) => event.timelineEventId === baseline.timelineEventId)
    }
    if (!sourceEvent) {
      throw new Error(`Evento timeline non trovato: ${baseline.timelineEventId}`)
    }

    return {
      kind: 'timeline-event',
      label: sourceEvent.label,
      createdAt: sourceEvent.createdAt,
      content: await this.git.showFile(projectPath, sourceEvent.commitHash, relativePath),
      sourceEvent
    }
  }

  private async writeTimelineMaterialization(projectPath: string): Promise<{
    snapshot: TimelineSnapshot
    milestones: MilestonesSnapshot
    event?: TimelineEventRecord
  }> {
    const [timelineMeta, milestonesMeta, gitLog] = await Promise.all([
      this.readTimelineSnapshot(projectPath),
      this.readMilestonesSnapshot(projectPath),
      this.git.log(projectPath)
    ])
    const generatedAt = new Date().toISOString()
    const materialized = materializeTimeline({
      gitLog,
      generatedAt,
      editorialMeta: {
        milestonesByCommitHash: new Map(milestonesMeta.milestones.map((item) => [item.commitHash, item])),
        timelineByCommitHash: new Map(
          timelineMeta.events.map((event) => [
            event.commitHash,
            {
              timelineEventId: event.timelineEventId,
              commitHash: event.commitHash,
              kind: event.kind,
              label: event.label,
              noteMarkdown: event.noteMarkdown
            }
          ])
        )
      }
    })
    const snapshot = materialized.snapshot
    const milestones: MilestonesSnapshot = {
      version: '1.0.0',
      generatedAt,
      milestones: materialized.milestones
    }

    await this.fileSystem.writeJson(projectPath, 'history/timeline.json', snapshot)
    await this.fileSystem.writeJson(projectPath, 'history/milestones.json', milestones)
    await this.fileSystem.writeJson(projectPath, 'schemas/timeline.schema.json', {
      $id: 'timeline.schema.json',
      type: 'object',
      required: ['version', 'generatedAt', 'events', 'groups', 'integrityReport']
    })
    await this.fileSystem.writeJson(projectPath, 'schemas/milestones.schema.json', {
      $id: 'milestones.schema.json',
      type: 'object',
      required: ['version', 'generatedAt', 'milestones']
    })
    await this.fileSystem.writeJson(projectPath, 'schemas/history-repair.schema.json', {
      $id: 'history-repair.schema.json',
      type: 'object',
      required: ['totalCommits', 'eventsOk', 'eventsRepaired', 'eventsMissingCommit', 'eventsMissingMetadata', 'warnings']
    })

    const event = snapshot.events.at(-1)
    await this.logger?.log({
      level: 'info',
      category: 'project',
      event: 'history-materialized',
      message: 'Timeline materialized from git history.',
      context: {
        projectPath,
        totalEvents: snapshot.events.length,
        latestEventId: event?.timelineEventId ?? null,
        latestCommitHash: event?.commitHash ?? null
      }
    })

    return { snapshot, milestones, event }
  }
}
