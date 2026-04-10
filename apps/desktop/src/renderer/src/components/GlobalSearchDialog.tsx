import { useEffect, useMemo, useRef, useState } from 'react'

import type { SearchDocumentsResponse } from '@pecie/schemas'
import { Button, Dialog } from '@pecie/ui'

import { t } from '../i18n'
import type { GlobalSearchDialogProps } from './types'

function stripMarks(value: string): string {
  return value.replace(/<mark>/g, '').replace(/<\/mark>/g, '')
}

function groupCount(results: SearchDocumentsResponse['results']): number {
  return results.nodes.length + results.content.length + results.attachments.length
}

export function GlobalSearchDialog({
  open,
  locale,
  projectPath,
  onClose,
  onOpenDocument,
  onOpenAttachment
}: GlobalSearchDialogProps): React.JSX.Element | null {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchDocumentsResponse['results']>({
    nodes: [],
    content: [],
    attachments: []
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults({ nodes: [], content: [], attachments: [] })
      setBusy(false)
      return
    }

    if (!query.trim()) {
      setResults({ nodes: [], content: [], attachments: [] })
      return
    }

    let active = true
    const timer = window.setTimeout(() => {
      setBusy(true)
      void window.pecie
        .invokeSafe('search:query', {
          projectPath,
          query,
          limit: 8
        })
        .then((response) => {
          if (active) {
            setResults(response.results)
          }
        })
        .catch(() => {
          if (active) {
            setResults({ nodes: [], content: [], attachments: [] })
          }
        })
        .finally(() => {
          if (active) {
            setBusy(false)
          }
        })
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [open, projectPath, query])

  const totalResults = useMemo(() => groupCount(results), [results])

  if (!open) {
    return null
  }

  return (
    <Dialog open={open} onClose={onClose} size="wide" icon="bi-search" title={t(locale, 'globalSearchTitle')}>
      <div className="dialog-form">
        <label className="field">
          <span>{t(locale, 'globalSearchField')}</span>
          <input
            ref={inputRef}
            placeholder={t(locale, 'globalSearchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="global-search-summary" role="status" aria-live="polite">
          <span>{busy ? t(locale, 'searching') : t(locale, 'searchResultsCount', { count: String(totalResults) })}</span>
          <span>{t(locale, 'globalSearchScope')}</span>
        </div>

        <div className="global-search-layout">
          <section className="context-card context-card--soft">
            <div className="context-card__heading">
              <h3>{t(locale, 'searchGroupNodes')}</h3>
              <span className="count-chip">{results.nodes.length}</span>
            </div>
            {results.nodes.length > 0 ? (
              <div className="global-search-list">
                {results.nodes.map((result) => (
                  <button
                    className="global-search-item"
                    key={`node-${result.nodeId}`}
                    onClick={() => onOpenDocument(result.documentId)}
                    type="button"
                  >
                    <strong>{result.title}</strong>
                    <small>{result.path}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted-copy">{t(locale, 'noSearchResults')}</p>
            )}
          </section>

          <section className="context-card context-card--soft">
            <div className="context-card__heading">
              <h3>{t(locale, 'searchGroupContent')}</h3>
              <span className="count-chip">{results.content.length}</span>
            </div>
            {results.content.length > 0 ? (
              <div className="global-search-list">
                {results.content.map((result) => (
                  <button
                    className="global-search-item"
                    key={`content-${result.nodeId}-${result.snippet}`}
                    onClick={() => onOpenDocument(result.documentId)}
                    type="button"
                  >
                    <strong>{result.title}</strong>
                    <small>{result.path}</small>
                    <span dangerouslySetInnerHTML={{ __html: result.snippet }}></span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted-copy">{t(locale, 'noSearchResults')}</p>
            )}
          </section>

          <section className="context-card context-card--soft">
            <div className="context-card__heading">
              <h3>{t(locale, 'searchGroupAttachments')}</h3>
              <span className="count-chip">{results.attachments.length}</span>
            </div>
            {results.attachments.length > 0 ? (
              <div className="global-search-list">
                {results.attachments.map((result) => (
                  <button
                    className="global-search-item"
                    key={`attachment-${result.relativePath}`}
                    onClick={() => onOpenAttachment(result.relativePath)}
                    type="button"
                  >
                    <strong>{result.name}</strong>
                    <small>{result.relativePath}</small>
                    <span dangerouslySetInnerHTML={{ __html: result.snippet || stripMarks(result.name) }}></span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted-copy">{t(locale, 'noSearchResults')}</p>
            )}
          </section>
        </div>

        <div className="dialog-actions dialog-actions--end">
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            {t(locale, 'close')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
