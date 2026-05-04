import { useMemo, useState } from 'react'

import { outlinerColumns, type OutlinerColumnKey } from '@pecie/ui'

import { t } from '../i18n'
import type { OutlinerViewProps, WorkspaceDocumentSummary } from './types'

type SortDirection = 'asc' | 'desc'
type SortState = {
  column: OutlinerColumnKey
  direction: SortDirection
}

const outlinerColumnKeys = Object.keys(outlinerColumns) as OutlinerColumnKey[]

function compareValues(left: string | number | boolean, right: string | number | boolean): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right)
  }
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
}

function getOutlinerSortValue(document: WorkspaceDocumentSummary, column: OutlinerColumnKey): string | number | boolean {
  switch (column) {
    case 'title':
      return document.title
    case 'status':
      return document.status
    case 'wordCount':
      return document.wordCount
    case 'tags':
      return document.tags.join(', ')
    case 'updatedAt':
      return document.updatedAt
    case 'includeInExport':
      return document.includeInExport
  }
}

function renderOutlinerCell(
  locale: OutlinerViewProps['locale'],
  document: WorkspaceDocumentSummary,
  column: OutlinerColumnKey
): React.ReactNode {
  switch (column) {
    case 'title':
      return (
        <>
          <strong>{document.title}</strong>
          <span>{document.path}</span>
        </>
      )
    case 'status':
      return document.status
    case 'wordCount':
      return document.wordCount.toLocaleString(locale)
    case 'tags':
      return document.tags.join(', ') || '-'
    case 'updatedAt':
      return document.updatedAt ? new Date(document.updatedAt).toLocaleString(locale) : '-'
    case 'includeInExport':
      return document.includeInExport ? t(locale, 'yesLabel') : t(locale, 'noLabel')
  }
}

export function OutlinerView({ locale, documents, selectedNodeId, onSelectNode }: OutlinerViewProps): React.JSX.Element {
  const [sortState, setSortState] = useState<SortState>({ column: 'title', direction: 'asc' })
  const sortedDocuments = useMemo(() => {
    const directionMultiplier = sortState.direction === 'asc' ? 1 : -1
    return [...documents].sort((left, right) => {
      const result = compareValues(getOutlinerSortValue(left, sortState.column), getOutlinerSortValue(right, sortState.column))
      return result * directionMultiplier
    })
  }, [documents, sortState])

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
              {outlinerColumnKeys.map((columnKey) => {
                const column = outlinerColumns[columnKey]
                const isActiveSort = sortState.column === columnKey
                return (
                  <th
                    aria-sort={isActiveSort ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`outliner-table__cell--${column.align}`}
                    key={columnKey}
                    style={{ width: column.width }}
                  >
                    {column.sortable ? (
                      <button
                        className="outliner-table__sort"
                        onClick={() =>
                          setSortState((current) => ({
                            column: columnKey,
                            direction: current.column === columnKey && current.direction === 'asc' ? 'desc' : 'asc'
                          }))
                        }
                        type="button"
                      >
                        <span>{t(locale, column.i18nKey)}</span>
                        <i
                          aria-hidden="true"
                          className={`bi ${isActiveSort && sortState.direction === 'desc' ? 'bi-sort-down' : 'bi-sort-up'}`}
                        ></i>
                      </button>
                    ) : (
                      t(locale, column.i18nKey)
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedDocuments.map((document) => (
              <tr
                className={document.nodeId === selectedNodeId ? 'outliner-table__row--selected' : ''}
                key={document.documentId}
                onClick={() => onSelectNode(document.nodeId)}
              >
                {outlinerColumnKeys.map((columnKey) => {
                  const column = outlinerColumns[columnKey]
                  return (
                    <td className={`outliner-table__cell--${column.align}`} key={columnKey}>
                      {renderOutlinerCell(locale, document, columnKey)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
