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
  'exports/themes/github-markdown.css': `/*
 * Pecie — professional A4 print theme for WeasyPrint.
 *
 * Goals:
 *  - Highly readable, professional document typography.
 *  - Print-safe: no clipped code blocks, no tables cut mid-row, no dropped
 *    figures. Every block that must stay whole uses break-inside: avoid, and
 *    wide content wraps instead of overflowing the page box.
 */

:root {
  color-scheme: light;
  --ink: #1f2328;
  --ink-soft: #57606a;
  --rule: #d0d7de;
  --rule-soft: #e6e9ee;
  --accent: #0b4f9c;
  --surface: #f6f8fa;
  --code-bg: #f2f4f7;
}

/* ---- Page geometry (A4) ------------------------------------------------- */
@page {
  size: A4;
  margin: 20mm 18mm 22mm;

  @bottom-center {
    content: counter(page) " / " counter(pages);
    color: #8a929c;
    font-family: "Source Serif 4", Georgia, "Times New Roman", serif;
    font-size: 9pt;
  }
}

/* ---- Base --------------------------------------------------------------- */
html {
  font-size: 10.75pt;
}

body {
  margin: 0;
  color: var(--ink);
  background: #ffffff;
  font-family: "Source Serif 4", Georgia, "Times New Roman", serif;
  line-height: 1.55;
  text-rendering: optimizeLegibility;
  orphans: 3;
  widows: 3;
  hyphens: auto;
  overflow-wrap: break-word;
  word-wrap: break-word;
}

/* ---- Headings ----------------------------------------------------------- */
h1, h2, h3, h4, h5, h6 {
  margin: 1.5em 0 0.55em;
  font-weight: 600;
  line-height: 1.25;
  color: var(--ink);
  break-after: avoid;
  page-break-after: avoid;
  break-inside: avoid;
}

h1 {
  font-size: 1.95em;
  margin-top: 0;
  padding-bottom: 0.22em;
  border-bottom: 2px solid var(--rule);
}

h2 {
  font-size: 1.5em;
  padding-bottom: 0.2em;
  border-bottom: 1px solid var(--rule);
}

h3 { font-size: 1.24em; }
h4 { font-size: 1.08em; }
h5 { font-size: 1em; }
h6 { font-size: 0.92em; color: var(--ink-soft); }

/* Keep a heading glued to the paragraph that follows it. */
h1 + *, h2 + *, h3 + *, h4 + *, h5 + *, h6 + * {
  break-before: avoid;
  page-break-before: avoid;
}

/* ---- Flow --------------------------------------------------------------- */
p, ul, ol, dl, blockquote, table, pre, figure {
  margin-top: 0;
  margin-bottom: 0.9em;
}

a {
  color: var(--accent);
  text-decoration: none;
}

strong { font-weight: 600; }

ul, ol {
  padding-left: 1.5em;
}

li + li {
  margin-top: 0.18em;
}

li > ul, li > ol {
  margin-top: 0.18em;
  margin-bottom: 0;
}

dt { font-weight: 600; }
dd { margin: 0 0 0.4em 1.2em; }

/* ---- Code --------------------------------------------------------------- */
code, kbd, samp, pre {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.88em;
}

code {
  padding: 0.12em 0.35em;
  border-radius: 5px;
  background: var(--code-bg);
}

pre {
  padding: 0.85em 1em;
  border: 1px solid var(--rule);
  border-radius: 8px;
  background: var(--surface);
  /* Never clip: overflow long lines by wrapping so no code is dropped. */
  overflow: visible;
  white-space: pre-wrap;
  word-break: break-word;
  break-inside: avoid;
  page-break-inside: avoid;
}

/* A code block taller than a page must be allowed to split, otherwise it is
   silently dropped. Undo the "avoid" for oversized blocks. */
pre:only-child,
pre.wrap-split {
  break-inside: auto;
  page-break-inside: auto;
}

pre code {
  padding: 0;
  background: transparent;
  font-size: inherit;
}

/* ---- Blockquote --------------------------------------------------------- */
blockquote {
  padding: 0.1em 1.1em;
  margin-left: 0;
  color: var(--ink-soft);
  border-left: 3px solid var(--rule);
  break-inside: avoid;
  page-break-inside: avoid;
}

/* ---- Tables — never cut mid-row ---------------------------------------- */
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92em;
  /* Let long tables span pages, but keep header + each row intact. */
  break-inside: auto;
  page-break-inside: auto;
}

thead {
  /* Repeat the header row on every page the table spills onto. */
  display: table-header-group;
}

tfoot {
  display: table-footer-group;
}

tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

th, td {
  padding: 0.42em 0.65em;
  border: 1px solid var(--rule);
  vertical-align: top;
  text-align: left;
  overflow-wrap: break-word;
  word-break: break-word;
}

th {
  background: var(--surface);
  font-weight: 600;
}

tbody tr:nth-child(even) {
  background: #fbfcfd;
}

/* ---- Figures & images --------------------------------------------------- */
img {
  max-width: 100%;
  height: auto;
}

figure {
  margin: 0 0 1em;
  text-align: center;
  break-inside: avoid;
  page-break-inside: avoid;
}

figcaption {
  margin-top: 0.4em;
  color: var(--ink-soft);
  font-size: 0.88em;
}

/* ---- Rules -------------------------------------------------------------- */
hr {
  height: 0;
  margin: 1.6em 0;
  border: 0;
  border-top: 1px solid var(--rule-soft);
}

/* ---- Footnotes / definition-style small print --------------------------- */
sup, sub {
  font-size: 0.72em;
  line-height: 0;
}
`
} as const

export function getDefaultExportProfiles(templateId: ProjectTemplateId): ExportProfile[] {
  return defaultExportProfilesByTemplate[templateId]
}
