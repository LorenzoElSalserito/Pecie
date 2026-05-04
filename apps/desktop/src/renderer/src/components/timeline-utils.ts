import type { TimelineViewProps } from './types'

export const TIMELINE_EVENT_RENDER_INCREMENT = 300

type TimelineGroupView = NonNullable<TimelineViewProps['timeline']>['groups'][number]

export type TimelineRenderWindow = {
  groups: TimelineGroupView[]
  renderedEventCount: number
  totalEventCount: number
  hasMore: boolean
}

export function getTimelineMetrics(timeline: TimelineViewProps['timeline']): {
  totalEventCount: number
  milestoneCount: number
  inconsistentEventsCount: number
} {
  const events = timeline?.snapshot.events ?? []
  let milestoneCount = 0
  let inconsistentEventsCount = 0

  for (const event of events) {
    if (event.kind === 'milestone') {
      milestoneCount += 1
    }
    if (event.integrity !== 'ok') {
      inconsistentEventsCount += 1
    }
  }

  return {
    totalEventCount: events.length,
    milestoneCount,
    inconsistentEventsCount
  }
}

export function getTimelineRenderWindow(
  timeline: TimelineViewProps['timeline'],
  eventLimit: number
): TimelineRenderWindow {
  if (!timeline || eventLimit <= 0) {
    return {
      groups: [],
      renderedEventCount: 0,
      totalEventCount: timeline?.snapshot.events.length ?? 0,
      hasMore: Boolean(timeline?.snapshot.events.length)
    }
  }

  const groups: TimelineGroupView[] = []
  let remaining = eventLimit
  let renderedEventCount = 0

  for (const group of timeline.groups) {
    if (remaining <= 0) {
      break
    }

    const events = group.events.slice(0, remaining)
    if (events.length > 0) {
      groups.push({
        ...group,
        events
      })
      renderedEventCount += events.length
      remaining -= events.length
    }
  }

  const totalEventCount = timeline.snapshot.events.length
  return {
    groups,
    renderedEventCount,
    totalEventCount,
    hasMore: renderedEventCount < totalEventCount
  }
}
