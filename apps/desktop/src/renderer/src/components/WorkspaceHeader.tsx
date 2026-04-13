import { useMemo, useState } from 'react'

import { Button } from '@pecie/ui'

import { t } from '../i18n'
import type { WorkspaceHeaderProps } from './types'


export function WorkspaceHeader({
  locale,
  project,
  selectedNode,
  hasUnsavedChanges,
  onBackToProjects,
  onManageProjects,
  onSelectNode,
  onToggleBinder,
  onToggleContext,
  onNewProject,
  onOpenProject,
  onOpenExport,
  onOpenGuide,
  onOpenSettings,
  binderCollapsed,
  contextCollapsed,
  workspaceView,
  onChangeWorkspaceView
}: WorkspaceHeaderProps): React.JSX.Element {
  const [overflowOpen, setOverflowOpen] = useState(false)
  const binderToggleLabel = t(locale, binderCollapsed ? 'showStructure' : 'hideStructure')
  const contextToggleLabel = t(locale, contextCollapsed ? 'showContextPanel' : 'hideContextPanel')
  const breadcrumbParents = useMemo(() => {
    if (!selectedNode) {
      return []
    }

    const nodeMap = new Map(project.binder.nodes.map((node) => [node.id, node]))
    const parentById = new Map<string, string>()
    project.binder.nodes.forEach((node) => {
      node.children?.forEach((childId) => {
        parentById.set(childId, node.id)
      })
    })
    const chain: Array<{ id: string; title: string }> = []
    let parentId = selectedNode.parentId

    while (parentId && parentId !== project.binder.rootId) {
      const parentNode = nodeMap.get(parentId)
      if (!parentNode) {
        break
      }

      chain.unshift({ id: parentNode.id, title: parentNode.title })
      parentId = parentById.get(parentId) ?? null
    }

    return chain
  }, [project.binder.nodes, project.binder.rootId, selectedNode])

  function renderOverflowItem(params: {
    icon: string
    label: string
    onClick: () => void
    shortcut?: string
  }): React.JSX.Element {
    return (
      <button className="overflow-menu__item" onClick={params.onClick} role="menuitem" type="button">
        <span aria-hidden="true" className="overflow-menu__item-icon">
          <i className={`bi ${params.icon}`}></i>
        </span>
        <span className="overflow-menu__item-label">{params.label}</span>
        {params.shortcut ? <span className="overflow-menu__item-meta">{params.shortcut}</span> : null}
      </button>
    )
  }

  return (
    <header className="workspace-header workspace-header--compact">
      {/* ── Left: Identity ── */}
      <div className="workspace-header__identity">
        <button className="workspace-header__back" onClick={onBackToProjects} type="button" aria-label={t(locale, 'backToProjects')}>
          <i aria-hidden="true" className="bi bi-arrow-left"></i>
        </button>
        <div className="workspace-header__title-group">
          <p className="eyebrow">{t(locale, 'appName')}</p>
          <div className="workspace-header__project-line">
            <span className="status-pill">{project.manifest.title}</span>
            {hasUnsavedChanges ? (
              <span aria-label={t(locale, 'unsavedChanges')} className="workspace-session-indicator" title={t(locale, 'unsavedChanges')}>
                <span aria-hidden="true" className="workspace-session-indicator__dot" />
              </span>
            ) : null}
          </div>
          {selectedNode ? (
            <nav aria-label={t(locale, 'breadcrumbNavigation')} className="workspace-breadcrumb">
              <span className="workspace-breadcrumb__project">{project.manifest.title}</span>
              {breadcrumbParents.map((node) => (
                <div className="workspace-breadcrumb__segment" key={node.id}>
                  <span aria-hidden="true" className="workspace-breadcrumb__sep">›</span>
                  <button className="workspace-breadcrumb__link" onClick={() => onSelectNode(node.id)} type="button">
                    {node.title}
                  </button>
                </div>
              ))}
              <div className="workspace-breadcrumb__segment">
                <span aria-hidden="true" className="workspace-breadcrumb__sep">›</span>
                <span aria-current="page" className="workspace-breadcrumb__current">
                  {selectedNode.title}
                </span>
              </div>
            </nav>
          ) : null}
        </div>
      </div>

      {/* ── Center: Panel Toggles ── */}
      <div className="workspace-header__center">
        <div className="workspace-header__action-group workspace-header__action-group--toggles">
          <button
            aria-label={binderToggleLabel}
            aria-pressed={!binderCollapsed}
            className="panel-toggle workspace-toggle"
            onClick={onToggleBinder}
            title={binderToggleLabel}
            type="button"
          >
            <i
              aria-hidden="true"
              className={`bi ${binderCollapsed ? 'bi-layout-sidebar-inset' : 'bi-layout-sidebar'} workspace-toggle__icon${binderCollapsed ? '' : ' workspace-toggle__icon--active'}`}
            ></i>
          </button>
          <button
            aria-label={contextToggleLabel}
            aria-pressed={!contextCollapsed}
            className="panel-toggle workspace-toggle"
            onClick={onToggleContext}
            title={contextToggleLabel}
            type="button"
          >
            <i
              aria-hidden="true"
              className={`bi ${contextCollapsed ? 'bi-layout-sidebar-inset-reverse' : 'bi-layout-sidebar-reverse'} workspace-toggle__icon${contextCollapsed ? '' : ' workspace-toggle__icon--active'}`}
            ></i>
          </button>
        </div>
        <div className="workspace-header__view-switcher" role="tablist" aria-label={t(locale, 'workspaceViewsTitle')}>
          {([
            ['editor', t(locale, 'workspaceViewEditor')],
            ['timeline', t(locale, 'workspaceViewTimeline')],
            ['outliner', t(locale, 'workspaceViewOutliner')],
            ['corkboard', t(locale, 'workspaceViewCorkboard')],
            ['scrivenings', t(locale, 'workspaceViewScrivenings')]
          ] as const).map(([view, label]) => (
            <button
              aria-selected={workspaceView === view}
              className={`workspace-view-chip${workspaceView === view ? ' workspace-view-chip--active' : ''}`}
              key={view}
              onClick={() => onChangeWorkspaceView(view)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: Primary Actions + Overflow ── */}
      <div className="workspace-header__actions">
        <div className="workspace-header__action-group workspace-header__action-group--primary">
          <Button onClick={onOpenExport} size="sm" variant="secondary">
            <i aria-hidden="true" className="bi bi-box-arrow-up"></i>
            {t(locale, 'export')}
          </Button>
          <Button onClick={onNewProject} size="sm">
            <i aria-hidden="true" className="bi bi-plus-lg"></i>
            {t(locale, 'newProject')}
          </Button>
        </div>

        {/* ── Overflow menu ── */}
        <div className="overflow-menu-anchor">
          <Button
            aria-expanded={overflowOpen}
            aria-label={t(locale, 'moreActions')}
            onClick={() => setOverflowOpen((current) => !current)}
            size="sm"
            variant="ghost"
          >
            <i aria-hidden="true" className="bi bi-three-dots"></i>
          </Button>
          {overflowOpen ? (
            <>
              <button
                aria-label={t(locale, 'closeMenu')}
                className="overflow-menu-backdrop"
                onClick={() => setOverflowOpen(false)}
                type="button"
              />
              <div className="overflow-menu" role="menu">
                {renderOverflowItem({
                  icon: 'bi-folder2-open',
                  label: t(locale, 'openAnotherProject'),
                  onClick: () => {
                    onOpenProject()
                    setOverflowOpen(false)
                  }
                })}
                {renderOverflowItem({
                  icon: 'bi-archive',
                  label: t(locale, 'manageProjects'),
                  onClick: () => {
                    onManageProjects()
                    setOverflowOpen(false)
                  }
                })}
                {renderOverflowItem({
                  icon: 'bi-book',
                  label: t(locale, 'guideCenterTitle'),
                  onClick: () => {
                    onOpenGuide()
                    setOverflowOpen(false)
                  }
                })}
                <div className="overflow-menu__divider"></div>
                {renderOverflowItem({
                  icon: 'bi-gear',
                  label: t(locale, 'settings'),
                  onClick: () => {
                    onOpenSettings()
                    setOverflowOpen(false)
                  }
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}
