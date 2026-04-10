import type { BinderDocument, BinderNode, CreateProjectRequest, ProjectMetadata } from '@pecie/schemas'

export type ProjectTemplateId = CreateProjectRequest['template']

export type ProjectDocumentTemplate = 'blank' | 'chapter' | 'notes' | 'scene'

export type ProjectTemplateDocumentBlueprint = {
  template: ProjectDocumentTemplate
  frontmatterType?: string
  includeInExport?: boolean
  body: (context: ProjectTemplateContext) => string
}

export type ProjectTemplateContext = {
  projectTitle: string
  language: string
  authorProfile: CreateProjectRequest['authorProfile']
}

export type ProjectTemplateDefinition = {
  label: string
  exportProfile: string
  documentKind: ProjectMetadata['documentKind']
  binder: BinderDocument
  initialDocuments?: Record<string, ProjectTemplateDocumentBlueprint>
}

function createWritingHubNodes(prefix: string): BinderDocument['nodes'] {
  return [
    {
      id: `${prefix}-hub`,
      type: 'folder',
      title: 'Hub di scrittura',
      description: 'Note, appunti e materiali di supporto sempre disponibili durante la scrittura.',
      children: [`${prefix}-notes`, `${prefix}-scratchpad`, `${prefix}-sources`, `${prefix}-uploads`]
    },
    {
      id: `${prefix}-notes`,
      type: 'document',
      title: 'Note di lavoro',
      description: 'Annotazioni persistenti di progetto, escluse dall’export per default.',
      path: `research/notes/${prefix}-note-di-lavoro.md`,
      documentId: `${prefix}-doc-notes`
    },
    {
      id: `${prefix}-scratchpad`,
      type: 'document',
      title: 'Appunti rapidi',
      description: 'Spazio libero per idee, promemoria e frammenti non ancora strutturati.',
      path: `research/notes/${prefix}-appunti-rapidi.md`,
      documentId: `${prefix}-doc-scratchpad`
    },
    {
      id: `${prefix}-sources`,
      type: 'folder',
      title: 'Fonti e riferimenti',
      description: 'Materiali di supporto e riferimenti operativi collegati al progetto.',
      children: []
    },
    {
      id: `${prefix}-uploads`,
      type: 'folder',
      title: 'Documenti caricati',
      description: 'Contenitore per documenti e allegati locali fino a 500 MB.',
      children: []
    }
  ]
}

function createSectionDocument(id: string, title: string, pathValue: string, documentId: string, description?: string): BinderNode {
  return {
    id,
    type: 'document',
    title,
    description,
    path: pathValue,
    documentId
  }
}

function createOpeningSheet(title: string, lines: string[]): string {
  return `# ${title}\n\n${lines.join('\n')}\n`
}

function createTitlePageBody(context: ProjectTemplateContext): string {
  return createOpeningSheet('Frontespizio', [
    `**Titolo tesi:** ${context.projectTitle}`,
    `**Studente:** ${context.authorProfile.name}`,
    '**Relatore:** [Inserisci nome relatore]',
    '**Correlatore:** [Inserisci nome correlatore]',
    `**Corso di laurea:** [Inserisci corso]`,
    `**Dipartimento:** ${context.authorProfile.department || '[Inserisci dipartimento]'}`,
    `**Ateneo / Istituzione:** ${context.authorProfile.institutionName || '[Inserisci ateneo]'}`,
    '**Anno accademico:** [Inserisci anno accademico]',
    '',
    '## Note operative',
    '- Personalizza i campi tra parentesi quadre prima dell’export.',
    '- Mantieni questa pagina all’inizio del progetto per un frontespizio sempre pronto.'
  ])
}

function createPaperTitlePageBody(context: ProjectTemplateContext): string {
  return createOpeningSheet('Pagina titolo paper', [
    `**Titolo:** ${context.projectTitle}`,
    `**Autore principale:** ${context.authorProfile.name}`,
    `**Affiliazione:** ${context.authorProfile.institutionName || '[Inserisci affiliazione]'}`,
    '**Coautori:** [Inserisci coautori]',
    '**Corresponding author:** [Inserisci contatto]',
    '**Rivista / Venue:** [Inserisci venue]',
    '**Keywords:** [Inserisci parole chiave]',
    '',
    '## Abstract breve',
    'Inserisci qui una sintesi pronta da rifinire e riusare nel documento finale.'
  ])
}

