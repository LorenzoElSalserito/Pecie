import { useMemo, useState } from 'react'

import { Button } from '@pecie/ui'

import { t } from '../i18n'
import type { ResearchViewProps } from './types'

const relationOptions = [
  'supports',
  'contradicts',
  'expands',
  'draft-origin',
  'supervision-comment'
] as const

export function ResearchView({
  locale,
  projectPath,
  notes,
  pdfItems,
  graph,
  selectedNoteId,
  selectedPdfId,
  selectedBinderDocumentId,
  onSelectNote,
  onSelectPdf,
  onCreateNote,
  onImportPdf,
  onCreateLink,
  binderDocuments
}: ResearchViewProps): React.JSX.Element {
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftKind, setDraftKind] = useState<'methodological' | 'idea' | 'discarded' | 'supervision'>('idea')
  const [relation, setRelation] = useState<(typeof relationOptions)[number]>('supports')
  const [pdfImportPaths, setPdfImportPaths] = useState('')

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null
  const selectedPdf = pdfItems.find((item) => item.id === selectedPdfId) ?? null

  const backlinks = useMemo(() => {
    if (!graph) {
      return []
    }

    const activeIds = new Set([selectedNoteId, selectedPdfId, selectedBinderDocumentId].filter(Boolean))
    return graph.links.filter((link) => activeIds.has(link.sourceId) || activeIds.has(link.targetId))
  }, [graph, selectedBinderDocumentId, selectedNoteId, selectedPdfId])

  const pdfUrl = selectedPdf ? encodeURI(`file://${projectPath.replace(/\\/g, '/')}/${selectedPdf.relativePath}`) : null

  return (
    <section className="workspace-alt-view research-view">
      <div className="workspace-alt-view__header workspace-alt-view__header--split">
        <div>
          <h2>{t(locale, 'researchTitle')}</h2>
          <p>{t(locale, 'researchBody')}</p>
        </div>
        <div className="workspace-view-kpis">
          <div className="workspace-view-kpi">
            <strong>{notes.length}</strong>
            <span>{t(locale, 'researchNotesMetric')}</span>
          </div>
          <div className="workspace-view-kpi">
            <strong>{pdfItems.length}</strong>
            <span>{t(locale, 'researchPdfMetric')}</span>
          </div>
          <div className="workspace-view-kpi">
            <strong>{graph?.links.length ?? 0}</strong>
            <span>{t(locale, 'researchLinksMetric')}</span>
          </div>
        </div>
      </div>

      <div className="research-view__layout">
        <aside className="research-view__sidebar">
          <section className="context-card context-card--soft">
            <div className="context-card__heading">
              <h3>{t(locale, 'researchCreateNoteTitle')}</h3>
            </div>
            <div className="dialog-form">
              <label className="field">
                <span>{t(locale, 'projectTitle')}</span>
                <input onChange={(event) => setDraftTitle(event.target.value)} value={draftTitle} />
              </label>
              <label className="field">
                <span>{t(locale, 'researchNoteKind')}</span>
                <select onChange={(event) => setDraftKind(event.target.value as typeof draftKind)} value={draftKind}>
                  <option value="idea">{t(locale, 'researchKindIdea')}</option>
                  <option value="methodological">{t(locale, 'researchKindMethodological')}</option>
                  <option value="discarded">{t(locale, 'researchKindDiscarded')}</option>
                  <option value="supervision">{t(locale, 'researchKindSupervision')}</option>
                </select>
              </label>
              <label className="field">
                <span>{t(locale, 'document')}</span>
                <textarea onChange={(event) => setDraftBody(event.target.value)} rows={4} value={draftBody}></textarea>
              </label>
              <div className="context-card__actions">
                <Button
                  disabled={!draftTitle.trim()}
                  onClick={async () => {
                    await onCreateNote({
                      title: draftTitle,
                      kind: draftKind,
                      body: draftBody
                    })
                    setDraftTitle('')
                    setDraftBody('')
                    setDraftKind('idea')
                  }}
                  size="sm"
                  type="button"
                >
                  {t(locale, 'researchCreateNoteAction')}
                </Button>
                <Button onClick={() => void onImportPdf()} size="sm" type="button" variant="secondary">
                  {t(locale, 'researchImportPdfAction')}
                </Button>
              </div>
            </div>
          </section>

          <section className="context-card context-card--soft">
            <div className="context-card__heading">
              <h3>{t(locale, 'researchNotesListTitle')}</h3>
              <span className="count-chip">{notes.length}</span>
            </div>
            <ul className="stack-list stack-list--tight">
              {notes.map((note) => (
                <li key={note.id}>
                  <button
                    className={`link-list-button${note.id === selectedNoteId ? ' link-list-button--active' : ''}`}
                    onClick={() => onSelectNote(note.id)}
                    type="button"
                  >
                    <strong>{note.title}</strong>
                    <span>{t(locale, `researchKindLabel_${note.kind}` as never)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="context-card context-card--soft">
            <div className="context-card__heading">
              <h3>{t(locale, 'researchPdfListTitle')}</h3>
              <span className="count-chip">{pdfItems.length}</span>
            </div>
            <label className="field">
              <span>{t(locale, 'researchImportPdfPaths')}</span>
              <textarea
                onChange={(event) => setPdfImportPaths(event.target.value)}
                placeholder="/path/to/source.pdf"
                rows={3}
                value={pdfImportPaths}
              ></textarea>
            </label>
            <div className="context-card__actions">
              <Button
                disabled={!pdfImportPaths.trim()}
                onClick={async () => {
                  const sourcePaths = pdfImportPaths
                    .split('\n')
                    .map((entry) => entry.trim())
                    .filter(Boolean)
                  await onImportPdf(sourcePaths)
                  setPdfImportPaths('')
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                {t(locale, 'researchImportPdfPathsAction')}
              </Button>
            </div>
            <ul className="stack-list stack-list--tight">
              {pdfItems.map((pdfItem) => (
                <li key={pdfItem.id}>
                  <button
                    className={`link-list-button${pdfItem.id === selectedPdfId ? ' link-list-button--active' : ''}`}
                    onClick={() => onSelectPdf(pdfItem.id)}
                    type="button"
                  >
                    <strong>{pdfItem.displayName}</strong>
                    <span>{pdfItem.originalFilename}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <div className="research-view__detail">
          <section className="context-card context-card--soft">
            <div className="context-card__heading">
              <h3>{t(locale, 'researchLinkComposerTitle')}</h3>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>{t(locale, 'type')}</span>
                <select onChange={(event) => setRelation(event.target.value as typeof relation)} value={relation}>
                  {relationOptions.map((option) => (
                    <option key={option} value={option}>
                      {t(locale, `researchRelation_${option}` as never)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="context-card__actions">
              <Button
                disabled={!selectedNote || !selectedPdf}
                onClick={() =>
                  selectedNote && selectedPdf
                    ? onCreateLink({
                        sourceType: 'note',
                        sourceId: selectedNote.id,
                        targetType: 'pdf',
                        targetId: selectedPdf.id,
                        relation
                      })
                    : Promise.resolve()
                }
                size="sm"
                type="button"
                variant="secondary"
              >
                {t(locale, 'researchLinkNotePdf')}
              </Button>
              <Button
                disabled={!selectedNote || !selectedBinderDocumentId}
                onClick={() =>
                  selectedNote && selectedBinderDocumentId
                    ? onCreateLink({
                        sourceType: 'note',
                        sourceId: selectedNote.id,
                        targetType: 'binder-document',
                        targetId: selectedBinderDocumentId,
                        relation
                      })
                    : Promise.resolve()
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                {t(locale, 'researchLinkNoteDocument')}
              </Button>
            </div>
          </section>

          <div className="research-view__panes">
            <section className="research-view__pane">
              <div className="context-card__heading">
                <h3>{selectedNote?.title ?? t(locale, 'researchEmptyNoteTitle')}</h3>
              </div>
              {selectedNote ? (
                <article className="attachment-preview-text">{selectedNote.body || t(locale, 'researchEmptyNoteBody')}</article>
              ) : (
                <p>{t(locale, 'researchEmptyNoteBody')}</p>
              )}
            </section>

            <section className="research-view__pane">
              <div className="context-card__heading">
                <h3>{selectedPdf?.displayName ?? t(locale, 'researchEmptyPdfTitle')}</h3>
              </div>
              {pdfUrl ? <iframe className="attachment-preview-frame" src={pdfUrl} title={selectedPdf?.displayName ?? 'PDF'} /> : <p>{t(locale, 'researchEmptyPdfBody')}</p>}
            </section>
          </div>

          <section className="context-card context-card--soft">
            <div className="context-card__heading">
              <h3>{t(locale, 'researchBacklinksTitle')}</h3>
              <span className="count-chip">{backlinks.length}</span>
            </div>
            <ul className="stack-list stack-list--tight">
              {backlinks.map((link) => {
                const binderLabel =
                  binderDocuments.find((document) => document.documentId === link.sourceId || document.documentId === link.targetId)?.title ?? null
                const noteLabel =
                  notes.find((note) => note.id === link.sourceId || note.id === link.targetId)?.title ?? null
                const pdfLabel =
                  pdfItems.find((pdfItem) => pdfItem.id === link.sourceId || pdfItem.id === link.targetId)?.displayName ?? null
                return (
                  <li key={link.id}>
                    <strong>{t(locale, `researchRelation_${link.relation}` as never)}</strong>
                    <span>{[noteLabel, pdfLabel, binderLabel].filter(Boolean).join(' · ')}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </section>
  )
}
