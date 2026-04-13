import { useState } from 'react'

import { Button, timelineEventKinds } from '@pecie/ui'

import { t } from '../i18n'
import type { TimelineViewProps } from './types'

export function TimelineView({
  locale,
  selectedNode,
  timeline,
  timelineLoading,
  onOpenPreviousVersionDiff,
  onOpenTimelineDiff,
  onOpenRestorePreview,
  onCreateMilestone,
  onRepairTimeline
}: TimelineViewProps): React.JSX.Element {
  const [timelineBusy, setTimelineBusy] = useState(false)
  const [milestoneLabel, setMilestoneLabel] = useState('')
  const [milestoneNote, setMilestoneNote] = useState('')

  const latestEvent = timeline?.snapshot.events[0] ?? null
  const milestoneCount = timeline?.snapshot.events.filter((event) => event.kind === 'milestone').length ?? 0
  const inconsistentEventsCount = timeline?.snapshot.events.filter((event) => event.integrity !== 'ok').length ?? 0

  return (
    <section className="workspace-alt-view workspace-alt-view--timeline">
      <div className="workspace-alt-view__header workspace-alt-view__header--split">
        <div>
          <h2>{t(locale, 'timelineTitle')}</h2>
          <p>{t(locale, 'timelineBody')}</p>
        </div>
        <div className="workspace-view-kpis" aria-label={t(locale, 'timelineTitle')}>
          <div className="workspace-view-kpi">
            <strong>{timeline?.snapshot.events.length ?? 0}</strong>
            <span>{t(locale, 'timelineTitle')}</span>
          </div>
          <div className="workspace-view-kpi">
            <strong>{milestoneCount}</strong>
            <span>{t(locale, 'timelineCreateMilestone')}</span>
          </div>
          <div className="workspace-view-kpi">
            <strong>{inconsistentEventsCount}</strong>
            <span>{t(locale, 'timelineRepair')}</span>
          </div>
        </div>
      </div>

      <div className="timeline-view-shell">
        <aside className="timeline-view-sidebar">
          <section className="context-card context-card--soft timeline-view-card">
            <div className="context-card__heading">
              <h3>{t(locale, 'timelineTitle')}</h3>
              <span className="count-chip">{timeline?.groups.length ?? 0}</span>
            </div>
            <p className="muted-copy">{t(locale, 'timelineBody')}</p>
            <div className="context-card__actions">
              <Button
                disabled={!selectedNode || selectedNode.type !== 'document' || timelineBusy}
                onClick={() => void onOpenPreviousVersionDiff()}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t(locale, 'comparePreviousVersion')}
              </Button>
              <Button
                disabled={timelineBusy}
                onClick={async () => {
                  setTimelineBusy(true)
                  try {
                    await onRepairTimeline()
                  } finally {
                    setTimelineBusy(false)
                  }
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t(locale, 'timelineRepair')}
              </Button>
            </div>
            {latestEvent ? (
              <div className="timeline-view-latest">
                <span className="status-pill">{timelineEventKinds[latestEvent.kind].label}</span>
                <strong>{latestEvent.label}</strong>
                <span>
                  {new Date(latestEvent.createdAt).toLocaleString(locale)}
                </span>
              </div>
            ) : null}
          </section>

          <section className="context-card context-card--soft timeline-view-card">
            <div className="context-card__heading">
              <h3>{t(locale, 'timelineCreateMilestone')}</h3>
            </div>
            <div className="timeline-milestone-form">
              <label className="field">
                <span>{t(locale, 'timelineMilestoneLabel')}</span>
                <input value={milestoneLabel} onChange={(event) => setMilestoneLabel(event.target.value)} type="text" />
              </label>
              <label className="field">
                <span>{t(locale, 'timelineMilestoneNote')}</span>
                <textarea rows={4} value={milestoneNote} onChange={(event) => setMilestoneNote(event.target.value)} />
              </label>
              <Button
                disabled={timelineBusy || !milestoneLabel.trim()}
                onClick={async () => {
                  setTimelineBusy(true)
                  try {
                    await onCreateMilestone({
                      label: milestoneLabel.trim(),
                      noteMarkdown: milestoneNote.trim() || undefined
                    })
                    setMilestoneLabel('')
                    setMilestoneNote('')
                  } finally {
                    setTimelineBusy(false)
                  }
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                {t(locale, 'timelineCreateMilestone')}
              </Button>
            </div>
          </section>
        </aside>

        <div className="timeline-view-main">
          {timelineLoading ? (
            <p>{t(locale, 'timelineLoading')}</p>
          ) : timeline && timeline.groups.length > 0 ? (
            <div className="timeline-groups" role="list">
              {timeline.groups.map((group) => (
                <section className="timeline-group" key={group.groupId}>
                  <header className="timeline-group__header">
                    <strong>{group.label}</strong>
                    <span>{group.sessionLabel}</span>
                  </header>
                  <ul className="timeline-list">
                    {group.events.map((event) => {
                      const presentation = timelineEventKinds[event.kind]
                      return (
                        <li className={`timeline-item${event.integrity !== 'ok' ? ' timeline-item--warning' : ''}`} key={event.timelineEventId}>
                          <div className="timeline-item__icon">
                            <i aria-hidden="true" className={`bi ${presentation.icon}`}></i>
                          </div>
                          <div className="timeline-item__body">
                            <div className="timeline-item__meta">
                              <strong>{event.label}</strong>
                              <span>{presentation.label}</span>
                            </div>
                            <div className="timeline-item__submeta">
                              <span>{new Date(event.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
                              <span>{event.authorDisplayName}</span>
                              <span>{event.commitHashShort}</span>
                            </div>
                            {event.noteMarkdown ? <p className="muted-copy">{event.noteMarkdown}</p> : null}
                            {event.touchedPaths.length > 0 ? (
                              <div className="timeline-item__paths">
                                {event.touchedPaths.slice(0, 6).map((relativePath) => (
                                  <span className="status-pill" key={relativePath}>{relativePath}</span>
                                ))}
                              </div>
                            ) : null}
                            {selectedNode?.type === 'document' && event.kind !== 'bootstrap' ? (
                              <div className="timeline-item__actions">
                                <Button
                                  onClick={() =>
                                    void onOpenTimelineDiff(
                                      event.timelineEventId,
                                      event.kind as 'checkpoint' | 'milestone' | 'restore'
                                    )
                                  }
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  {t(locale, 'compareThisVersion')}
                                </Button>
                                <Button
                                  disabled={event.integrity !== 'ok'}
                                  onClick={() => void onOpenRestorePreview(event.timelineEventId)}
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  {t(locale, 'restoreThisVersion')}
                                </Button>
                              </div>
                            ) : null}
                            {event.integrity !== 'ok' ? (
                              <p className="timeline-item__warning">{t(locale, 'timelineNeedsRepair')}</p>
                            ) : null}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p>{t(locale, 'timelineEmpty')}</p>
          )}
        </div>
      </div>
    </section>
  )
}
