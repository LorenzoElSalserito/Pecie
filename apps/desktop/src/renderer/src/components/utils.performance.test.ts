import { describe, expect, it } from 'vitest'

import { makeSyntheticBinder } from '../testing/synthetic-binder'
import { flattenVisibleNodes, getInitialExpandedFolderIds } from './utils'

describe('flattenVisibleNodes performance', () => {
  it('flattens a 5000-node binder within the desktop performance budget', () => {
    const fixture = makeSyntheticBinder(5000)

    const startedAt = performance.now()
    const visibleNodes = flattenVisibleNodes(fixture.nodes, fixture.rootId, fixture.expandedFolderIds)
    const elapsedMs = performance.now() - startedAt

    expect(visibleNodes).toHaveLength(5000)
    expect(visibleNodes[0]?.depth).toBe(1)
    expect(elapsedMs).toBeLessThan(150)
  })

  it('only materializes visible descendants when folders are collapsed', () => {
    const fixture = makeSyntheticBinder(5000)
    const expandedFolderIds = new Set<string>([fixture.rootId, fixture.folderIds[1], fixture.folderIds[2]])

    const startedAt = performance.now()
    const visibleNodes = flattenVisibleNodes(fixture.nodes, fixture.rootId, expandedFolderIds)
    const elapsedMs = performance.now() - startedAt

    expect(visibleNodes.length).toBeLessThan(5000)
    expect(elapsedMs).toBeLessThan(80)
  })

  it('uses lazy initial expansion for large binders while keeping small binders fully expanded', () => {
    const smallFixture = makeSyntheticBinder(100)
    const largeFixture = makeSyntheticBinder(5000)

    const smallExpandedIds = getInitialExpandedFolderIds(smallFixture.nodes, smallFixture.rootId)
    const largeExpandedIds = getInitialExpandedFolderIds(largeFixture.nodes, largeFixture.rootId)
    const largeVisibleNodes = flattenVisibleNodes(largeFixture.nodes, largeFixture.rootId, largeExpandedIds)

    expect(smallExpandedIds.size).toBe(smallFixture.folderIds.length)
    expect(largeExpandedIds.has(largeFixture.rootId)).toBe(true)
    expect(largeExpandedIds.size).toBeLessThan(largeFixture.folderIds.length)
    expect(largeVisibleNodes.length).toBeLessThan(5000)
    expect(largeVisibleNodes.some((node) => node.type === 'document')).toBe(true)
  })
})
