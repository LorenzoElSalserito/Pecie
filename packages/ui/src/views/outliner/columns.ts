export const outlinerColumns = {
  title: {
    source: 'node.title',
    i18nKey: 'projectTitle',
    sortable: true,
    width: 'minmax(220px, 1fr)',
    align: 'start'
  },
  status: {
    source: 'document.frontmatter.status',
    i18nKey: 'statusLabel',
    sortable: true,
    width: '120px',
    align: 'start'
  },
  wordCount: {
    source: 'document.derived.wordCount',
    i18nKey: 'wordCount',
    sortable: true,
    width: '100px',
    align: 'end'
  },
  tags: {
    source: 'document.frontmatter.tags',
    i18nKey: 'tagsLabel',
    sortable: false,
    width: '180px',
    align: 'start'
  },
  updatedAt: {
    source: 'document.updatedAt',
    i18nKey: 'updatedAtLabel',
    sortable: true,
    width: '160px',
    align: 'start'
  },
  includeInExport: {
    source: 'document.frontmatter.includeInExport',
    i18nKey: 'includeInExportLabel',
    sortable: true,
    width: '120px',
    align: 'start'
  }
} as const

export type OutlinerColumnKey = keyof typeof outlinerColumns
