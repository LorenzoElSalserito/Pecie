import { describe, expect, it } from 'vitest'

import type { ListTimelineResponse, TimelineEventKind, TimelineSnapshot } from '@pecie/schemas'

import { getTimelineMetrics, getTimelineRenderWindow } from './timeline-utils'

function makeTimelineResponse(eventCount: number): ListTimelineResponse {
  const snapshot: TimelineSnapshot = {
    version: '1.0.0',
    generatedAt: '2026-04-29T10:00:00.000Z',
    events: Array.from({ length: eventCount }, (_, index) => {
      const kind: TimelineEventKind =
        index === 0 ? 'bootstrap' : index % 10 === 0 ? 'milestone' : index % 17 === 0 ? 'restore' : 'checkpoint'
      return {
        timelineEventId: `timeline-event-${index}`,
        commitHash: `abcdef${index.toString(16).padStart(8, '0')}`,
        kind,
        label: `Timeline event ${index}`,
        createdAt: `2026-04-${String(Math.min(28, Math.floor(index / 80) + 1)).padStart(2, '0')}T10:${String(index % 60).padStart(2, '0')}:00.000Z`,
        author: {
          pecieAuthorId: 'author-1',
          pecieDisplayName: 'Synthetic Author',
          gitName: 'Synthetic Author',
          gitEmail: 'synthetic@example.test'
        },
        touchedPaths: [`drafts/chapter-${index}.md`],
        integrity: index % 211 === 0 ? 'missing-metadata' : 'ok'
      }
    }),
    groups: [],
    integrityReport: {
      totalCommits: eventCount,
      eventsOk: eventCount,
      eventsRepaired: 0,
      eventsMissingCommit: 0,
      eventsMissingMetadata: 0,
      warnings: []
    }
  }

  const groups = Array.from(new Set(snapshot.events.map((event) => event.createdAt.slice(0, 10)))).map((dayKey, index) => ({
    groupId: `group-${dayKey}`,
    label: dayKey,
    dayKey,
    sessionLabel: `Session ${index + 1}`,
    events: snapshot.events
      .filter((event) => event.createdAt.startsWith(dayKey))
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

  snapshot.groups = groups.map((group) => ({
    groupId: group.groupId,
    label: group.label,
    dayKey: group.dayKey,
    sessionLabel: group.sessionLabel,
    eventIds: group.events.map((event) => event.timelineEventId)
  }))

  return {
    snapshot,
    groups
  }
}

describe('timeline render performance helpers', () => {
  it('computes timeline metrics in one pass for large histories', () => {
    const timeline = makeTimelineResponse(5000)

    const startedAt = performance.now()
    const metrics = getTimelineMetrics(timeline)
    const elapsedMs = performance.now() - startedAt

    expect(metrics.totalEventCount).toBe(5000)
    expect(metrics.milestoneCount).toBeGreaterThan(0)
    expect(metrics.inconsistentEventsCount).toBeGreaterThan(0)
    expect(elapsedMs).toBeLessThan(20)
  })

  it('windows rendered timeline events without losing total counts', () => {
    const timeline = makeTimelineResponse(5000)

    const startedAt = performance.now()
    const renderWindow = getTimelineRenderWindow(timeline, 300)
    const elapsedMs = performance.now() - startedAt

    expect(renderWindow.renderedEventCount).toBe(300)
    expect(renderWindow.totalEventCount).toBe(5000)
    expect(renderWindow.hasMore).toBe(true)
    expect(renderWindow.groups.length).toBeGreaterThan(0)
    expect(renderWindow.groups.reduce((sum, group) => sum + group.events.length, 0)).toBe(300)
    expect(elapsedMs).toBeLessThan(20)
  })
})
