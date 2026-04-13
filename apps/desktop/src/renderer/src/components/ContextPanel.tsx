import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@pecie/ui'

import { localeLabel, t } from '../i18n'
import type { ContextPanelProps, TemplateId } from './types'
import { formatFileSize, formatNodeType, formatPercentage, formatSessionDuration, formatTemplateLabel, getWordCount, stringAccentColor } from './utils'

function CollapsibleSection({
  title,
  defaultOpen = true,
  children
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [measuredHeight, setMeasuredHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!bodyRef.current) return
    const resizeObserver = new ResizeObserver(() => {
      if (bodyRef.current) {
        setMeasuredHeight(bodyRef.current.scrollHeight)
      }
    })
    resizeObserver.observe(bodyRef.current)
    setMeasuredHeight(bodyRef.current.scrollHeight)
    return () => resizeObserver.disconnect()
  }, [children])

  return (
    <section className="context-section">
      <button className="context-section__toggle" onClick={() => setOpen((v) => !v)} type="button" aria-expanded={open}>
        <h3>{title}</h3>
        <i aria-hidden="true" className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
      </button>
      <div
        ref={bodyRef}
        className={`context-section__body${open ? '' : ' context-section__body--collapsed'}`}
        style={{ maxHeight: open ? (measuredHeight ?? 'none') : 0 }}
      >
        {children}
      </div>
    </section>
  )
}

