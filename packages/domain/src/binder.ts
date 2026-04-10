import type { BinderDocument, BinderNode } from '@pecie/schemas'

function cloneBinder(binder: BinderDocument): BinderDocument {
  return {
    ...binder,
    nodes: binder.nodes.map((node) => ({
      ...node,
      children: node.children ? [...node.children] : undefined
    }))
  }
}

function getNodeMap(binder: BinderDocument): Map<string, BinderNode> {
  return new Map(binder.nodes.map((node) => [node.id, node]))
}

function assertFolder(node: BinderNode | undefined, nodeId: string): asserts node is BinderNode & { type: 'folder'; children: string[] } {
  if (!node || node.type !== 'folder') {
    throw new Error(`Nodo cartella non trovato: ${nodeId}`)
  }

  node.children ??= []
}

function getParentId(binder: BinderDocument, nodeId: string): string | null {
  for (const node of binder.nodes) {
    if (node.children?.includes(nodeId)) {
      return node.id
    }
  }

  return null
}

function collectDescendants(nodeMap: Map<string, BinderNode>, nodeId: string, collector: Set<string>): void {
  if (collector.has(nodeId)) {
    return
  }

  collector.add(nodeId)
  const node = nodeMap.get(nodeId)
  for (const childId of node?.children ?? []) {
    collectDescendants(nodeMap, childId, collector)
  }
}

export function addBinderNode(
  binder: BinderDocument,
  parentId: string,
  node: BinderNode,
  targetIndex?: number
): BinderDocument {
  const nextBinder = cloneBinder(binder)
  const nodeMap = getNodeMap(nextBinder)
  const parentNode = nodeMap.get(parentId)
  assertFolder(parentNode, parentId)

  const insertIndex = typeof targetIndex === 'number'
    ? Math.max(0, Math.min(targetIndex, parentNode.children.length))
    : parentNode.children.length
  parentNode.children.splice(insertIndex, 0, node.id)
  nextBinder.nodes.push({
    ...node,
    children: node.type === 'folder' ? [...(node.children ?? [])] : undefined
  })

  return nextBinder
}

export function moveBinderNode(
  binder: BinderDocument,
  nodeId: string,
  targetParentId: string,
  targetIndex: number
): BinderDocument {
  if (nodeId === binder.rootId) {
    throw new Error('Il nodo root non puo essere spostato.')
  }

  const nextBinder = cloneBinder(binder)
  const nodeMap = getNodeMap(nextBinder)
  const node = nodeMap.get(nodeId)
  if (!node) {
    throw new Error(`Nodo non trovato: ${nodeId}`)
  }

  const targetParent = nodeMap.get(targetParentId)
  assertFolder(targetParent, targetParentId)

  const descendants = new Set<string>()
  collectDescendants(nodeMap, nodeId, descendants)
  if (descendants.has(targetParentId)) {
    throw new Error('Impossibile spostare un nodo dentro un suo discendente.')
  }

  const currentParentId = getParentId(nextBinder, nodeId)
  const currentParent = currentParentId ? nodeMap.get(currentParentId) : undefined
  if (currentParent?.children) {
    currentParent.children = currentParent.children.filter((childId) => childId !== nodeId)
  }

  const boundedIndex = Math.max(0, Math.min(targetIndex, targetParent.children.length))
  targetParent.children.splice(boundedIndex, 0, nodeId)

  return nextBinder
}

export function deleteBinderNode(
  binder: BinderDocument,
  nodeId: string
): { binder: BinderDocument; deletedNodeIds: string[] } {
  if (nodeId === binder.rootId) {
    throw new Error('Il nodo root non puo essere eliminato.')
  }

  const nextBinder = cloneBinder(binder)
  const nodeMap = getNodeMap(nextBinder)
  if (!nodeMap.has(nodeId)) {
    throw new Error(`Nodo non trovato: ${nodeId}`)
  }

  const deletedIds = new Set<string>()
  collectDescendants(nodeMap, nodeId, deletedIds)

  for (const node of nextBinder.nodes) {
    if (node.children) {
      node.children = node.children.filter((childId) => !deletedIds.has(childId))
    }
  }

  return {
    binder: {
      ...nextBinder,
      nodes: nextBinder.nodes.filter((node) => !deletedIds.has(node.id))
    },
    deletedNodeIds: [...deletedIds]
  }
}
