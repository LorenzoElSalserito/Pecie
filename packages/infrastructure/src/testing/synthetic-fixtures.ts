import type { BinderDocument, BinderNode, TimelineEventKind, TimelineSnapshot } from '@pecie/schemas'

export type SyntheticBinderFixture = BinderDocument & {
  expandedFolderIds: Set<string>
  folderIds: string[]
  documentIds: string[]
}

export type SyntheticSearchDocument = {
  documentId: string
  nodeId: string
  path: string
  title: string
  body: string
  updatedAt: string
}

const vocabulary = [
  'chapter',
  'draft',
  'editorial',
  'revision',
  'archive',
  'source',
  'timeline',
  'binder',
  'citation',
  'export',
  'local',
  'portable',
  'manuscript',
  'section',
  'context',
  'research'
] as const

export function makeSyntheticBinder(nodeCount: number): SyntheticBinderFixture {
  const rootId = 'root'
  const nodes: BinderNode[] = [
    {
      id: rootId,
      title: 'Root',
      type: 'folder',
      children: [],
      path: ''
    }
  ]
  const folderIds: string[] = [rootId]
  const documentIds: string[] = []

  for (let index = 1; index <= nodeCount; index += 1) {
    const parentId = folderIds[(index - 1) % folderIds.length]
    const parentNode = nodes.find((node) => node.id === parentId)
    if (!parentNode) {
      continue
    }

    const shouldCreateFolder = index % 5 === 0
    const id = shouldCreateFolder ? `folder-${index}` : `document-${index}`
    const node: BinderNode = {
      id,
      title: shouldCreateFolder ? `Section ${index}` : `Document ${index}`,
      type: shouldCreateFolder ? 'folder' : 'document',
      children: shouldCreateFolder ? [] : undefined,
      path: shouldCreateFolder ? `drafts/section-${index}` : `drafts/chapter-${index}.md`,
      documentId: shouldCreateFolder ? undefined : `doc-${index}`
    }

    parentNode.children = [...(parentNode.children ?? []), id]
    nodes.push(node)

    if (shouldCreateFolder) {
      folderIds.push(id)
    } else {
      documentIds.push(id)
    }
  }

  return {
    rootId,
    nodes,
    expandedFolderIds: new Set(folderIds),
    folderIds,
    documentIds
  }
}

export function makeSyntheticTimeline(eventCount: number): TimelineSnapshot {
  const generatedAt = '2026-04-29T10:00:00.000Z'
  const events = Array.from({ length: eventCount }, (_, index) => {
    const day = Math.floor(index / 50) + 1
    const kind: TimelineEventKind = index === 0 ? 'bootstrap' : index % 10 === 0 ? 'milestone' : index % 13 === 0 ? 'restore' : 'checkpoint'
    return {
      timelineEventId: `timeline-event-${index}`,
      commitHash: `abcdef${index.toString(16).padStart(8, '0')}`,
      kind,
      label: `${kind} ${index}`,
      noteMarkdown: index % 7 === 0 ? `Synthetic note ${index}` : undefined,
      createdAt: `2026-04-${String(Math.min(day, 28)).padStart(2, '0')}T10:${String(index % 60).padStart(2, '0')}:00.000Z`,
      author: {
        pecieAuthorId: 'author-1',
        pecieDisplayName: 'Synthetic Author',
        gitName: 'Synthetic Author',
        gitEmail: 'synthetic@example.test'
      },
      touchedPaths: [`drafts/chapter-${index}.md`],
      integrity: 'ok' as const
    }
  })

  const groups = Array.from(new Set(events.map((event) => event.createdAt.slice(0, 10)))).map((dayKey, index) => ({
    groupId: `timeline-group-${dayKey}`,
    label: dayKey,
    dayKey,
    sessionLabel: `Session ${index + 1}`,
    eventIds: events.filter((event) => event.createdAt.startsWith(dayKey)).map((event) => event.timelineEventId)
  }))

  return {
    version: '1.0.0',
    generatedAt,
    events,
    groups,
    integrityReport: {
      totalCommits: eventCount,
      eventsOk: eventCount,
      eventsRepaired: 0,
      eventsMissingCommit: 0,
      eventsMissingMetadata: 0,
      warnings: []
    }
  }
}

export function makeSyntheticSearchCorpus(documentCount: number, averageWords: number): SyntheticSearchDocument[] {
  const wordCount = Math.max(8, averageWords)

  return Array.from({ length: documentCount }, (_, documentIndex) => {
    const words: string[] = Array.from(
      { length: wordCount },
      (_, wordIndex) => vocabulary[(documentIndex + wordIndex) % vocabulary.length]
    )
    if (documentIndex % 137 === 0) {
      words.splice(Math.floor(words.length / 2), 0, 'needle-performance-token')
    }

    return {
      documentId: `synthetic-doc-${documentIndex}`,
      nodeId: `synthetic-node-${documentIndex}`,
      path: `drafts/synthetic-${documentIndex}.md`,
      title: documentIndex % 251 === 0 ? `Needle Performance Chapter ${documentIndex}` : `Synthetic Chapter ${documentIndex}`,
      body: words.join(' '),
      updatedAt: `2026-04-${String((documentIndex % 28) + 1).padStart(2, '0')}T10:00:00.000Z`
    }
  })
}
