import { t } from '../i18n'
import type { OutlinerViewProps } from './types'

export function OutlinerView({ locale, documents, selectedNodeId, onSelectNode }: OutlinerViewProps): React.JSX.Element {
  return (
    <section className="workspace-alt-view">
      <div className="workspace-alt-view__header">
        <h2>{t(locale, 'outlinerTitle')}</h2>
        <p>{t(locale, 'outlinerBody')}</p>
      </div>
      <div className="outliner-table-shell">
        <table className="outliner-table">
          <thead>
            <tr>
              <th>{t(locale, 'projectTitle')}</th>
              <th>{t(locale, 'statusLabel')}</th>
              <th>{t(locale, 'wordCount')}</th>
              <th>{t(locale, 'tagsLabel')}</th>
              <th>{t(locale, 'updatedAtLabel')}</th>
              <th>{t(locale, 'includeInExportLabel')}</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr
                className={document.nodeId === selectedNodeId ? 'outliner-table__row--selected' : ''}
                key={document.documentId}
                onClick={() => onSelectNode(document.nodeId)}
              >
                <td>
                  <strong>{document.title}</strong>
                  <span>{document.path}</span>
                </td>
                <td>{document.status}</td>
                <td>{document.wordCount.toLocaleString(locale)}</td>
                <td>{document.tags.join(', ') || '-'}</td>
                <td>{document.updatedAt ? new Date(document.updatedAt).toLocaleString(locale) : '-'}</td>
                <td>{document.includeInExport ? t(locale, 'yesLabel') : t(locale, 'noLabel')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