function createBookTitlePageBody(context: ProjectTemplateContext): string {
  return createOpeningSheet('Pagina del titolo', [
    `**Titolo opera:** ${context.projectTitle}`,
    `**Autore:** ${context.authorProfile.name}`,
    '**Sottotitolo:** [Inserisci sottotitolo]',
    '**Collana / Editore:** [Inserisci collana o editore]',
    '**Edizione / Revisione:** [Inserisci versione]',
    '',
    '## Nota editoriale',
    'Usa questa pagina per raccogliere i dati di apertura del volume prima della stesura definitiva.'
  ])
}

function createArticleTitlePageBody(context: ProjectTemplateContext): string {
  return createOpeningSheet('Pagina titolo e crediti', [
    `**Titolo:** ${context.projectTitle}`,
    `**Firma:** ${context.authorProfile.name}`,
    '**Testata / Pubblicazione:** [Inserisci testata]',
    '**Sezione / Rubrica:** [Inserisci rubrica]',
    '**Data:** [Inserisci data]',
    '**Tag / Keywords:** [Inserisci tag]',
    '',
    '## Sommario editoriale',
    'Aggiungi qui il focus dell’articolo e i punti chiave da tenere visibili durante la scrittura.'
  ])
}

function createJournalIssueSheetBody(context: ProjectTemplateContext): string {
  return createOpeningSheet('Scheda numero', [
    `**Testata:** ${context.projectTitle}`,
    '**Numero / Edizione:** [Inserisci numero]',
    '**Direttore responsabile:** [Inserisci nome]',
    '**Caporedattore:** [Inserisci nome]',
    '**Data di uscita:** [Inserisci data]',
    '**Tema del numero:** [Inserisci tema]',
    '',
    '## Piano editoriale',
    '- Editoriale',
    '- Articolo principale',
    '- Articolo secondario',
    '- Note di chiusura'
  ])
}

function createVideoScriptSheetBody(context: ProjectTemplateContext): string {
  return createOpeningSheet('Scheda script video', [
    `**Titolo progetto:** ${context.projectTitle}`,
    `**Autore:** ${context.authorProfile.name}`,
    '**Cliente / Brand:** [Inserisci cliente]',
    '**Regista / Producer:** [Inserisci nome]',
    '**Formato:** [Spot, branded, tutorial, social, documentario breve]',
    '**Durata stimata:** [Inserisci durata]',
    '**Call to action:** [Inserisci CTA]',
    '',
    '## Obiettivo del video',
    'Definisci in modo sintetico cosa deve ottenere il video e quale tono deve avere.'
  ])
}

function createScreenplayTitlePageBody(context: ProjectTemplateContext): string {
  return createOpeningSheet('Pagina titolo sceneggiatura', [
    `**Titolo:** ${context.projectTitle}`,
    `**Scritto da:** ${context.authorProfile.name}`,
    '**Basato su:** [Inserisci riferimento, se presente]',
    '**Genere:** [Inserisci genere]',
    '**Logline:** [Inserisci logline]',
    '**Bozza:** [Inserisci numero bozza]',
    '',
    '## Nota di sviluppo',
    'Riassumi il concept della sceneggiatura e i vincoli creativi da mantenere durante la stesura.'
  ])
}

function createManualProjectSheetBody(context: ProjectTemplateContext): string {
  return createOpeningSheet('Scheda manuale', [
    `**Titolo documento:** ${context.projectTitle}`,
    `**Autore / Owner:** ${context.authorProfile.name}`,
    '**Prodotto / Sistema:** [Inserisci prodotto o sistema]',
    '**Versione documento:** 0.1',
    '**Versione prodotto:** [Inserisci versione]',
    '**Audience primaria:** [Utenti finali, operatori, team tecnico, onboarding]',
    '**Prerequisiti:** [Accessi, tool, ambiente, materiali richiesti]',
    '',
    '## Obiettivo del manuale',
    'Definisci cosa deve permettere di fare il manuale e quale risultato operativo deve garantire al lettore.'
  ])
}

function createBlankProjectSheetBody(context: ProjectTemplateContext): string {
  return createOpeningSheet('Scheda progetto vuoto', [
    `**Titolo progetto:** ${context.projectTitle}`,
    `**Autore:** ${context.authorProfile.name}`,
    '**Obiettivo editoriale:** [Descrivi cosa vuoi costruire]',
    '**Formato finale previsto:** [Libro, guida, corso, raccolta, dossier, altro]',
    '**Pubblico:** [Inserisci destinatari principali]',
    '',
    '## Come usare questo progetto',
    '- Rinomina o elimina liberamente le sezioni iniziali.',
    '- Aggiungi documenti e cartelle dal binder per costruire la tua architettura editoriale.',
    '- Usa il writing hub per note, riferimenti e materiali locali di supporto.'
  ])
}

