import type { ChartBlock, VisualBlockKind, VisualBlockViewModel } from '@pecie/schemas'
import { SchemaValidationError, validateChartBlock } from '@pecie/schemas'

const visualFenceKinds = new Set<VisualBlockKind>(['mermaid', 'markmap', 'chart'])
const fencedBlockPattern = /```([A-Za-z0-9_-]+)[ \t]*\r?\n([\s\S]*?)\r?\n```/g

export function parseVisualBlocks(markdown: string): VisualBlockViewModel[] {
  const blocks: VisualBlockViewModel[] = []

  for (const match of markdown.matchAll(fencedBlockPattern)) {
    const fence = match[1]?.trim().toLowerCase()
    const source = match[2] ?? ''

    if (!isVisualBlockKind(fence)) {
      continue
    }

    if (fence === 'chart') {
      blocks.push(parseChartBlock(source))
      continue
    }

    blocks.push({
      kind: fence,
      source,
      diagnostics: source.trim().length === 0 ? [{ severity: 'error', message: 'Visual block source is empty' }] : []
    })
  }

  return blocks
}

export function renderVisualBlockToSvg(block: VisualBlockViewModel): string {
  switch (block.kind) {
    case 'chart':
      return renderChartSvg(block.chart)
    case 'markmap':
      return renderMarkmapSvg(block.source)
    case 'mermaid':
      return renderDiagramSvg(block.source)
  }
}

export function visualBlockToHtml(block: VisualBlockViewModel, index: number): string {
  const svg = renderVisualBlockToSvg(block)
  const label = visualBlockLabel(block.kind, index)
  return `<figure class="visual-block visual-block--${block.kind}" data-visual-block-kind="${block.kind}">
${svg}
<figcaption>${escapeHtml(label)}</figcaption>
</figure>`
}

export function renderVisualBlocksInMarkdown(markdown: string): string {
  let index = 0
  return markdown.replace(fencedBlockPattern, (fullMatch, rawFence: string, source: string) => {
    const fence = rawFence.trim().toLowerCase()
    if (!isVisualBlockKind(fence)) {
      return fullMatch
    }

    index += 1
    const block = fence === 'chart' ? parseChartBlock(source) : { kind: fence, source, diagnostics: [] }
    return visualBlockToHtml(block as VisualBlockViewModel, index)
  })
}

export function replaceVisualBlocksWithImages(
  markdown: string,
  writeImage: (block: VisualBlockViewModel, index: number, svg: string) => string
): string {
  let index = 0
  return markdown.replace(fencedBlockPattern, (fullMatch, rawFence: string, source: string) => {
    const fence = rawFence.trim().toLowerCase()
    if (!isVisualBlockKind(fence)) {
      return fullMatch
    }

    index += 1
    const block = fence === 'chart' ? parseChartBlock(source) : { kind: fence, source, diagnostics: [] }
    const viewModel = block as VisualBlockViewModel
    const svg = renderVisualBlockToSvg(viewModel)
    const imagePath = writeImage(viewModel, index, svg)
    return `![${visualBlockLabel(viewModel.kind, index)}](${imagePath})`
  })
}

function parseChartBlock(source: string): VisualBlockViewModel {
  try {
    const parsed = JSON.parse(source)
    return {
      kind: 'chart',
      source,
      chart: validateChartBlock(parsed),
      diagnostics: []
    }
  } catch (error) {
    const message =
      error instanceof SchemaValidationError
        ? error.message
        : error instanceof SyntaxError
          ? 'Chart block must contain valid JSON'
          : 'Chart block could not be parsed'

    return {
      kind: 'chart',
      source,
      diagnostics: [{ severity: 'error', message }]
    }
  }
}

function isVisualBlockKind(value: string | undefined): value is VisualBlockKind {
  return value !== undefined && visualFenceKinds.has(value as VisualBlockKind)
}

