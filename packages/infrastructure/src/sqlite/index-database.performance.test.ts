import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { makeSyntheticBinder, makeSyntheticSearchCorpus, makeSyntheticTimeline } from '../testing/synthetic-fixtures'
import { initializeDerivedIndexDatabase, searchDerivedIndex, upsertDerivedIndexDocuments } from './index-database'

describe('derived search index performance', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { recursive: true, force: true })))
  })

  it('provides large synthetic fixtures for binder, timeline and search corpus', () => {
    const binder = makeSyntheticBinder(5000)
    const timeline = makeSyntheticTimeline(1000)
    const corpus = makeSyntheticSearchCorpus(5000, 80)

    expect(binder.nodes).toHaveLength(5001)
    expect(timeline.events).toHaveLength(1000)
    expect(timeline.groups.length).toBeGreaterThan(1)
    expect(corpus).toHaveLength(5000)
    expect(corpus.some((document) => document.body.includes('needle-performance-token'))).toBe(true)
  })

  it('keeps FTS queries on a 5000-document corpus below the 300ms budget', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'pecie-search-benchmark-'))
    cleanupPaths.push(root)
    const databasePath = path.join(root, 'cache', 'index.sqlite')
    await mkdir(path.dirname(databasePath), { recursive: true })

    initializeDerivedIndexDatabase(databasePath)
    upsertDerivedIndexDocuments(
      databasePath,
      makeSyntheticSearchCorpus(5000, 80).map((document) => ({
        ...document,
        nodeId: document.nodeId
      }))
    )

    const startedAt = performance.now()
    const results = searchDerivedIndex(databasePath, 'needle performance', 12)
    const elapsedMs = performance.now() - startedAt

    expect(results.nodes.length + results.content.length).toBeGreaterThan(0)
    expect(elapsedMs).toBeLessThan(300)
  })
})
