import type { ExportProfile } from '@pecie/schemas'

import type { ProjectTemplateId } from './project-templates'

const defaultInclude = {
  excludeFrontmatter: {
    includeInExport: false
  }
} as const

const defaultOutput = {
  filenameFrom: 'project.title',
  directory: 'exports/out'
} as const

const familyFormats: ReadonlyArray<ExportProfile['format']> = [
  'pdf',
  'docx',
  'odt',
  'rtf',
  'epub',
  'html',
  'latex',
  'jats',
  'tei',
  'md',
  'txt'
]

type FamilyConfig = {
  baseId: string
  baseLabel: string
  citationProfile?: string
  toc?: boolean
  pageNumbering?: ExportProfile['pageNumbering']
  byFormat?: Partial<
    Record<
      ExportProfile['format'],
      Pick<ExportProfile, 'engine' | 'template' | 'theme' | 'citationProfile' | 'toc' | 'pageNumbering'>
    >
  >
}

function formatLabel(format: ExportProfile['format']): string {
  switch (format) {
    case 'pdf':
      return 'PDF'
    case 'docx':
      return 'DOCX'
    case 'odt':
      return 'ODT'
    case 'rtf':
      return 'RTF'
    case 'epub':
      return 'EPUB'
    case 'html':
      return 'HTML'
    case 'latex':
      return 'LaTeX'
    case 'jats':
      return 'JATS XML'
    case 'tei':
      return 'TEI XML'
    case 'md':
      return 'Markdown'
    case 'txt':
      return 'Plain Text'
  }
}

function createFamilyProfiles(config: FamilyConfig): ExportProfile[] {
  return familyFormats.map((format) => {
    const override = config.byFormat?.[format]
    return {
      id: `${config.baseId}-${format}`,
      schemaVersion: 1,
      label: `${config.baseLabel} - ${formatLabel(format)}`,
      format,
      include: defaultInclude,
      engine: override?.engine ?? (format === 'pdf' ? 'xelatex' : undefined),
      template: override?.template,
      theme: override?.theme,
      citationProfile: override?.citationProfile ?? config.citationProfile,
      toc: override?.toc ?? config.toc,
      pageNumbering: override?.pageNumbering ?? config.pageNumbering,
      output: defaultOutput
    }
  })
}

function createMarkdownPdfProfile(config: Pick<FamilyConfig, 'baseId' | 'baseLabel' | 'citationProfile' | 'toc'>): ExportProfile {
  return {
    id: `${config.baseId}-markdown-pdf`,
    schemaVersion: 1,
    label: `${config.baseLabel} - PDF Markdown puro`,
    format: 'pdf',
    include: defaultInclude,
    engine: 'weasyprint',
    theme: 'exports/themes/github-markdown.css',
    citationProfile: config.citationProfile,
    toc: config.toc,
    output: defaultOutput
  }
}

export const defaultExportProfilesByTemplate: Record<ProjectTemplateId, ExportProfile[]> = {
  blank: [
    ...createFamilyProfiles({
      baseId: 'blank',
      baseLabel: 'Documento vuoto'
    }),
    createMarkdownPdfProfile({
      baseId: 'blank',
      baseLabel: 'Documento vuoto'
    })
  ],
  thesis: [
    ...createFamilyProfiles({
      baseId: 'thesis',
      baseLabel: 'Tesi',
      citationProfile: 'default',
      toc: true,
      byFormat: {
        pdf: {
          template: 'exports/templates/thesis/default.tex',
          theme: 'exports/themes/academic-light.json',
          pageNumbering: 'roman-then-arabic'
        },
        latex: {
          template: 'exports/templates/thesis/default.tex',
          theme: 'exports/themes/academic-light.json',
          pageNumbering: 'roman-then-arabic'
        }
      }
    }),
    createMarkdownPdfProfile({
      baseId: 'thesis',
      baseLabel: 'Tesi',
      citationProfile: 'default',
      toc: true
    })
  ],
  paper: [
    ...createFamilyProfiles({
      baseId: 'paper',
      baseLabel: 'Paper',
      citationProfile: 'default',
      toc: true
    }),
    createMarkdownPdfProfile({
      baseId: 'paper',
      baseLabel: 'Paper',
      citationProfile: 'default',
      toc: true
    })
  ],
  book: [
    ...createFamilyProfiles({
      baseId: 'book',
      baseLabel: 'Libro',
      citationProfile: 'default',
      toc: true
    }),
    createMarkdownPdfProfile({
      baseId: 'book',
      baseLabel: 'Libro',
      citationProfile: 'default',
      toc: true
    })
  ],
  manual: [
    ...createFamilyProfiles({
      baseId: 'manual',
      baseLabel: 'Manuale',
      toc: true
    }),
    createMarkdownPdfProfile({
      baseId: 'manual',
      baseLabel: 'Manuale',
      toc: true
    })
  ],
  journal: [
    ...createFamilyProfiles({
      baseId: 'journal',
      baseLabel: 'Giornale',
      toc: true
    }),
    createMarkdownPdfProfile({
      baseId: 'journal',
      baseLabel: 'Giornale',
      toc: true
    })
  ],
  article: [
    ...createFamilyProfiles({
      baseId: 'article',
      baseLabel: 'Articolo',
      citationProfile: 'default'
    }),
    createMarkdownPdfProfile({
      baseId: 'article',
      baseLabel: 'Articolo',
      citationProfile: 'default'
    })
  ],
  videoScript: [
    ...createFamilyProfiles({
      baseId: 'video-script',
      baseLabel: 'Script video'
    }),
    createMarkdownPdfProfile({
      baseId: 'video-script',
      baseLabel: 'Script video'
    })
  ],
  screenplay: [
    ...createFamilyProfiles({
      baseId: 'screenplay',
      baseLabel: 'Sceneggiatura'
    }),
    createMarkdownPdfProfile({
      baseId: 'screenplay',
      baseLabel: 'Sceneggiatura'
    })
  ]
}

