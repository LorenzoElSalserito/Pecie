import type { BinderNode } from '@pecie/schemas'

export type SyntheticBinderFixture = {
  nodes: BinderNode[]
  rootId: string
  expandedFolderIds: Set<string>
  folderIds: string[]
  documentIds: string[]
}

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
    const path = shouldCreateFolder ? `drafts/section-${index}` : `drafts/chapter-${index}.md`
    const node: BinderNode = {
      id,
      title: shouldCreateFolder ? `Section ${index}` : `Document ${index}`,
      type: shouldCreateFolder ? 'folder' : 'document',
      children: shouldCreateFolder ? [] : undefined,
      path,
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
    nodes,
    rootId,
    expandedFolderIds: new Set(folderIds),
    folderIds,
    documentIds
  }
}