function renderChartSvg(chart: ChartBlock | undefined): string {
  if (!chart) {
    return renderDiagnosticSvg('Grafico non valido', 'Controlla JSON, tipo grafico, assi e dati.')
  }

  const width = 720
  const height = 420
  const margin = { top: 58, right: 38, bottom: 82, left: 72 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const yKey = chart.yKeys[0]
  const rows = chart.data.slice(0, 16)
  const values = rows.map((row) => Number(row[yKey])).map((value) => (Number.isFinite(value) ? value : 0))
  const maxValue = Math.max(...values, 1)
  const title = chart.title ?? 'Grafico'

  if (chart.chartType === 'pie') {
    return renderPieChartSvg(chart, values, maxValue, width, height)
  }

  const points = values.map((value, index) => {
    const x = margin.left + (rows.length === 1 ? plotWidth / 2 : (plotWidth / (rows.length - 1)) * index)
    const y = margin.top + plotHeight - (value / maxValue) * plotHeight
    return { x, y, value, label: String(rows[index][chart.xKey] ?? index + 1) }
  })
  const bars = points
    .map((point, index) => {
      const barWidth = Math.max(18, plotWidth / Math.max(rows.length, 1) - 14)
      const x = margin.left + (plotWidth / Math.max(rows.length, 1)) * index + 7
      const y = point.y
      const barHeight = margin.top + plotHeight - point.y
      return `<rect x="${round(x)}" y="${round(y)}" width="${round(barWidth)}" height="${round(barHeight)}" rx="4" fill="#4f7cac" />`
    })
    .join('\n')
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${round(point.x)} ${round(point.y)}`).join(' ')
  const areaPath = `${linePath} L ${round(points.at(-1)?.x ?? margin.left)} ${margin.top + plotHeight} L ${margin.left} ${margin.top + plotHeight} Z`
  const labels = points
    .map(
      (point) =>
        `<text x="${round(point.x)}" y="${height - 34}" text-anchor="middle" font-size="12" fill="#364152">${escapeHtml(
          truncate(point.label, 14)
        )}</text>`
    )
    .join('\n')

  return svgShell(
    width,
    height,
    `<rect width="720" height="420" fill="#ffffff" />
<text x="36" y="34" font-size="22" font-weight="700" fill="#1c2634">${escapeHtml(title)}</text>
<line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}" stroke="#96a2b4" />
<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#96a2b4" />
<text x="28" y="${margin.top + 10}" font-size="12" fill="#526174">${escapeHtml(yKey)}</text>
${chart.chartType === 'area' ? `<path d="${areaPath}" fill="#4f7cac" opacity="0.22" />` : ''}
${chart.chartType === 'bar' ? bars : ''}
${chart.chartType === 'line' || chart.chartType === 'area' ? `<path d="${linePath}" fill="none" stroke="#2f6f9f" stroke-width="4" stroke-linejoin="round" />` : ''}
${points
  .map((point) => `<circle cx="${round(point.x)}" cy="${round(point.y)}" r="5" fill="#d1495b" />`)
  .join('\n')}
${labels}`
  )
}

function renderPieChartSvg(chart: ChartBlock, values: number[], maxValue: number, width: number, height: number): string {
  const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0) || maxValue
  const rows = chart.data.slice(0, 8)
  const radius = 130
  const centerX = 255
  const centerY = 220
  let startAngle = -90
  const colors = ['#4f7cac', '#d1495b', '#4c956c', '#f2b134', '#7d5fff', '#2d9cdb', '#c77d30', '#6c757d']
  const slices = values.slice(0, 8).map((value, index) => {
    const angle = (Math.max(value, 0) / total) * 360
    const endAngle = startAngle + angle
    const path = describeArc(centerX, centerY, radius, startAngle, endAngle)
    startAngle = endAngle
    return `<path d="${path}" fill="${colors[index % colors.length]}" stroke="#ffffff" stroke-width="3" />`
  })
  const legend = rows
    .map((row, index) => {
      const y = 120 + index * 30
      return `<rect x="470" y="${y - 13}" width="16" height="16" rx="3" fill="${colors[index % colors.length]}" />
<text x="496" y="${y}" font-size="14" fill="#364152">${escapeHtml(truncate(String(row[chart.xKey] ?? index + 1), 24))}: ${escapeHtml(
        String(values[index] ?? 0)
      )}</text>`
    })
    .join('\n')

  return svgShell(
    width,
    height,
    `<rect width="720" height="420" fill="#ffffff" />
<text x="36" y="34" font-size="22" font-weight="700" fill="#1c2634">${escapeHtml(chart.title ?? 'Grafico')}</text>
${slices.join('\n')}
${legend}`
  )
}

function renderDiagramSvg(source: string): string {
  const edges = source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('-->'))
    .slice(0, 8)
    .map((line) => line.split('-->').map((part) => cleanDiagramNode(part)))
  const nodes = Array.from(new Set(edges.flat())).slice(0, 10)
  const width = 720
  const height = Math.max(280, 110 + nodes.length * 54)
  const nodePositions = new Map(nodes.map((node, index) => [node, { x: index % 2 === 0 ? 110 : 430, y: 70 + index * 52 }]))
  const renderedEdges = edges
    .map(([from, to]) => {
      const start = nodePositions.get(from)
      const end = nodePositions.get(to)
      if (!start || !end) return ''
      return `<path d="M ${start.x + 150} ${start.y + 22} C ${start.x + 230} ${start.y + 22}, ${end.x - 80} ${end.y + 22}, ${end.x} ${end.y + 22}" fill="none" stroke="#667085" stroke-width="2" marker-end="url(#arrow)" />`
    })
    .join('\n')
  const renderedNodes = nodes
    .map((node) => {
      const point = nodePositions.get(node)!
      return `<rect x="${point.x}" y="${point.y}" width="150" height="44" rx="6" fill="#eef6fb" stroke="#4f7cac" />
<text x="${point.x + 75}" y="${point.y + 28}" text-anchor="middle" font-size="14" fill="#1c2634">${escapeHtml(truncate(node, 18))}</text>`
    })
    .join('\n')

  if (nodes.length === 0) {
    return renderTextLinesSvg('Diagramma', source)
  }

  return svgShell(
    width,
    height,
    `<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#667085" /></marker></defs>
<rect width="${width}" height="${height}" fill="#ffffff" />
<text x="36" y="34" font-size="22" font-weight="700" fill="#1c2634">Diagramma</text>
${renderedEdges}
${renderedNodes}`
  )
}

function renderMarkmapSvg(source: string): string {
  const items = source
    .split('\n')
    .map((line) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      return match ? { depth: match[1].length, label: match[2].trim() } : null
    })
    .filter((item): item is { depth: number; label: string } => Boolean(item))
    .slice(0, 18)

  if (items.length === 0) {
    return renderTextLinesSvg('Mappa mentale', source)
  }

  const width = 760
  const height = Math.max(300, 90 + items.length * 38)
  const root = items[0]
  const rendered = items
    .map((item, index) => {
      const x = 52 + (item.depth - 1) * 150
      const y = 70 + index * 38
      const parentY = index > 0 ? 70 + Math.max(0, index - 1) * 38 + 14 : y + 14
      const line =
        index === 0
          ? ''
          : `<path d="M ${x - 38} ${parentY} C ${x - 20} ${parentY}, ${x - 20} ${y + 14}, ${x} ${y + 14}" fill="none" stroke="#8aa1b4" stroke-width="2" />`
      return `${line}<rect x="${x}" y="${y}" width="128" height="28" rx="14" fill="${index === 0 ? '#4f7cac' : '#f4f7fa'}" stroke="#4f7cac" />
<text x="${x + 64}" y="${y + 19}" text-anchor="middle" font-size="13" fill="${index === 0 ? '#ffffff' : '#1c2634'}">${escapeHtml(
        truncate(item.label, 18)
      )}</text>`
    })
    .join('\n')

  return svgShell(
    width,
    height,
    `<rect width="${width}" height="${height}" fill="#ffffff" />
<text x="36" y="34" font-size="22" font-weight="700" fill="#1c2634">${escapeHtml(root.label)}</text>
${rendered}`
  )
}

function renderTextLinesSvg(title: string, source: string): string {
  const lines = source
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10)
  return svgShell(
    720,
    300,
    `<rect width="720" height="300" fill="#ffffff" />
<text x="36" y="40" font-size="22" font-weight="700" fill="#1c2634">${escapeHtml(title)}</text>
${lines.map((line, index) => `<text x="36" y="${82 + index * 24}" font-size="14" fill="#364152">${escapeHtml(truncate(line, 80))}</text>`).join('\n')}`
  )
}

function renderDiagnosticSvg(title: string, message: string): string {
  return svgShell(
    720,
    220,
    `<rect width="720" height="220" fill="#fff7ed" />
<rect x="24" y="24" width="672" height="172" rx="8" fill="#ffffff" stroke="#f2b134" />
<text x="48" y="72" font-size="22" font-weight="700" fill="#7a3e00">${escapeHtml(title)}</text>
<text x="48" y="112" font-size="15" fill="#5f4b32">${escapeHtml(message)}</text>`
  )
}

function svgShell(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
${body}
</svg>`
}

function visualBlockLabel(kind: VisualBlockKind, index: number): string {
  const label = kind === 'chart' ? 'Grafico' : kind === 'markmap' ? 'Mappa mentale' : 'Diagramma'
  return `${label} ${index}`
}

function cleanDiagramNode(raw: string): string {
  return raw
    .replace(/^\w+\s+/, '')
    .replace(/[;{}]/g, '')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\(([^)]+)\)/g, '$1')
    .trim()
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y, 'L', cx, cy, 'Z'].join(' ')
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: round(cx + radius * Math.cos(radians)),
    y: round(cy + radius * Math.sin(radians))
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, Math.max(0, length - 1))}…`
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
