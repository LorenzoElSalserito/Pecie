import type { ChartBlock, VisualBlockCapabilityId, VisualBlockKind } from './generated/types.generated'

export const visualBlockCapabilities = {
  mermaidDiagram: {
    blockKind: 'mermaid',
    library: 'mermaid',
    renderer: 'MermaidRenderer',
    insertCommand: 'editor.visual.insertMermaid',
    exportStrategy: 'svg-first',
    i18nLabel: 'visualBlocks.mermaid.label'
  },
  markmapMindmap: {
    blockKind: 'markmap',
    library: 'markmap-lib',
    renderer: 'MarkmapRenderer',
    insertCommand: 'editor.visual.insertMarkmap',
    exportStrategy: 'svg-first',
    i18nLabel: 'visualBlocks.markmap.label'
  },
  rechartsStats: {
    blockKind: 'chart',
    library: 'recharts',
    renderer: 'ChartRenderer',
    insertCommand: 'editor.visual.insertChart',
    exportStrategy: 'svg-or-png-snapshot',
    i18nLabel: 'visualBlocks.chart.label'
  }
} as const satisfies Record<
  VisualBlockCapabilityId,
  {
    blockKind: VisualBlockKind
    library: string
    renderer: string
    insertCommand: string
    exportStrategy: 'svg-first' | 'svg-or-png-snapshot'
    i18nLabel: string
  }
>

export const visualBlockInsertCommands = {
  mermaidDiagram: {
    capability: 'mermaidDiagram',
    markdownFence: 'mermaid',
    templateFactory: () => ['flowchart TD', '  A[Idea] --> B[Bozza]', '  B --> C[Revisione]'].join('\n')
  },
  markmapMindmap: {
    capability: 'markmapMindmap',
    markdownFence: 'markmap',
    templateFactory: () => ['# Mappa mentale', '## Nodo principale', '### Dettaglio'].join('\n')
  },
  rechartsStats: {
    capability: 'rechartsStats',
    markdownFence: 'chart',
    templateFactory: () =>
      JSON.stringify(
        {
          kind: 'chart',
          chartType: 'bar',
          title: 'Esempio statistiche',
          xKey: 'label',
          yKeys: ['value'],
          data: [
            { label: 'A', value: 10 },
            { label: 'B', value: 20 }
          ]
        } satisfies ChartBlock,
        null,
        2
      )
  }
} as const

export type VisualBlockInsertCommandId = keyof typeof visualBlockInsertCommands
