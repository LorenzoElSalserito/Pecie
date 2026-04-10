import { describe, expect, it } from 'vitest'

import type { BinderDocument } from '@pecie/schemas'

import { addBinderNode, deleteBinderNode, moveBinderNode } from './binder'

const binderFixture: BinderDocument = {
  rootId: 'root',
  nodes: [
    { id: 'root', type: 'folder', title: 'Root', children: ['chapter-folder', 'doc-1'] },
    { id: 'chapter-folder', type: 'folder', title: 'Chapters', children: ['doc-2'] },
    { id: 'doc-1', type: 'document', title: 'Intro', documentId: 'doc-1', path: 'docs/intro.md' },
    { id: 'doc-2', type: 'document', title: 'Body', documentId: 'doc-2', path: 'docs/body.md' }
  ]
}

describe('binder operations', () => {
  it('adds a node to a folder', () => {
    const result = addBinderNode(binderFixture, 'chapter-folder', {
      id: 'doc-3',
      type: 'document',
      title: 'New chapter',
      documentId: 'doc-3',
      path: 'docs/new.md'
    })

    expect(result.nodes.find((node) => node.id === 'chapter-folder')?.children).toContain('doc-3')
    expect(result.nodes.find((node) => node.id === 'doc-3')?.title).toBe('New chapter')
  })

  it('moves a node between folders', () => {
    const result = moveBinderNode(binderFixture, 'doc-1', 'chapter-folder', 0)

    expect(result.nodes.find((node) => node.id === 'root')?.children).not.toContain('doc-1')
    expect(result.nodes.find((node) => node.id === 'chapter-folder')?.children?.[0]).toBe('doc-1')
  })

  it('deletes a node recursively', () => {
    const result = deleteBinderNode(binderFixture, 'chapter-folder')

    expect(result.deletedNodeIds).toEqual(expect.arrayContaining(['chapter-folder', 'doc-2']))
    expect(result.binder.nodes.find((node) => node.id === 'chapter-folder')).toBeUndefined()
    expect(result.binder.nodes.find((node) => node.id === 'doc-2')).toBeUndefined()
  })
})
