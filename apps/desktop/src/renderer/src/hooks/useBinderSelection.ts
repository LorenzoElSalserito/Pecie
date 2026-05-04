import { useEffect, useMemo, useState } from 'react'

import type { LoadedProject, VisibleBinderNode } from '../components/types'
import { flattenVisibleNodes, getInitialExpandedFolderIds } from '../components/utils'

export function useBinderSelection(project: NonNullable<LoadedProject>): {
  selectedNode: VisibleBinderNode | null
  selectedId: string
  setSelectedId: (nodeId: string) => void
  toggleFolder: (nodeId: string) => boolean
  visibleNodes: VisibleBinderNode[]
} {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => getInitialExpandedFolderIds(project.binder.nodes, project.binder.rootId)
  )
  const visibleNodes = useMemo(
    () => flattenVisibleNodes(project.binder.nodes, project.binder.rootId, expandedFolderIds),
    [expandedFolderIds, project.binder.nodes, project.binder.rootId]
  )

  const defaultSelectedId =
    visibleNodes.find((node) => node.type === 'document')?.id ?? visibleNodes[0]?.id ?? project.binder.rootId
  const [selectedId, setSelectedId] = useState(defaultSelectedId)

  useEffect(() => {
    setSelectedId(defaultSelectedId)
  }, [defaultSelectedId, project.projectPath])

  useEffect(() => {
    setExpandedFolderIds(getInitialExpandedFolderIds(project.binder.nodes, project.binder.rootId))
  }, [project.binder.nodes, project.binder.rootId, project.projectPath])

  useEffect(() => {
    if (selectedId === project.binder.rootId) {
      return
    }

    if (visibleNodes.some((node) => node.id === selectedId)) {
      return
    }

    setSelectedId(defaultSelectedId)
  }, [defaultSelectedId, project.binder.rootId, selectedId, visibleNodes])

  function toggleFolder(nodeId: string): boolean {
    let expanded = false

    setExpandedFolderIds((currentIds) => {
      const nextIds = new Set(currentIds)
      if (nextIds.has(nodeId)) {
        nextIds.delete(nodeId)
        expanded = false
      } else {
        nextIds.add(nodeId)
        expanded = true
      }
      return nextIds
    })

    return expanded
  }

  const selectedNode = visibleNodes.find((node) => node.id === selectedId) ?? null

  return {
    selectedNode,
    selectedId,
    setSelectedId,
    toggleFolder,
    visibleNodes
  }
}
