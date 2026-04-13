import { t } from '../i18n'
import type { ScriveningsViewProps } from './types'

export function ScriveningsView({ locale, title, documents, selectedNodeId, onSelectNode }: ScriveningsViewProps): React.JSX.Element {
  return (
    <section className="workspace-alt-view">
      <div className="workspace-alt-view__header">
        <h2>{t(locale, 'scriveningsTitle')}</h2>
        <p>{title}</p>
      </div>
      <div className="scrivenings-stack">
        {documents.map((document) => (
          <article className={`scrivenings-sheet${document.nodeId === selectedNodeId ? ' scrivenings-sheet--selected' : ''}`} key={document.documentId}>
            <header className="scrivenings-sheet__header">
              <button onClick={() => onSelectNode(document.nodeId)} type="button">
                {document.title}
              </button>
              <span>{document.wordCount.toLocaleString(locale)} {t(locale, 'wordCount').toLowerCase()}</span>
            </header>
            <pre className="scrivenings-sheet__content">{document.body}</pre>
          </article>
        ))}
      </div>
    </section>
  )
}
