import type { ExportEngine, ExportFormat, ExportRuntimeCapabilityDistribution, ExportRuntimeCapabilityId } from '@pecie/schemas'

export const exportRuntimeCapabilities = {
  pandoc: {
    kind: 'converter',
    distribution: 'bundled-core',
    executableBasename: 'pandoc',
    requiredByFormats: ['docx', 'odt', 'rtf', 'epub', 'html', 'jats', 'tei'] satisfies ExportFormat[],
    requiredByEngines: [] as ExportEngine[],
    i18nLabel: 'export.runtime.capability.pandoc'
  },
  weasyprint: {
    kind: 'pdf-engine',
    distribution: 'bundled-sidecar',
    executableBasename: 'weasyprint',
    requiredByFormats: ['pdf'] satisfies ExportFormat[],
    requiredByEngines: ['weasyprint'] satisfies ExportEngine[],
    i18nLabel: 'export.runtime.capability.weasyprint'
  },
  xelatex: {
    kind: 'pdf-engine',
    distribution: 'manual-addon',
    executableBasename: 'xelatex',
    requiredByFormats: ['pdf'] satisfies ExportFormat[],
    requiredByEngines: ['xelatex'] satisfies ExportEngine[],
    i18nLabel: 'export.runtime.capability.xelatex'
  },
  pdflatex: {
    kind: 'pdf-engine',
    distribution: 'manual-addon',
    executableBasename: 'pdflatex',
    requiredByFormats: ['pdf'] satisfies ExportFormat[],
    requiredByEngines: ['pdflatex'] satisfies ExportEngine[],
    i18nLabel: 'export.runtime.capability.pdflatex'
  },
  lualatex: {
    kind: 'pdf-engine',
    distribution: 'manual-addon',
    executableBasename: 'lualatex',
    requiredByFormats: ['pdf'] satisfies ExportFormat[],
    requiredByEngines: ['lualatex'] satisfies ExportEngine[],
    i18nLabel: 'export.runtime.capability.lualatex'
  }
} as const satisfies Record<
  ExportRuntimeCapabilityId,
  {
    kind: 'converter' | 'pdf-engine'
    distribution: ExportRuntimeCapabilityDistribution
    executableBasename: string
    requiredByFormats: ExportFormat[]
    requiredByEngines: ExportEngine[]
    i18nLabel: string
  }
>