export function ContextPanel({
  locale,
  project,
  manifest,
  selectedNode,
  draftBody,
  writingHubNodes,
  attachments,
  maxAttachmentSizeBytes,
  attachmentsLoading,
  attachmentsBusy,
  timeline,
  timelineLoading,
  onOpenTimelineWorkspace,
  onOpenWritingHubNode,
  onImportAttachments,
  onOpenAttachmentsDirectory,
  onOpenAttachment,
  onOpenPreviousVersionDiff,
  collapsed,
  onToggleCollapsed
}: ContextPanelProps): React.JSX.Element {
  const contributorMap = useMemo(() => new Map((project.project.authors ?? []).map((author) => [author.id, author])), [project.project.authors])
  const authorshipStats = [...(project.project.authorshipStats ?? [])]
    .map((stat) => ({ ...stat, author: contributorMap.get(stat.authorId) }))
    .filter((entry) => entry.author)
    .sort((left, right) => right.wordCount - left.wordCount)

  const totalWords = getWordCount(draftBody)
  const docCount = project.binder.nodes.filter((node) => node.type === 'document').length
  const supportCount = writingHubNodes.length + attachments.length
  const [sessionStartMs] = useState(() => Date.now())
  const [sessionStartWords] = useState(() => totalWords)
  const [sessionDuration, setSessionDuration] = useState('')
  const [touchedDocumentIds, setTouchedDocumentIds] = useState<string[]>([])
  const latestTimelineEvent = timeline?.snapshot.events[0] ?? null
  const milestoneCount = timeline?.snapshot.events.filter((event) => event.kind === 'milestone').length ?? 0
  const inconsistentTimelineEvents = timeline?.snapshot.events.filter((event) => event.integrity !== 'ok').length ?? 0

  useEffect(() => {
    setSessionDuration(formatSessionDuration(sessionStartMs))
    const interval = window.setInterval(() => {
      setSessionDuration(formatSessionDuration(sessionStartMs))
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [sessionStartMs])

  useEffect(() => {
    if (selectedNode?.type !== 'document' || !selectedNode.documentId) {
      return
    }

    setTouchedDocumentIds((currentIds) =>
      currentIds.includes(selectedNode.documentId as string) ? currentIds : [...currentIds, selectedNode.documentId as string]
    )
  }, [selectedNode])

  return (
    <aside aria-labelledby="context-panel-title" className={`workspace-context${collapsed ? ' workspace-context--collapsed' : ''}`}>
      <div className="panel-chrome">
        <div>
          <p className="eyebrow">{t(locale, 'projectStatus')}</p>
          {!collapsed ? <h2 id="context-panel-title">{t(locale, 'projectStatus')}</h2> : null}
        </div>
        <button aria-label={collapsed ? t(locale, 'expandSidebar') : t(locale, 'collapseSidebar')} className="panel-toggle" onClick={onToggleCollapsed} type="button">
          <i aria-hidden="true" className={`bi ${collapsed ? 'bi-chevron-double-left' : 'bi-chevron-double-right'}`}></i>
        </button>
      </div>

      {collapsed ? null : (
        <>
          <div className="context-session-card">
            <span className="context-session-card__title">
              <i aria-hidden="true" className="bi bi-clock"></i>
              {t(locale, 'sessionActiveTitle')}
            </span>
            <div className="context-session-card__stats">
              <span>{sessionDuration || '0m'}</span>
              <span className="editor-statusbar__divider" aria-hidden="true"></span>
              <span className={totalWords - sessionStartWords >= 0 ? 'editor-footer__session--positive' : 'editor-footer__session--negative'}>
                {totalWords - sessionStartWords >= 0 ? '+' : ''}{totalWords - sessionStartWords} {t(locale, 'wordCount').toLowerCase()}
              </span>
              <span className="editor-statusbar__divider" aria-hidden="true"></span>
              <span>{t(locale, 'sessionTouchedDocuments', { count: String(touchedDocumentIds.length) })}</span>
            </div>
          </div>

          <section className="context-pulse-board">
            <div className="context-hero-metric">
              <span className="context-hero-metric__number">{totalWords.toLocaleString()}</span>
              <span className="context-hero-metric__label">{t(locale, 'wordCount').toLowerCase()}</span>
            </div>

            <div className="context-metric-row context-metric-row--rich">
              <div className="context-metric-pill">
                <strong>{docCount}</strong>
                <span>{t(locale, 'documents')}</span>
              </div>
              <div className="context-metric-pill">
                <strong>{project.project.authors?.length ?? 1}</strong>
                <span>{t(locale, 'contributors')}</span>
              </div>
              <div className="context-metric-pill">
                <strong>{supportCount}</strong>
                <span>{t(locale, 'supportItems')}</span>
              </div>
            </div>

            <div className="context-status-strip">
              <span className="status-pill">{formatTemplateLabel(locale, project.project.documentKind as TemplateId)}</span>
              <span className="status-pill">{localeLabel(manifest.language as typeof locale)}</span>
              <span className="status-pill">{manifest.defaultExportProfile}</span>
            </div>

            {authorshipStats.length > 0 ? (
              <div className="context-card context-card--flush">
                <div className="context-card__heading">
                  <h3>{t(locale, 'authorContribution')}</h3>
                  <span className="count-chip">{authorshipStats.length}</span>
                </div>
                <div className="contribution-bar" aria-label={t(locale, 'authorContribution')}>
                  {authorshipStats.map((entry) => (
                    <div
                      className="contribution-bar__segment"
                      key={entry.authorId}
                      style={{ flex: entry.percentage, background: stringAccentColor(entry.author?.name ?? entry.authorId) }}
                      title={`${entry.author?.name}: ${formatPercentage(entry.percentage)}`}
                    ></div>
                  ))}
                </div>
                <ul className="contribution-legend">
                  {authorshipStats.map((entry) => (
                    <li key={entry.authorId}>
                      <span className="contribution-legend__dot" style={{ background: stringAccentColor(entry.author?.name ?? entry.authorId) }}></span>
                      <strong>{entry.author?.name}</strong>
                      <span>{formatPercentage(entry.percentage)} · {entry.wordCount} {t(locale, 'wordCount').toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {/* ── Project Info (collapsible) ── */}
          <CollapsibleSection title={t(locale, 'projectInfo')} defaultOpen={false}>
            <dl className="meta-list">
              <div><dt>{t(locale, 'projectTitle')}</dt><dd>{project.project.title}</dd></div>
              <div><dt>{t(locale, 'template')}</dt><dd>{formatTemplateLabel(locale, project.project.documentKind as TemplateId)}</dd></div>
              <div><dt>{t(locale, 'projectLanguage')}</dt><dd>{localeLabel(manifest.language as typeof locale)}</dd></div>
              <div><dt>{t(locale, 'primaryAuthor')}</dt><dd>{project.project.author.name}</dd></div>
              <div><dt>{t(locale, 'format')}</dt><dd>{manifest.defaultExportProfile}</dd></div>
              <div><dt>{t(locale, 'privacy')}</dt><dd>{manifest.privacyMode}</dd></div>
            </dl>
          </CollapsibleSection>

          {/* ── Support Library (collapsible, open by default) ── */}
          <CollapsibleSection title={t(locale, 'supportLibraryTitle')}>
            <p className="muted-copy">{t(locale, 'supportLibraryBody')}</p>
            <div className="context-card__actions">
              <Button disabled={attachmentsBusy} onClick={onImportAttachments} size="sm" type="button" variant="secondary">{t(locale, 'importAttachment')}</Button>
              <Button onClick={onOpenAttachmentsDirectory} size="sm" type="button" variant="ghost">{t(locale, 'openAttachmentsFolder')}</Button>
            </div>
            <div className="writing-hub-meta">
              <span>{t(locale, 'writingHubLimit', { size: formatFileSize(maxAttachmentSizeBytes, locale) })}</span>
              <strong>{supportCount}</strong>
            </div>
            <div className="support-library-grid">
              <section className="context-card context-card--soft support-library-card">
                <div className="context-card__heading">
                  <h4>{t(locale, 'writingHubNotesTitle')}</h4>
                  <span className="count-chip">{writingHubNodes.length}</span>
                </div>
                <p className="muted-copy">{t(locale, 'writingHubNotesBody')}</p>
                {writingHubNodes.length > 0 ? (
                  <ul className="stack-list stack-list--tight">
                    {writingHubNodes.map((node) => (
                      <li key={node.id}>
                        <button className="link-list-button" onClick={() => onOpenWritingHubNode(node.id)} type="button">
                          <strong>{node.title}</strong>
                          <span>{node.description || node.path || t(locale, 'writingHubNotesBody')}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p>{t(locale, 'writingHubEmptyNotes')}</p>}
              </section>
              <section className="context-card context-card--soft support-library-card">
                <div className="context-card__heading">
                  <h4>{t(locale, 'attachmentsSectionTitle')}</h4>
                  <span className="count-chip">{attachments.length}</span>
                </div>
                <p className="muted-copy">{t(locale, 'writingHubUploadsBody')}</p>
                {attachmentsLoading ? (
                  <p>{t(locale, 'loadingAttachments')}</p>
                ) : attachments.length > 0 ? (
                  <ul className="stack-list stack-list--tight">
                    {attachments.map((attachment) => (
                      <li key={attachment.absolutePath}>
                        <div className="attachment-row">
                          <div><strong>{attachment.name}</strong><span>{formatFileSize(attachment.sizeBytes, locale)}</span></div>
                          <Button onClick={() => onOpenAttachment(attachment.absolutePath)} size="sm" type="button" variant="ghost">{t(locale, 'openAttachment')}</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p>{t(locale, 'writingHubEmptyUploads')}</p>}
              </section>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title={t(locale, 'timelineTitle')} defaultOpen={false}>
            <div className="context-card context-card--soft">
              <div className="context-card__heading">
                <h4>{t(locale, 'timelineTitle')}</h4>
                <span className="count-chip">{timeline?.snapshot.events.length ?? 0}</span>
              </div>
              <p className="muted-copy">{t(locale, 'timelineBody')}</p>
              <div className="context-metric-row context-metric-row--rich">
                <div className="context-metric-pill">
                  <strong>{milestoneCount}</strong>
                  <span>{t(locale, 'timelineCreateMilestone')}</span>
                </div>
                <div className="context-metric-pill">
                  <strong>{inconsistentTimelineEvents}</strong>
                  <span>{t(locale, 'timelineRepair')}</span>
                </div>
              </div>
              {latestTimelineEvent ? (
                <div className="timeline-compact-event">
                  <span className="status-pill">{latestTimelineEvent.kind}</span>
                  <strong>{latestTimelineEvent.label}</strong>
                  <span>{new Date(latestTimelineEvent.createdAt).toLocaleString(locale)}</span>
                </div>
              ) : null}
              <div className="context-card__actions">
                <Button
                  onClick={onOpenTimelineWorkspace}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {t(locale, 'timelineTitle')}
                </Button>
                <Button
                  disabled={!selectedNode || selectedNode.type !== 'document'}
                  onClick={() => void onOpenPreviousVersionDiff()}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {t(locale, 'comparePreviousVersion')}
                </Button>
              </div>
              {timelineLoading ? <p>{t(locale, 'timelineLoading')}</p> : null}
            </div>
          </CollapsibleSection>

          {/* ── Current Selection (compact) ── */}
          {selectedNode ? (
            <div className="context-selection-bar">
              <i aria-hidden="true" className={`bi ${selectedNode.type === 'folder' ? 'bi-folder2-open' : 'bi-file-earmark-text'}`}></i>
              <div>
                <strong>{selectedNode.title}</strong>
                <small>{formatNodeType(locale, selectedNode.type)}</small>
              </div>
            </div>
          ) : null}
        </>
      )}
    </aside>
  )
}
