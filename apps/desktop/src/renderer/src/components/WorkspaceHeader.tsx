import { useEffect, useMemo, useState } from 'react'

import { Button, Icon, Tabs, type IconName } from '@pecie/ui'

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
  onOpenShare,
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

  useEffect(() => {
    if (!overflowOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOverflowOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [overflowOpen])
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
    icon: IconName
    label: string
    onClick: () => void
    shortcut?: string
    tutorialId?: string
  }): React.JSX.Element {
    return (
      <button
        className="overflow-menu__item"
        data-tutorial-id={params.tutorialId}
        onClick={params.onClick}
        role="menuitem"
        type="button"
      >
        <span aria-hidden="true" className="overflow-menu__item-icon">
          <Icon name={params.icon} />
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
          <Icon name="arrow-left" />
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
            <Icon
              className={`workspace-toggle__icon${binderCollapsed ? '' : ' workspace-toggle__icon--active'}`}
              name={binderCollapsed ? 'layout-sidebar-inset' : 'layout-sidebar'}
            />
          </button>
          <button
            aria-label={contextToggleLabel}
            aria-pressed={!contextCollapsed}
            className="panel-toggle workspace-toggle"
            onClick={onToggleContext}
            title={contextToggleLabel}
            type="button"
          >
            <Icon
              className={`workspace-toggle__icon${contextCollapsed ? '' : ' workspace-toggle__icon--active'}`}
              name={contextCollapsed ? 'layout-sidebar-inset-reverse' : 'layout-sidebar-reverse'}
            />
          </button>
        </div>
        <Tabs
          activeItemClassName="workspace-view-chip--active"
          className="workspace-header__view-switcher"
          itemClassName="workspace-view-chip"
          items={(
            [
              ['editor', t(locale, 'workspaceViewEditor')],
              ['research', t(locale, 'workspaceViewResearch')],
              ['timeline', t(locale, 'workspaceViewTimeline')],
              ['outliner', t(locale, 'workspaceViewOutliner')],
              ['corkboard', t(locale, 'workspaceViewCorkboard')],
              ['scrivenings', t(locale, 'workspaceViewScrivenings')]
            ] as const
          ).map(([view, label]) => ({ value: view, label, tutorialId: `workspace-view-${view}` }))}
          label={t(locale, 'workspaceViewsTitle')}
          onChange={onChangeWorkspaceView}
          value={workspaceView}
        />
      </div>

      {/* ── Right: Primary Actions + Overflow ── */}
      <div className="workspace-header__actions">
        <div className="workspace-header__action-group workspace-header__action-group--primary">
          <Button data-tutorial-id="workspace-open-export" onClick={onOpenExport} size="sm" variant="secondary">
            <Icon name="box-arrow-up" />
            {t(locale, 'export')}
          </Button>
          <Button onClick={onNewProject} size="sm">
            <Icon name="plus-lg" />
            {t(locale, 'newProject')}
          </Button>
        </div>

        {/* ── Overflow menu ── */}
        <div className="overflow-menu-anchor">
          <Button
            aria-expanded={overflowOpen}
            aria-label={t(locale, 'moreActions')}
            data-tutorial-id="workspace-overflow-menu"
            onClick={() => setOverflowOpen((current) => !current)}
            size="sm"
            variant="ghost"
          >
            <Icon name="three-dots" />
          </Button>
          {overflowOpen ? (
            <>
              <div
                aria-hidden="true"
                className="overflow-menu-backdrop"
                onMouseDown={() => setOverflowOpen(false)}
              />
              <div className="overflow-menu" role="menu">
                {renderOverflowItem({
                  icon: 'folder2-open',
                  label: t(locale, 'openAnotherProject'),
                  onClick: () => {
                    onOpenProject()
                    setOverflowOpen(false)
                  }
                })}
                {renderOverflowItem({
                  icon: 'archive',
                  label: t(locale, 'manageProjects'),
                  onClick: () => {
                    onManageProjects()
                    setOverflowOpen(false)
                  }
                })}
                {renderOverflowItem({
                  icon: 'share',
                  label: t(locale, 'shareTitle'),
                  onClick: () => {
                    onOpenShare()
                    setOverflowOpen(false)
                  }
                })}
                {renderOverflowItem({
                  icon: 'book',
                  label: t(locale, 'guideCenterTitle'),
                  tutorialId: 'workspace-open-guide',
                  onClick: () => {
                    onOpenGuide()
                    setOverflowOpen(false)
                  }
                })}
                <div className="overflow-menu__divider"></div>
                {renderOverflowItem({
                  icon: 'gear',
                  label: t(locale, 'settings'),
                  tutorialId: 'workspace-open-settings',
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
