import { useEffect, useMemo, useRef, useState } from 'react'

import type { AddBinderNodeResponse } from '@pecie/schemas'
import { Button, Dialog } from '@pecie/ui'

import { t } from '../i18n'
import type { BinderNodeDialogProps, BinderPanelProps, BinderTemplateId, VisibleBinderNode } from './types'
import { getInsertionOptions, getTemplatePreview, isSupportNoteNode } from './utils'

export function BinderNodeDialog({
  open,
  locale,
  projectPath,
  parentTitle,
  documentOptions,
  placementOptions,
  onClose,
  onCreate
}: BinderNodeDialogProps): React.JSX.Element | null {
  const [nodeType, setNodeType] = useState<'folder' | 'document'>('document')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [template, setTemplate] = useState<BinderTemplateId>('blank')
  const [contentSource, setContentSource] = useState<'template' | 'duplicate'>('template')
  const [duplicateFromDocumentId, setDuplicateFromDocumentId] = useState('')
  const [placement, setPlacement] = useState<'inside-end' | 'inside-start' | 'before' | 'after'>('inside-end')
  const [previewText, setPreviewText] = useState(getTemplatePreview('', 'blank'))
  const [previewLoading, setPreviewLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setNodeType('document')
    setTitle('')
    setDescription('')
    setTemplate('blank')
    setContentSource('template')
    setDuplicateFromDocumentId(documentOptions[0]?.documentId ?? '')
    setPlacement(placementOptions[0]?.value ?? 'inside-end')
    setPreviewText(getTemplatePreview('', 'blank'))
    setPreviewLoading(false)
    setBusy(false)
  }, [documentOptions, open, placementOptions])

  useEffect(() => {
    if (!open || nodeType !== 'document') {
      setPreviewLoading(false)
      return
    }

    if (contentSource === 'template') {
      setPreviewLoading(false)
      setPreviewText(getTemplatePreview(title, template))
      return
    }

    if (!duplicateFromDocumentId) {
      setPreviewLoading(false)
      setPreviewText('')
      return
    }

    let cancelled = false
    setPreviewLoading(true)
    void window.pecie
      .invokeSafe('document:load', {
        projectPath,
        documentId: duplicateFromDocumentId
      })
      .then((response) => {
        if (!cancelled) {
          setPreviewText(response.document.body)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewText('')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [contentSource, duplicateFromDocumentId, nodeType, open, projectPath, template, title])

  if (!open) {
    return null
  }

  const isDuplicateMode = nodeType === 'document' && contentSource === 'duplicate'
  const canCreate = !busy && (!isDuplicateMode || Boolean(duplicateFromDocumentId))

  return (
    <Dialog open={open} onClose={onClose} size="compact" icon="bi-plus-circle" title={t(locale, 'newNodeTitle')}>
      <div className="dialog-form">
        <section className="context-card">
          <h3>{t(locale, 'newNodeDestination')}</h3>
          <p>{parentTitle}</p>
        </section>
        <div className="field-grid">
          <label className="field">
            <span>{t(locale, 'newNodeType')}</span>
            <select value={nodeType} onChange={(event) => setNodeType(event.target.value as 'folder' | 'document')}>
              <option value="document">{t(locale, 'nodeTypeDocumentShort')}</option>
              <option value="folder">{t(locale, 'nodeTypeFolderShort')}</option>
            </select>
          </label>
          <label className="field">
            <span>{t(locale, 'newNodeMeaning')}</span>
            <input
              placeholder={nodeType === 'document' ? t(locale, 'newNodeMeaningDocument') : t(locale, 'newNodeMeaningFolder')}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <small className="field-hint">
              {nodeType === 'document' ? t(locale, 'newNodeHintDocument') : t(locale, 'newNodeHintFolder')}
            </small>
          </label>
        </div>
        <section className="context-card context-card--soft">
          <h3>{nodeType === 'document' ? t(locale, 'nodeTypeDocumentShort') : t(locale, 'nodeTypeFolderShort')}</h3>
          <p>{nodeType === 'document' ? t(locale, 'nodeTypeDocumentBody') : t(locale, 'nodeTypeFolderBody')}</p>
        </section>
        <div className="field-grid">
          <label className="field">
            <span>{t(locale, 'description')}</span>
            <textarea
              placeholder={t(locale, 'newNodeDescriptionPlaceholder')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="field">
            <span>{t(locale, 'newNodePosition')}</span>
            <select value={placement} onChange={(event) => setPlacement(event.target.value as typeof placement)}>
              {placementOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {nodeType === 'document' ? (
          <>
            <div className="field-grid">
              <label className="field">
                <span>{t(locale, 'newNodeContentSource')}</span>
                <select value={contentSource} onChange={(event) => setContentSource(event.target.value as 'template' | 'duplicate')}>
                  <option value="template">{t(locale, 'newNodeContentSourceTemplate')}</option>
                  <option value="duplicate">{t(locale, 'newNodeContentSourceDuplicate')}</option>
                </select>
              </label>
              {contentSource === 'template' ? (
                <label className="field">
                  <span>{t(locale, 'newNodeTemplate')}</span>
                  <select value={template} onChange={(event) => setTemplate(event.target.value as BinderTemplateId)}>
                    <option value="blank">{t(locale, 'newNodeTemplateBlank')}</option>
                    <option value="chapter">{t(locale, 'newNodeTemplateChapter')}</option>
                    <option value="notes">{t(locale, 'newNodeTemplateNotes')}</option>
                    <option value="scene">{t(locale, 'newNodeTemplateScene')}</option>
                  </select>
                </label>
              ) : (
                <label className="field">
                  <span>{t(locale, 'newNodeDuplicateSource')}</span>
                  <select value={duplicateFromDocumentId} onChange={(event) => setDuplicateFromDocumentId(event.target.value)}>
                    {documentOptions.length === 0 ? <option value="">{t(locale, 'newNodeDuplicateSourceEmpty')}</option> : null}
                    {documentOptions.map((option) => (
                      <option key={option.documentId} value={option.documentId}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <section className="context-card context-card--soft">
              <div className="template-preview__header">
                <h3>{t(locale, 'newNodeTemplatePreview')}</h3>
                {previewLoading ? <span className="count-chip">{t(locale, 'loadingDocument')}</span> : null}
              </div>
              <pre className="template-preview">
                {previewLoading ? t(locale, 'newNodePreviewLoading') : previewText.trim() || t(locale, 'newNodePreviewEmpty')}
              </pre>
            </section>
          </>
        ) : null}
        <div className="dialog-actions">
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            {t(locale, 'cancel')}
          </Button>
          <Button
            disabled={!canCreate}
            onClick={async () => {
              setBusy(true)
              try {
                await onCreate({
                  nodeType,
                  title,
                  description,
                  template,
                  placement,
                  duplicateFromDocumentId: isDuplicateMode ? duplicateFromDocumentId : undefined
                })
              } finally {
                setBusy(false)
              }
            }}
            size="sm"
            type="button"
          >
            {t(locale, 'createNode')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export function BinderPanel({
  locale,
  project,
  projectTitle,
  attachments,
  attachmentsBusy,
  attachmentsLoading,
  selectedNode,
  selectedId,
  setSelectedId,
  toggleFolder,
  visibleNodes,
  collapsed,
  onToggleCollapsed,
  onBinderChange,
  onOpenAttachment,
  onImportAttachments,
  onOpenGlobalSearch,
  onAbsorbSupportNode,
  dirtyDocumentId
}: BinderPanelProps): React.JSX.Element {
  const treeRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ nodeId: string; placement: 'before' | 'after' | 'inside' } | null>(null)
  const [recentlyExpandedFolderId, setRecentlyExpandedFolderId] = useState<string | null>(null)
  const placementOptions = useMemo(() => getInsertionOptions(locale, selectedNode, project.binder.rootId), [locale, project.binder.rootId, selectedNode])
  const manuscriptNodeCount = useMemo(
    () => visibleNodes.filter((node) => node.type === 'document' && !isSupportNoteNode(node)).length,
    [visibleNodes]
  )
  const supportNodeCount = useMemo(
    () => visibleNodes.filter((node) => node.type === 'document' && isSupportNoteNode(node)).length,
    [visibleNodes]
  )
  const documentOptions = useMemo(
    () =>
      visibleNodes
        .filter((node): node is VisibleBinderNode & { documentId: string } => node.type === 'document' && Boolean(node.documentId))
        .map((node) => ({
          documentId: node.documentId,
          label: `${'  '.repeat(node.depth)}${node.title}`
        })),
    [visibleNodes]
  )

  useEffect(() => {
    if (!recentlyExpandedFolderId) {
      return
    }

    const timer = window.setTimeout(() => {
      setRecentlyExpandedFolderId(null)
    }, 240)

    return () => window.clearTimeout(timer)
  }, [recentlyExpandedFolderId])

  function resolveInsertion(placement: 'inside-end' | 'inside-start' | 'before' | 'after'): { parentId: string; targetIndex?: number } {
    if (!selectedNode) {
      return { parentId: project.binder.rootId, targetIndex: placement === 'inside-start' ? 0 : undefined }
    }
    if (placement === 'inside-start' || placement === 'inside-end') {
      const parentId = selectedNode.type === 'folder' ? selectedNode.id : selectedNode.parentId ?? project.binder.rootId
      const parentNode = project.binder.nodes.find((node) => node.id === parentId)
      return { parentId, targetIndex: placement === 'inside-start' ? 0 : parentNode?.children?.length }
    }
    const parentId = selectedNode.parentId ?? project.binder.rootId
    const parentNode = project.binder.nodes.find((node) => node.id === parentId)
    const siblingIndex = parentNode?.children?.findIndex((childId) => childId === selectedNode.id) ?? -1
    return { parentId, targetIndex: siblingIndex === -1 ? undefined : placement === 'before' ? siblingIndex : siblingIndex + 1 }
  }

  async function createNode(payload: BinderNodeDialogProps['onCreate'] extends (arg: infer T) => Promise<void> ? T : never): Promise<void> {
    const insertion = resolveInsertion(payload.placement)
    setBusy(true)
    try {
      const response: AddBinderNodeResponse = await window.pecie.invokeSafe('binder:add-node', {
        projectPath: project.projectPath,
        parentId: insertion.parentId,
        nodeType: payload.nodeType,
        title: payload.title.trim() || undefined,
        description: payload.description.trim() || undefined,
        template: payload.nodeType === 'document' ? payload.template : undefined,
        duplicateFromDocumentId: payload.nodeType === 'document' ? payload.duplicateFromDocumentId : undefined,
        targetIndex: insertion.targetIndex
      })
      onBinderChange(response.binder)
      setSelectedId(response.createdNode.id)
      setIsCreateDialogOpen(false)
    } finally {
      setBusy(false)
    }
  }

  async function moveSelected(direction: 'up' | 'down'): Promise<void> {
    if (!selectedNode?.parentId) {
      return
    }
    const siblings = visibleNodes.filter((node) => node.parentId === selectedNode.parentId)
    const currentIndex = siblings.findIndex((node) => node.id === selectedNode.id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= siblings.length) {
      return
    }
    setBusy(true)
    try {
      const response = await window.pecie.invokeSafe('binder:move-node', {
        projectPath: project.projectPath,
        nodeId: selectedNode.id,
        targetParentId: selectedNode.parentId,
        targetIndex
      })
      onBinderChange(response.binder)
      setSelectedId(selectedNode.id)
    } finally {
      setBusy(false)
    }
  }

  async function moveNodeToDropTarget(nodeId: string, targetNode: VisibleBinderNode, placement: 'before' | 'after' | 'inside'): Promise<void> {
    const draggedNode = visibleNodes.find((node) => node.id === nodeId)
    if (!draggedNode || !isSupportNoteNode(draggedNode) || nodeId === targetNode.id) {
      return
    }
    if (targetNode.type === 'document' && !isSupportNoteNode(targetNode)) {
      setBusy(true)
      try {
        const response = await onAbsorbSupportNode({
          sourceNodeId: nodeId,
          targetDocumentId: targetNode.documentId ?? '',
          insertion: placement === 'before' ? 'prepend' : 'append'
        })
        onBinderChange(response.binder)
      } finally {
        setBusy(false)
        setDraggedNodeId(null)
        setDropTarget(null)
      }
      return
    }
    let targetParentId = targetNode.parentId ?? project.binder.rootId
    let targetIndex = 0
    if (placement === 'inside' && targetNode.type === 'folder') {
      targetParentId = targetNode.id
      const folderNode = project.binder.nodes.find((node) => node.id === targetNode.id)
      targetIndex = folderNode?.children?.length ?? 0
    } else {
      const parentNode = project.binder.nodes.find((node) => node.id === targetParentId)
      const siblingIndex = parentNode?.children?.findIndex((childId) => childId === targetNode.id) ?? -1
      if (siblingIndex === -1) {
        return
      }
      targetIndex = placement === 'before' ? siblingIndex : siblingIndex + 1
    }
    setBusy(true)
    try {
      const response = await window.pecie.invokeSafe('binder:move-node', {
        projectPath: project.projectPath,
        nodeId,
        targetParentId,
        targetIndex
      })
      onBinderChange(response.binder)
      setSelectedId(nodeId)
    } finally {
      setBusy(false)
      setDraggedNodeId(null)
      setDropTarget(null)
    }
  }

  function getDropPlacement(event: React.DragEvent<HTMLButtonElement>, node: VisibleBinderNode): 'before' | 'after' | 'inside' {
    if (node.type === 'folder') {
      const bounds = event.currentTarget.getBoundingClientRect()
      const offsetY = event.clientY - bounds.top
      if (offsetY < bounds.height * 0.28) return 'before'
      if (offsetY > bounds.height * 0.72) return 'after'
      return 'inside'
    }
    const bounds = event.currentTarget.getBoundingClientRect()
    return event.clientY - bounds.top < bounds.height / 2 ? 'before' : 'after'
  }

  async function deleteSelected(): Promise<void> {
    if (!selectedNode) {
      return
    }
    setBusy(true)
    try {
      const response = await window.pecie.invokeSafe('binder:delete-node', {
        projectPath: project.projectPath,
        nodeId: selectedNode.id
      })
      onBinderChange(response.binder)
      setSelectedId(selectedNode.parentId ?? project.binder.rootId)
    } finally {
      setBusy(false)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const currentIndex = visibleNodes.findIndex((node) => node.id === selectedId)
    if (currentIndex === -1) {
      return
    }
    let nextIndex = currentIndex
    if (event.key === 'ArrowDown') nextIndex = Math.min(currentIndex + 1, visibleNodes.length - 1)
    else if (event.key === 'ArrowUp') nextIndex = Math.max(currentIndex - 1, 0)
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = visibleNodes.length - 1
    else return
    event.preventDefault()
    const nextNode = visibleNodes[nextIndex]
    setSelectedId(nextNode.id)
    const nextElement = treeRef.current?.querySelector(`[data-node-id="${nextNode.id}"]`) as HTMLElement | null
    nextElement?.focus()
  }

  return (
    <>
      <BinderNodeDialog
        documentOptions={documentOptions}
        locale={locale}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={createNode}
        open={isCreateDialogOpen}
        parentTitle={selectedNode?.title ?? projectTitle}
        placementOptions={placementOptions}
        projectPath={project.projectPath}
      />
      <aside aria-labelledby="binder-panel-title" className={`workspace-binder${collapsed ? ' workspace-binder--collapsed' : ''}`}>
        <div className="panel-chrome">
          <div>
            <p className="eyebrow">{t(locale, 'binder')}</p>
            {!collapsed ? <h2 id="binder-panel-title">{projectTitle}</h2> : null}
          </div>
          <div className="panel-chrome__actions">
            {!collapsed ? <span className="count-chip">{`${visibleNodes.length} ${t(locale, 'nodes')}`}</span> : null}
            <button aria-label={collapsed ? t(locale, 'expandSidebar') : t(locale, 'collapseSidebar')} className="panel-toggle" onClick={onToggleCollapsed} type="button">
              <i aria-hidden="true" className={`bi ${collapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'}`}></i>
            </button>
          </div>
        </div>
        {/* ── Search always accessible ── */}
        {!collapsed ? (
          <div className="binder-search binder-search--actions">
            <button className="binder-search-launch" onClick={onOpenGlobalSearch} type="button">
              <i aria-hidden="true" className="bi bi-search binder-search__icon"></i>
              <span>{t(locale, 'globalSearchTitle')}</span>
            </button>
            <Button disabled={attachmentsBusy} onClick={() => void onImportAttachments()} size="sm" variant="ghost">
              {t(locale, 'importAttachment')}
            </Button>
          </div>
        ) : (
          <button
            aria-label={t(locale, 'searchDocuments')}
            className="binder-search-collapsed"
            onClick={onToggleCollapsed}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-search"></i>
          </button>
        )}
        <div className={`binder-actions${collapsed ? ' binder-actions--collapsed' : ''}`}>
          <Button aria-label={collapsed ? t(locale, 'newNode') : undefined} disabled={busy} onClick={() => setIsCreateDialogOpen(true)} size="sm" variant="secondary">
            {collapsed ? <i aria-hidden="true" className="bi bi-plus-lg"></i> : t(locale, 'newNode')}
          </Button>
        </div>
        <div className={`binder-actions binder-actions--secondary${collapsed ? ' binder-actions--collapsed' : ''}`}>
          <Button aria-label={collapsed ? t(locale, 'moveUp') : undefined} disabled={busy || !selectedNode} onClick={() => void moveSelected('up')} size="sm" variant="ghost">
            {collapsed ? <i aria-hidden="true" className="bi bi-arrow-up"></i> : t(locale, 'moveUp')}
          </Button>
          <Button aria-label={collapsed ? t(locale, 'moveDown') : undefined} disabled={busy || !selectedNode} onClick={() => void moveSelected('down')} size="sm" variant="ghost">
            {collapsed ? <i aria-hidden="true" className="bi bi-arrow-down"></i> : t(locale, 'moveDown')}
          </Button>
          <Button aria-label={collapsed ? t(locale, 'deleteNode') : undefined} disabled={busy || !selectedNode} onClick={() => void deleteSelected()} size="sm" variant="ghost">
            {collapsed ? <i aria-hidden="true" className="bi bi-trash3"></i> : t(locale, 'deleteNode')}
          </Button>
        </div>
        <div aria-label={t(locale, 'binder')} className="binder-tree" onKeyDown={handleKeyDown} ref={treeRef} role="tree" tabIndex={-1}>
          {visibleNodes.map((node, index) => {
            const isSupport = isSupportNoteNode(node)
            const previousNode = visibleNodes[index - 1]
            const startsSupportSection = isSupport && (!previousNode || !isSupportNoteNode(previousNode))

            return (
              <div key={node.id}>
                {!collapsed && startsSupportSection ? (
                  <div className="binder-tree__section-divider" role="separator">
                    <i aria-hidden="true" className="bi bi-journal-bookmark binder-tree__section-divider-icon binder-tree__section-divider-icon--support"></i>
                    <span>{`${t(locale, 'binderSupport')} · ${supportNodeCount}`}</span>
                  </div>
                ) : null}
                {!collapsed && index === 0 ? (
                  <div className="binder-tree__section-divider binder-tree__section-divider--top" role="separator">
                    <i aria-hidden="true" className="bi bi-journal-text binder-tree__section-divider-icon binder-tree__section-divider-icon--manuscript"></i>
                    <span>{`${t(locale, 'binderManuscript')} · ${manuscriptNodeCount}`}</span>
                  </div>
                ) : null}
                <button
                  aria-label={node.title}
                  aria-expanded={node.type === 'folder' ? node.isExpanded : undefined}
                  aria-level={Math.max(1, node.depth)}
                  aria-posinset={index + 1}
                  aria-selected={selectedId === node.id}
                  className={`binder-tree__item${collapsed ? ' binder-tree__item--collapsed' : ''}${draggedNodeId === node.id ? ' binder-tree__item--dragging' : ''}${dropTarget?.nodeId === node.id ? ` binder-tree__item--drop-${dropTarget.placement}` : ''}${isSupport ? ' binder-tree__item--support' : ''}${recentlyExpandedFolderId && node.parentId === recentlyExpandedFolderId ? ' binder-tree__item--revealed' : ''}`}
                  data-node-id={node.id}
                  draggable={isSupport}
                  onClick={() => {
                    setSelectedId(node.id)
                    if (node.type === 'folder') {
                      const expanded = toggleFolder(node.id)
                      setRecentlyExpandedFolderId(expanded ? node.id : null)
                    }
                  }}
                  onDragEnd={() => {
                    setDraggedNodeId(null)
                    setDropTarget(null)
                  }}
                  onDragOver={(event) => {
                    if (!draggedNodeId || draggedNodeId === node.id) return
                    event.preventDefault()
                    setDropTarget({ nodeId: node.id, placement: getDropPlacement(event, node) })
                  }}
                  onDragStart={(event) => {
                    if (!isSupport) {
                      event.preventDefault()
                      return
                    }
                    setDraggedNodeId(node.id)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', node.id)
                    event.dataTransfer.setData('application/x-pecie-support-node', node.id)
                  }}
                  onDrop={(event) => {
                    if (!draggedNodeId || draggedNodeId === node.id) return
                    event.preventDefault()
                    void moveNodeToDropTarget(draggedNodeId, node, getDropPlacement(event, node))
                  }}
                  role="treeitem"
                  style={
                    {
                      '--binder-depth': node.depth,
                      '--reveal-index': node.parentId === recentlyExpandedFolderId ? (node.parentId ? (project.binder.nodes.find((entry) => entry.id === node.parentId)?.children?.findIndex((childId) => childId === node.id) ?? 0) : 0) : 0,
                      paddingInlineStart: `${0.8 + node.depth * 0.85}rem`
                    } as React.CSSProperties
                  }
                  tabIndex={selectedId === node.id ? 0 : -1}
                  title={node.title}
                  type="button"
                >
                  {!collapsed && node.type === 'folder' ? (
                    <span aria-hidden="true" className={`binder-tree__disclosure${node.isExpanded ? ' binder-tree__disclosure--expanded' : ''}`}>
                      <i className="bi bi-chevron-right"></i>
                    </span>
                  ) : null}
                  <span
                    aria-hidden="true"
                    className={`binder-tree__marker ${
                      node.type === 'folder'
                        ? 'binder-tree__marker--folder'
                        : isSupport
                          ? 'binder-tree__marker--support'
                          : 'binder-tree__marker--document'
                    }`}
                  >
                    <i className={`bi ${node.type === 'folder' ? 'bi-folder2-open' : isSupport ? 'bi-journal-bookmark' : 'bi-file-earmark-text'}`}></i>
                  </span>
                  {collapsed ? (
                    selectedId === node.id ? <span className="binder-tree__dot-active" aria-hidden="true"></span> : null
                  ) : (
                    <span className="binder-tree__content">
                      <span className="binder-tree__headline">
                        <strong>{node.title}</strong>
                        {node.documentId && dirtyDocumentId === node.documentId ? (
                          <span aria-label={t(locale, 'unsavedChanges')} className="binder-tree__dirty-dot" title={t(locale, 'unsavedChanges')}></span>
                        ) : null}
                        {isSupport ? (
                          <span className="binder-node-badge binder-node-badge--support">{t(locale, 'binderSupportNode')}</span>
                        ) : node.type === 'folder' ? (
                          <span className="binder-node-badge binder-node-badge--folder">{t(locale, 'nodeTypeFolderShort')}</span>
                        ) : null}
                      </span>
                      <small>{node.type === 'document' ? node.path ?? t(locale, 'nodeTypeDocumentBody') : t(locale, 'nodeTypeFolderBody')}</small>
                      <span aria-hidden="true" className="binder-tree__progress">
                        <span
                          className={`binder-tree__progress-fill${selectedId === node.id ? ' binder-tree__progress-fill--active' : ''}${isSupport ? ' binder-tree__progress-fill--support' : ''}`}
                          style={{ width: `${Math.max(18, Math.min(100, 28 + node.depth * 14 + (selectedId === node.id ? 18 : 0) + (node.documentId && dirtyDocumentId === node.documentId ? 10 : 0))) }%` }}
                        ></span>
                      </span>
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
        {!collapsed ? (
          <section
            className={`binder-attachments${attachmentsBusy ? ' binder-attachments--busy' : ''}`}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes('Files')) {
                event.preventDefault()
              }
            }}
            onDrop={(event) => {
              const droppedPaths = Array.from(event.dataTransfer.files)
                .map((file) => (file as File & { path?: string }).path)
                .filter((value): value is string => Boolean(value))
              if (droppedPaths.length === 0) {
                return
              }
              event.preventDefault()
              void onImportAttachments(droppedPaths)
            }}
          >
            <div className="binder-tree__section-divider" role="separator">
              <span>{t(locale, 'attachmentsSectionTitle')}</span>
            </div>
            <div className="binder-attachments__dropzone">
              <strong>{t(locale, 'attachmentsDropzoneTitle')}</strong>
              <span>{t(locale, 'attachmentsDropzoneBody')}</span>
            </div>
            {attachmentsLoading ? (
              <p className="muted-copy">{t(locale, 'loadingAttachments')}</p>
            ) : attachments.length > 0 ? (
              <div className="binder-attachments__list">
                {attachments.map((attachment) => (
                  <button
                    className="binder-attachments__item"
                    key={attachment.absolutePath}
                    onClick={() => onOpenAttachment(attachment)}
                    type="button"
                  >
                    <strong>{attachment.name}</strong>
                    <small>{attachment.extension || t(locale, 'notAvailable')}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted-copy">{t(locale, 'writingHubEmptyUploads')}</p>
            )}
          </section>
        ) : null}
      </aside>
    </>
  )
}
