import { describe, expect, it } from 'vitest'

import { assertWriteTarget } from './export-write-guard'

describe('assertWriteTarget', () => {
  it('allows final exports only under exports/out', () => {
    expect(() => assertWriteTarget('exports/out/book.pdf', 'final-export')).not.toThrow()
    expect(() => assertWriteTarget('exports\\out\\book.pdf', 'final-export')).not.toThrow()
  })

  it('allows export preview artifacts only under cache/preview/export-step', () => {
    expect(() => assertWriteTarget('cache/preview/export-step/thesis/page-1.html', 'export-preview')).not.toThrow()
  })

  it('rejects writes outside the allowed prefixes', () => {
    expect(() => assertWriteTarget('cache/preview/fast/preview.json', 'export-preview')).toThrow(/export-write-guard/)
    expect(() => assertWriteTarget('Desktop/book.pdf', 'final-export')).toThrow(/export-write-guard/)
  })
})