export const projectTemplates: Record<ProjectTemplateId, ProjectTemplateDefinition> = {
  blank: {
    label: 'Vuoto personalizzabile',
    exportProfile: 'blank-docx',
    documentKind: 'blank',
    binder: {
      rootId: 'root',
      nodes: [
        { id: 'root', type: 'folder', title: 'Progetto', children: ['project-sheet', 'manuscript', 'blank-hub'] },
        createSectionDocument(
          'project-sheet',
          'Scheda progetto',
          'docs/frontmatter/scheda-progetto.md',
          'doc-000',
          'Pagina iniziale neutra per definire obiettivo, pubblico e forma del progetto.'
        ),
        {
          id: 'manuscript',
          type: 'folder',
          title: 'Manoscritto',
          description: 'Spazio iniziale vuoto da modellare secondo la tua struttura editoriale.',
          children: ['opening-document']
        },
        createSectionDocument(
          'opening-document',
          'Documento iniziale',
          'docs/chapters/documento-iniziale.md',
          'doc-001',
          'Pagina di partenza completamente modificabile o eliminabile.'
        ),
        ...createWritingHubNodes('blank')
      ]
    },
    initialDocuments: {
      'project-sheet': {
        template: 'blank',
        frontmatterType: 'project-sheet',
        body: createBlankProjectSheetBody
      },
      'opening-document': {
        template: 'blank',
        frontmatterType: 'chapter',
        body: () =>
          createOpeningSheet('Documento iniziale', [
            'Inizia da qui oppure riorganizza liberamente il binder in base al tuo flusso di lavoro.'
          ])
      }
    }
  },
  thesis: {
    label: 'Tesi',
    exportProfile: 'thesis-pdf',
    documentKind: 'thesis',
    binder: {
      rootId: 'root',
      nodes: [
        { id: 'root', type: 'folder', title: 'Progetto', children: ['title-page', 'manuscript', 'thesis-hub'] },
        createSectionDocument(
          'title-page',
          'Frontespizio',
          'docs/frontmatter/frontespizio.md',
          'doc-000',
          'Pagina iniziale editabile con i dati della tesi.'
        ),
        { id: 'manuscript', type: 'folder', title: 'Manoscritto', children: ['intro'] },
        createSectionDocument('intro', 'Introduzione', 'docs/chapters/introduzione.md', 'doc-001'),
        ...createWritingHubNodes('thesis')
      ]
    },
    initialDocuments: {
      'title-page': {
        template: 'blank',
        frontmatterType: 'frontespiece',
        body: createTitlePageBody
      }
    }
  },
  paper: {
    label: 'Paper',
    exportProfile: 'paper-docx',
    documentKind: 'paper',
    binder: {
      rootId: 'root',
      nodes: [
        { id: 'root', type: 'folder', title: 'Paper', children: ['title-page', 'abstract', 'body', 'paper-hub'] },
        createSectionDocument('title-page', 'Pagina titolo', 'docs/frontmatter/pagina-titolo.md', 'doc-000'),
        createSectionDocument('abstract', 'Abstract', 'docs/chapters/abstract.md', 'doc-001'),
        createSectionDocument('body', 'Body', 'docs/chapters/body.md', 'doc-002'),
        ...createWritingHubNodes('paper')
      ]
    },
    initialDocuments: {
      'title-page': {
        template: 'blank',
        frontmatterType: 'title-page',
        body: createPaperTitlePageBody
      }
    }
  },
  book: {
    label: 'Libro / Saggio lungo',
    exportProfile: 'book-epub',
    documentKind: 'book',
    binder: {
      rootId: 'root',
      nodes: [
        { id: 'root', type: 'folder', title: 'Libro / Saggio', children: ['title-page', 'outline', 'preface', 'chapter-1', 'book-hub'] },
        createSectionDocument('title-page', 'Pagina del titolo', 'docs/frontmatter/pagina-titolo.md', 'doc-000'),
        createSectionDocument('outline', 'Indice e architettura', 'docs/frontmatter/indice-e-architettura.md', 'doc-001'),
        createSectionDocument('preface', 'Prefazione', 'docs/chapters/prefazione.md', 'doc-002'),
        createSectionDocument('chapter-1', 'Capitolo 1', 'docs/chapters/capitolo-1.md', 'doc-003'),
        ...createWritingHubNodes('book')
      ]
    },
    initialDocuments: {
      'title-page': {
        template: 'blank',
        frontmatterType: 'title-page',
        body: createBookTitlePageBody
      }
    }
  },
  manual: {
    label: 'Manuale',
    exportProfile: 'manual-docx',
    documentKind: 'manual',
    binder: {
      rootId: 'root',
      nodes: [
        {
          id: 'root',
          type: 'folder',
          title: 'Manuale',
          children: ['project-sheet', 'overview', 'setup', 'procedures', 'reference', 'manual-hub']
        },
        createSectionDocument('project-sheet', 'Scheda manuale', 'docs/frontmatter/scheda-manuale.md', 'doc-000'),
        createSectionDocument('overview', 'Panoramica e audience', 'docs/frontmatter/panoramica-e-audience.md', 'doc-001'),
        createSectionDocument('setup', 'Installazione e setup', 'docs/chapters/installazione-e-setup.md', 'doc-002'),
        createSectionDocument('procedures', 'Procedure operative', 'docs/chapters/procedure-operative.md', 'doc-003'),
        createSectionDocument('reference', 'Riferimento rapido', 'docs/appendices/riferimento-rapido.md', 'doc-004'),
        ...createWritingHubNodes('manual')
      ]
    },
    initialDocuments: {
      'project-sheet': {
        template: 'blank',
        frontmatterType: 'project-sheet',
        body: createManualProjectSheetBody
      },
      overview: {
        template: 'chapter',
        frontmatterType: 'manual-overview',
        body: () =>
          createOpeningSheet('Panoramica e audience', [
            '## Per chi è questo manuale',
            '',
            '## Cosa permette di fare',
            '',
            '## Vincoli, prerequisiti e confini'
          ])
      },
      setup: {
        template: 'chapter',
        frontmatterType: 'manual-setup',
        body: () =>
          createOpeningSheet('Installazione e setup', [
            '## Requisiti',
            '',
            '## Procedura di installazione',
            '',
            '## Verifica iniziale'
          ])
      },
      procedures: {
        template: 'chapter',
        frontmatterType: 'manual-procedures',
        body: () =>
          createOpeningSheet('Procedure operative', [
            '## Flusso principale',
            '',
            '## Procedura passo-passo',
            '',
            '## Errori comuni e recovery'
          ])
      },
      reference: {
        template: 'chapter',
        frontmatterType: 'manual-reference',
        body: () =>
          createOpeningSheet('Riferimento rapido', [
            '## Comandi / scorciatoie / parametri',
            '',
            '## Glossario',
            '',
            '## Note di manutenzione'
          ])
      }
    }
  },
  journal: {
    label: 'Giornale',
    exportProfile: 'journal-docx',
    documentKind: 'journal',
    binder: {
      rootId: 'root',
      nodes: [
        {
          id: 'root',
          type: 'folder',
          title: 'Giornale',
          children: ['issue-sheet', 'editorial', 'issue-current', 'journal-hub', 'archive']
        },
        createSectionDocument('issue-sheet', 'Scheda numero', 'docs/frontmatter/scheda-numero.md', 'doc-000'),
        createSectionDocument('editorial', 'Editoriale', 'docs/chapters/editoriale.md', 'doc-001'),
        { id: 'issue-current', type: 'folder', title: 'Numero corrente', children: ['article-1', 'article-2'] },
        createSectionDocument('article-1', 'Articolo 1', 'docs/chapters/articolo-1.md', 'doc-002'),
        createSectionDocument('article-2', 'Articolo 2', 'docs/chapters/articolo-2.md', 'doc-003'),
        ...createWritingHubNodes('journal'),
        { id: 'archive', type: 'folder', title: 'Archivio numeri', children: [] }
      ]
    },
    initialDocuments: {
      'issue-sheet': {
        template: 'blank',
        frontmatterType: 'issue-sheet',
        body: createJournalIssueSheetBody
      }
    }
  },
  article: {
    label: 'Articolo',
    exportProfile: 'article-docx',
    documentKind: 'article',
    binder: {
      rootId: 'root',
      nodes: [
        { id: 'root', type: 'folder', title: 'Articolo', children: ['title-page', 'headline', 'body', 'article-hub'] },
        createSectionDocument('title-page', 'Pagina titolo e crediti', 'docs/frontmatter/pagina-titolo.md', 'doc-000'),
        createSectionDocument('headline', 'Titolo e abstract', 'docs/chapters/titolo-e-abstract.md', 'doc-001'),
        createSectionDocument('body', 'Corpo articolo', 'docs/chapters/corpo-articolo.md', 'doc-002'),
        ...createWritingHubNodes('article')
      ]
    },
    initialDocuments: {
      'title-page': {
        template: 'blank',
        frontmatterType: 'title-page',
        body: createArticleTitlePageBody
      }
    }
  },
  videoScript: {
    label: 'Script video',
    exportProfile: 'video-script-docx',
    documentKind: 'videoScript',
    binder: {
      rootId: 'root',
      nodes: [
        { id: 'root', type: 'folder', title: 'Script video', children: ['project-sheet', 'outline', 'script-body', 'video-script-hub'] },
        createSectionDocument('project-sheet', 'Scheda script video', 'docs/frontmatter/scheda-script-video.md', 'doc-000'),
        createSectionDocument('outline', 'Scaletta', 'docs/chapters/scaletta.md', 'doc-001'),
        createSectionDocument('script-body', 'Script', 'docs/chapters/script.md', 'doc-002'),
        ...createWritingHubNodes('video-script')
      ]
    },
    initialDocuments: {
      'project-sheet': {
        template: 'blank',
        frontmatterType: 'project-sheet',
        body: createVideoScriptSheetBody
      },
      outline: {
        template: 'chapter',
        frontmatterType: 'outline',
        body: () =>
          createOpeningSheet('Scaletta', ['## Hook iniziale', '', '## Sequenza centrale', '', '## Chiusura e CTA'])
      },
      'script-body': {
        template: 'scene',
        frontmatterType: 'video-script',
        body: () =>
          createOpeningSheet('Script', ['## Inquadratura / Visual', '', '## Voce / Dialogo', '', '## Grafica / CTA'])
      }
    }
  },
  screenplay: {
    label: 'Sceneggiatura',
    exportProfile: 'screenplay-docx',
    documentKind: 'screenplay',
    binder: {
      rootId: 'root',
      nodes: [
        { id: 'root', type: 'folder', title: 'Sceneggiatura', children: ['title-page', 'act-1', 'screenplay-hub'] },
        createSectionDocument('title-page', 'Pagina titolo sceneggiatura', 'docs/frontmatter/pagina-titolo.md', 'doc-000'),
        { id: 'act-1', type: 'folder', title: 'Atto I', children: ['scene-1'] },
        createSectionDocument('scene-1', 'Scena 1', 'docs/chapters/scena-1.md', 'doc-001'),
        ...createWritingHubNodes('screenplay')
      ]
    },
    initialDocuments: {
      'title-page': {
        template: 'blank',
        frontmatterType: 'title-page',
        body: createScreenplayTitlePageBody
      },
      'scene-1': {
        template: 'scene',
        frontmatterType: 'screenplay-scene',
        body: () =>
          createOpeningSheet('Scena 1', ['## INT./EST. - LUOGO - TEMPO', '', '## Azione', '', '## Dialoghi', '', '## Chiusura'])
      }
    }
  }
}

export function createProjectMetadata(input: CreateProjectRequest, createdAt: string): ProjectMetadata {
  const template = projectTemplates[input.template]

  return {
    title: input.title,
    author: {
      name: input.authorProfile.name,
      role: input.authorProfile.role
    },
    authors: [
      {
        id: 'author-primary',
        name: input.authorProfile.name,
        role: input.authorProfile.role,
        institutionName: input.authorProfile.institutionName || undefined,
        department: input.authorProfile.department || undefined,
        preferredLanguage: input.authorProfile.preferredLanguage,
        addedAt: createdAt,
        lastModifiedAt: createdAt
      }
    ],
    primaryAuthorId: 'author-primary',
    authorshipStats: [
      {
        authorId: 'author-primary',
        wordCount: 0,
        percentage: 100
      }
    ],
    institution: input.authorProfile.institutionName
      ? {
          name: input.authorProfile.institutionName,
          department: input.authorProfile.department || undefined
        }
      : undefined,
    documentKind: template.documentKind,
    defaultLanguage: input.language,
    defaultBibliographyStyle: 'apa',
    projectVisibility: 'private-local',
    containsSensitiveData: true
  }
}
