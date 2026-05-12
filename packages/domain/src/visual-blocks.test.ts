import { describe, expect, it } from 'vitest'

import { parseVisualBlocks, renderVisualBlocksInMarkdown, replaceVisualBlocksWithImages } from './visual-blocks'

describe('visual block parser', () => {
  it('extracts supported visual fenced blocks in document order', () => {
    const blocks = parseVisualBlocks(`Intro

\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`

\`\`\`markmap
# Tesi
## Metodo
\`\`\`

\`\`\`chart
{
  "kind": "chart",
  "chartType": "bar",
  "xKey": "capitolo",
  "yKeys": ["parole"],
  "data": [{ "capitolo": "Intro", "parole": 1200 }]
}
\`\`\``)

    expect(blocks.map((block) => block.kind)).toEqual(['mermaid', 'markmap', 'chart'])
    expect(blocks[2]).toMatchObject({
      kind: 'chart',
      chart: {
        chartType: 'bar'
      },
      diagnostics: []
    })
  })

  it('returns a non-blocking diagnostic for invalid chart JSON', () => {
    const blocks = parseVisualBlocks(`\`\`\`chart
{ "kind": "chart", "chartType": "bar"
\`\`\``)

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      kind: 'chart',
      diagnostics: [{ severity: 'error' }]
    })
  })

  it('ignores unrelated fenced code blocks', () => {
    expect(
      parseVisualBlocks(`\`\`\`ts
const value = 1
\`\`\``)
    ).toEqual([])
  })

  it('renders visual blocks as safe inline svg for preview', () => {
    const html = renderVisualBlocksInMarkdown(`\`\`\`mermaid
flowchart TD
  A[Idea] --> B[Bozza]
\`\`\``)

    expect(html).toContain('<svg')
    expect(html).toContain('data-visual-block-kind="mermaid"')
    expect(html).not.toContain('<script')
  })

  it('replaces visual blocks with generated image references for export', () => {
    const assets: Array<{ kind: string; svg: string }> = []
    const markdown = replaceVisualBlocksWithImages(
      `\`\`\`chart
{
  "kind": "chart",
  "chartType": "bar",
  "xKey": "capitolo",
  "yKeys": ["parole"],
  "data": [{ "capitolo": "Intro", "parole": 1200 }]
}
\`\`\``,
      (block, _index, svg) => {
        assets.push({ kind: block.kind, svg })
        return './exports/visual-assets/chart.svg'
      }
    )

    expect(markdown).toBe('![Grafico 1](./exports/visual-assets/chart.svg)')
    expect(assets).toEqual([{ kind: 'chart', svg: expect.stringContaining('<svg') }])
  })
})