export const defaultExportProfileAssets = {
  'exports/templates/thesis/default.tex': `% Default thesis Pandoc template for Pecie.
\\documentclass[12pt]{report}
\\usepackage{fontspec}
\\usepackage{hyperref}
\\usepackage{longtable}
\\usepackage{booktabs}
\\usepackage{graphicx}
\\usepackage{setspace}
\\setmainfont{TeX Gyre Pagella}

\\title{$title$}
\\author{$for(author)$$author$$sep$ \\\\ $endfor$}
\\date{$date$}

\\begin{document}
\\maketitle
$if(toc)$
\\tableofcontents
\\clearpage
$endif$
$body$
\\end{document}
`,
  'exports/themes/academic-light.json': JSON.stringify(
    {
      name: 'academic-light',
      typography: {
        bodyFont: 'TeX Gyre Pagella',
        headingFont: 'TeX Gyre Heros'
      },
      colors: {
        text: '#151515',
        accent: '#1f4b99'
      },
      spacing: {
        paragraph: 1.2
      }
    },
    null,
    2
  ),
  'exports/themes/github-markdown.css': `/* GitHub-like markdown print theme for Pecie + WeasyPrint */
:root {
  color-scheme: light;
}

html {
  font-size: 11pt;
}

body {
  margin: 0 auto;
  max-width: 8.27in;
  padding: 0.6in 0.7in 0.8in;
  color: #24292f;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  line-height: 1.6;
  word-wrap: break-word;
}

h1, h2, h3, h4, h5, h6 {
  margin-top: 1.4em;
  margin-bottom: 0.6em;
  font-weight: 600;
  line-height: 1.25;
  color: #1f2328;
  page-break-after: avoid;
}

h1, h2 {
  border-bottom: 1px solid #d0d7de;
  padding-bottom: 0.25em;
}

h1 { font-size: 2em; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.25em; }
h4 { font-size: 1em; }

p, ul, ol, blockquote, table, pre {
  margin-top: 0;
  margin-bottom: 1em;
}

a {
  color: #0969da;
  text-decoration: none;
}

code, pre, kbd, samp {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.92em;
}

code {
  padding: 0.15em 0.35em;
  border-radius: 6px;
  background: rgba(175, 184, 193, 0.2);
}

pre {
  padding: 1em;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid #d0d7de;
  background: #f6f8fa;
  white-space: pre-wrap;
}

pre code {
  padding: 0;
  background: transparent;
}

blockquote {
  padding: 0 1em;
  color: #57606a;
  border-left: 0.25em solid #d0d7de;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95em;
}

table th,
table td {
  padding: 0.45em 0.7em;
  border: 1px solid #d0d7de;
  vertical-align: top;
}

table tr:nth-child(even) {
  background: #f6f8fa;
}

img {
  max-width: 100%;
}

hr {
  height: 1px;
  margin: 1.5em 0;
  border: 0;
  background: #d0d7de;
}

ul, ol {
  padding-left: 1.5em;
}

li + li {
  margin-top: 0.2em;
}

@page {
  size: A4;
  margin: 16mm 14mm 18mm;
}
`
} as const

export function getDefaultExportProfiles(templateId: ProjectTemplateId): ExportProfile[] {
  return defaultExportProfilesByTemplate[templateId]
}
