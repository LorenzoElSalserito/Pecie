import { describe, expect, it } from 'vitest'

import { outlinerColumns } from './columns'

describe('outlinerColumns', () => {
  it('keeps the Fase 2C column registry complete and declarative', () => {
    expect(Object.keys(outlinerColumns)).toEqual(['title', 'status', 'wordCount', 'tags', 'updatedAt', 'includeInExport'])
    expect(outlinerColumns.title.source).toBe('node.title')
    expect(outlinerColumns.status.source).toBe('document.frontmatter.status')
    expect(outlinerColumns.wordCount.source).toBe('document.derived.wordCount')
    expect(outlinerColumns.tags.sortable).toBe(false)
    expect(outlinerColumns.includeInExport.i18nKey).toBe('includeInExportLabel')
  })
})
