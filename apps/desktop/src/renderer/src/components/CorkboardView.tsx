import { t } from '../i18n'
import type { CorkboardViewProps } from './types'

export function CorkboardView({ locale, documents, selectedNodeId, onSelectNode }: CorkboardViewProps): React.JSX.Element {
  return (
    <section className="workspace-alt-view">
      <div className="workspace-alt-view__header">
        <h2>{t(locale, 'corkboardTitle')}</h2>
        <p>{t(locale, 'corkboardBody')}</p>
      </div>
      <div className="corkboard-grid">
        {documents.map((document) => (
          <button
            className={`corkboard-card${document.nodeId === selectedNodeId ? ' corkboard-card--selected' : ''}`}
            key={document.documentId}
            onClick={() => onSelectNode(document.nodeId)}
            type="button"
          >
            <span className="status-pill">{document.status}</span>
            <strong>{document.title}</strong>
            <p>{document.summary || t(locale, 'corkboardEmptySummary')}</p>
            <footer>
              <span>{document.wordCount.toLocaleString(locale)} {t(locale, 'wordCount').toLowerCase()}</span>
              <span>{document.tags.join(', ') || t(locale, 'tagsEmpty')}</span>
            </footer>
          </button>
        ))}
      </div>
    </section>
  )
}
