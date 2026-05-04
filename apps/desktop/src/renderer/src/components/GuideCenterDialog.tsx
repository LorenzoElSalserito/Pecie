import { useEffect, useMemo, useState } from 'react'

import { marked } from 'marked'
import { Button, Dialog } from '@pecie/ui'

import { t } from '../i18n'
import { CopyableSnippet } from './CopyableSnippet'
import type { GuideCenterDialogProps, GuideCenterSection } from './types'
import { sanitizeRenderedMarkdown } from './utils'

type GuideItem = {
  title: string
  description: string
  snippet: string
}

type GuideSection = {
  title: string
  intro?: string
  items: GuideItem[]
}

type MarkdownGuideContent = {
  intro: string[]
  sections: GuideSection[]
  notes: string[]
}

function getItalianGuide(): MarkdownGuideContent {
  return {
    intro: [
      'Pecie lavora con testo semplice: puoi scrivere Markdown a mano oppure usare la toolbar sopra l’editor. Qui trovi una guida pratica, pensata per coprire la sintassi base e quella estesa più utile in scrittura, studio, editoria e sceneggiatura.',
      'Le sintassi standard funzionano in modo stabile nella preview e negli export testuali. Alcune estensioni dipendono dal formato finale o dal convertitore, ma vale la pena usarle perché restano leggibili anche come puro testo.'
    ],
    sections: [
      {
        title: 'Sintassi di base',
        intro: 'Questi elementi sono i più sicuri e leggibili in qualsiasi progetto Markdown.',
        items: [
          {
            title: 'Titoli e gerarchie',
            description: 'Usa da uno a sei simboli #, sempre seguiti da uno spazio. Ogni livello costruisce l’ossatura del documento e aiuta anche l’export.',
            snippet: '# Titolo 1\n## Titolo 2\n### Titolo 3\n#### Titolo 4\n##### Titolo 5\n###### Titolo 6'
          },
          {
            title: 'Paragrafi e a capo',
            description: 'Un rigo vuoto separa i paragrafi. Per forzare un ritorno a capo all’interno dello stesso paragrafo puoi lasciare due spazi finali o usare il tag <br>.',
            snippet: 'Primo paragrafo.\n\nSecondo paragrafo.\nRiga con a capo forzato.  \nRiga successiva.\n\nOppure con HTML:<br>\nRiga successiva.'
          },
          {
            title: 'Grassetto, corsivo e combinazioni',
            description: 'Il grassetto usa **, il corsivo usa _ o *. Puoi combinare le due forme per creare enfasi più ricche.',
            snippet: '**testo in grassetto**\n_testo in corsivo_\n*testo in corsivo*\n_testo con **grassetto** interno_\n**_testo grassetto e corsivo_**'
          },
          {
            title: 'Citazioni',
            description: 'Il simbolo > apre un blocco di citazione. Va ripetuto anche sui paragrafi successivi della stessa citazione.',
            snippet: '> Primo capoverso della citazione.\n>\n> Secondo capoverso della citazione.\n>> Citazione annidata.'
          },
          {
            title: 'Liste puntate e numerate',
            description: 'Le liste puntate usano -, * o +. Le liste numerate usano numero + punto. Per annidare, aggiungi quattro spazi.',
            snippet: '- Primo punto\n- Secondo punto\n    - Sotto-punto\n    - Altro sotto-punto\n\n1. Primo elemento\n2. Secondo elemento\n    1. Primo sotto-elemento\n    2. Secondo sotto-elemento'
          },
          {
            title: 'Codice inline',
            description: 'Per comandi, variabili, nomi file o frammenti brevi usa i backtick. È ideale per testo tecnico o operativo.',
            snippet: 'Usa `npm run build` per compilare il progetto.\nIl file `binder.json` contiene la struttura del binder.'
          },
          {
            title: 'Linee di separazione',
            description: 'Tre trattini, asterischi o underscore su una riga separata creano una divisione visiva tra sezioni.',
            snippet: 'Testo sopra\n\n---\n\nTesto sotto'
          },
          {
            title: 'Link e URL diretti',
            description: 'I link standard usano testo tra parentesi quadre e URL tra parentesi tonde. Gli URL possono anche essere scritti direttamente tra <>.',
            snippet: '[Liber Liber](https://www.liberliber.it)\n<https://www.liberliber.it>\n[Link con titolo](https://example.com "Titolo tooltip")'
          },
          {
            title: 'Immagini',
            description: 'Le immagini usano un punto esclamativo prima del link. Il testo alternativo è importante per accessibilità e export.',
            snippet: '![Descrizione immagine](immagini/copertina.jpg)\n\n_Didascalia immagine_\n\n![Logo Liber Liber](https://www.liberliber.it/online/wp-content/uploads/2017/03/logo_liberliber.png)'
          }
        ]
      },
      {
        title: 'Sintassi estesa',
        intro: 'Queste forme sono molto diffuse e utili. Il supporto può variare tra preview, export e lettori, ma in Pecie restano leggibili e produttive.',
        items: [
          {
            title: 'Note a piè di pagina',
            description: 'Inserisci un riferimento nel testo e poi la definizione della nota più sotto, lasciando aria tra blocchi diversi.',
            snippet: 'Qui c’è una nota[^1] dentro il testo.\n\n[^1]: Questa è la nota a piè di pagina.'
          },
          {
            title: 'Tabelle',
            description: 'Le tabelle usano | per separare le celle e una riga con almeno tre trattini per colonna. I due punti definiscono l’allineamento.',
            snippet: '| sinistra | centro | destra |\n| :--- | :---: | ---: |\n| pippo | pluto | topolino |\n| paperino | paperoga | paperone |'
          },
          {
            title: 'Apice e pedice',
            description: 'Alcuni processori Markdown supportano apice e pedice con ^ e ~. Sono utili in testi tecnici, scientifici e accademici.',
            snippet: 'X^2^\nH~2~O'
          },
          {
            title: 'Blocchi di codice',
            description: 'Tre backtick aprono e chiudono un blocco di codice. Se specifichi la lingua, molti renderer aggiungono evidenziazione sintattica.',
            snippet: '```json\n{\n  "firstName": "John",\n  "lastName": "Smith",\n  "age": 25\n}\n```\n\n```bash\nnpm run build\n```'
          },
          {
            title: 'Barrato, evidenziato e sottolineato',
            description: 'Il barrato usa ~~. L’evidenziato usa == se supportato dal renderer. La sottolineatura non è standard puro, ma in Pecie puoi usare HTML inline.',
            snippet: '~~testo barrato~~\n==testo evidenziato==\n<u>testo sottolineato</u>'
          },
          {
            title: 'Checklist operative',
            description: 'Le task list sono ottime per revisioni, checklist editoriali e progress tracking. Il supporto visivo dipende dal renderer finale.',
            snippet: '- [x] Bozza completata\n- [ ] Revisione stilistica\n- [ ] Verifica citazioni'
          },
          {
            title: 'Identificatori per le intestazioni',
            description: 'Alcuni processori permettono di assegnare un ID esplicito a un titolo. È utile per link interni, sommari e stile via CSS.',
            snippet: '## Titolo di esempio {#titolo-esempio}'
          },
          {
            title: 'Link alle intestazioni',
            description: 'Puoi collegarti a un titolo usando il suo ID esplicito oppure la sua forma slugificata.',
            snippet: '[Vai alla sezione](#titolo-esempio)\n[Vai al capitolo](#capitolo-1)'
          },
          {
            title: 'HTML inline e blocchi HTML',
            description: 'Quando il Markdown non basta, molti parser accettano HTML inline o a blocchi. È utile con cautela per markup specifico.',
            snippet: '<mark>testo marcato</mark>\n<small>nota editoriale</small>\n<div class="callout">Blocco HTML</div>'
          },
          {
            title: 'Escape dei caratteri speciali',
            description: 'Se vuoi mostrare simboli che Markdown normalmente interpreta, anteponi un backslash.',
            snippet: '\\\\ \\` \\* \\_ \\{ \\} \\[ \\] \\( \\) \\< \\> \\# \\+ \\. \\! \\|'
          }
        ]
      },
      {
        title: 'Note pratiche per usare Markdown in Pecie',
        items: [
          {
            title: 'Scrivere senza ricordare tutta la sintassi',
            description: 'La toolbar di Pecie inserisce heading, grassetto, corsivo, sottolineato, liste, citazioni, link, citazioni bibliografiche, note e tabelle. Puoi partire dai pulsanti e poi rifinire a mano.',
            snippet: '# Titolo inserito dalla toolbar\n\n**grassetto**\n\n[^nota]\n\n| Colonna | Valore |\n| --- | --- |'
          },
          {
            title: 'Quando usare Markdown puro e quando usare HTML',
            description: 'Per contenuti editoriali normali privilegia sempre Markdown puro. Usa HTML solo quando hai bisogno di un dettaglio non coperto dalla sintassi standard, come sottolineato o markup personalizzato.',
            snippet: 'Preferisci:\n**evidenza editoriale**\n\nUsa HTML solo se serve davvero:\n<u>sottolineato</u>'
          },
          {
            title: 'Compatibilità export',
            description: 'Titoli, liste, link, citazioni, note, tabelle e blocchi di codice sono le forme più affidabili. Evidenziato, apice, pedice, checklist, ID personalizzati e HTML dipendono di più dal formato finale o dal convertitore.',
            snippet: 'Supporto generalmente stabile:\n# Titoli\n- Liste\n[^1]\n| Tabelle | OK |\n\nSupporto da verificare nel formato finale:\n==Highlight==\nX^2^\n- [x] Task'
          },
          {
            title: 'Consiglio operativo',
            description: 'Se scrivi un testo lungo, usa titoli regolari, note a piè di pagina, tabelle semplici e link chiari. Se il contenuto deve andare in export multipli, evita markup troppo esotico salvo reale necessità.',
            snippet: '## Capitolo\n\nParagrafo introduttivo con nota[^1].\n\n### Dati\n| Campo | Valore |\n| --- | --- |\n| Stato | Verificato |'
          }
        ]
      }
    ],
    notes: [
      'Questa guida integra la sintassi Markdown più utile in Pecie, incluse varie estensioni diffuse. Non tutti i renderer supportano tutto allo stesso modo.',
      'Se punti a un export molto controllato, verifica sempre l’anteprima e fai un test sul formato finale scelto.'
    ]
  }
}

function getEnglishGuide(): MarkdownGuideContent {
  return {
    intro: [
      'Pecie works with plain text: you can write Markdown directly or use the toolbar above the editor. This guide covers the most useful Markdown patterns for writing, study, editorial work and long-form drafting.',
      'Core syntax is usually stable across preview and export. Extended syntax is still worth using, but support can vary depending on the target format.'
    ],
    sections: [
      {
        title: 'Core syntax',
        items: [
          {
            title: 'Headings',
            description: 'Use one to six # symbols followed by a space.',
            snippet: '# Heading 1\n## Heading 2\n### Heading 3'
          },
          {
            title: 'Bold, italic and combinations',
            description: 'Use ** for bold, _ or * for italic, and combine them when needed.',
            snippet: '**bold**\n_italic_\n**_bold and italic_**'
          },
          {
            title: 'Quotes, lists and inline code',
            description: 'Use > for blockquotes, - for bullets, 1. for numbered lists, and backticks for inline code.',
            snippet: '> Quote\n- Bullet\n1. Numbered\nUse `inline code` here.'
          },
          {
            title: 'Links and images',
            description: 'Links use [] and (), images add ! before the same structure.',
            snippet: '[Example](https://example.com)\n![Alt text](images/example.jpg)'
          }
        ]
      },
      {
        title: 'Extended syntax',
        items: [
          {
            title: 'Footnotes and tables',
            description: 'Useful for academic, technical and editorial projects.',
            snippet: 'A note[^1]\n\n[^1]: Footnote text.\n\n| Col A | Col B |\n| --- | --- |\n| One | Two |'
          },
          {
            title: 'Fenced code blocks',
            description: 'Use triple backticks, optionally with a language.',
            snippet: '```ts\nconst value = 42\n```'
          },
          {
            title: 'Highlight, strike, superscript and subscript',
            description: 'Support may vary by renderer or export target.',
            snippet: '~~strikethrough~~\n==highlight==\nX^2^\nH~2~O'
          },
          {
            title: 'Heading IDs and internal links',
            description: 'Some Markdown processors support explicit IDs for headings.',
            snippet: '## Sample heading {#sample-heading}\n[Jump to heading](#sample-heading)'
          }
        ]
      },
      {
        title: 'Using Markdown in Pecie',
        items: [
          {
            title: 'Toolbar support',
            description: 'Pecie can insert headings, emphasis, lists, quotes, links, citations, footnotes and tables for you.',
            snippet: '# Title\n\n**bold**\n\n[^note]\n\n| Column | Value |'
          },
          {
            title: 'Export compatibility',
            description: 'Core syntax is the safest. Extended syntax may depend on the final exporter or format.',
            snippet: 'Stable: headings, lists, links, tables, footnotes.\nCheck before final export: ==highlight==, X^2^, task lists.'
          }
        ]
      }
    ],
    notes: [
      'This guide focuses on the Markdown features most useful inside Pecie.',
      'If a document must export to multiple formats, test the final target before locking your markup choices.'
    ]
  }
}

type SidebarSection = {
  id: GuideCenterSection
  label: string
}

export function GuideCenterDialog({
  open,
  locale,
  initialSection,
  tutorialProgress,
  onStartTutorial,
  onResetTutorial,
  onClose
}: GuideCenterDialogProps): React.JSX.Element | null {
  const [activeSection, setActiveSection] = useState<GuideCenterSection>(initialSection)

  useEffect(() => {
    if (open) {
      setActiveSection(initialSection)
    }
  }, [initialSection, open])

  const markdownGuide = useMemo(() => (locale === 'it-IT' ? getItalianGuide() : getEnglishGuide()), [locale])
  const sidebarSections: SidebarSection[] = [
    { id: 'quick-start', label: t(locale, 'guideCenterSectionQuickStart') },
    { id: 'ui-tour', label: t(locale, 'guideCenterSectionUiTour') },
    { id: 'markdown-guide', label: t(locale, 'guideCenterSectionMarkdown') },
    { id: 'how-to', label: t(locale, 'guideCenterSectionHowTo') },
    { id: 'shortcuts', label: t(locale, 'guideCenterSectionShortcuts') }
  ]

  const homeSteps = Array.from({ length: 8 }, (_, index) => ({
    title: t(locale, `homeGuideStep${index + 1}Title`),
    body: t(locale, `homeGuideStep${index + 1}Body`)
  }))
  const checklist = Array.from({ length: 5 }, (_, index) => t(locale, `homeGuideChecklist${index + 1}`))
  const knowledgeBlocks = [
    { title: t(locale, 'guideBlockBinderTitle'), body: t(locale, 'guideBlockBinderBody') },
    { title: t(locale, 'guideBlockWorkspaceTitle'), body: t(locale, 'guideBlockWorkspaceBody') },
    { title: t(locale, 'guideBlockWritingHubTitle'), body: t(locale, 'guideBlockWritingHubBody') },
    { title: t(locale, 'guideBlockExportTitle'), body: t(locale, 'guideBlockExportBody') }
  ]
  const howToCards = [
    { title: t(locale, 'guideCenterHowToImageTitle'), body: t(locale, 'guideCenterHowToImageBody') },
    { title: t(locale, 'guideCenterHowToSupportTitle'), body: t(locale, 'guideCenterHowToSupportBody') },
    { title: t(locale, 'guideCenterHowToExportTitle'), body: t(locale, 'guideCenterHowToExportBody') },
    { title: t(locale, 'guideCenterHowToProjectsTitle'), body: t(locale, 'guideCenterHowToProjectsBody') }
  ]
  const shortcutGroups = [
    {
      title: t(locale, 'guideCenterShortcutsEditing'),
      items: [
        { label: t(locale, 'saveNow'), shortcut: 'Cmd/Ctrl+S' },
        { label: t(locale, 'markdownBold'), shortcut: 'Ctrl+B' },
        { label: t(locale, 'markdownItalic'), shortcut: 'Ctrl+I' },
        { label: t(locale, 'markdownLink'), shortcut: 'Ctrl+K' },
        { label: t(locale, 'markdownImage'), shortcut: 'Ctrl+Shift+I' },
        { label: t(locale, 'markdownTable'), shortcut: 'Ctrl+Alt+T' }
      ]
    },
    {
      title: t(locale, 'guideCenterShortcutsNavigation'),
      items: [
        { label: t(locale, 'editorViewWrite'), shortcut: 'Write' },
        { label: t(locale, 'editorViewPreview'), shortcut: 'Preview' },
        { label: t(locale, 'editorViewSplit'), shortcut: 'Split' },
        { label: t(locale, 'focusMode'), shortcut: 'Toggle chip' },
        { label: t(locale, 'typewriterMode'), shortcut: 'Toggle chip' }
      ]
    }
  ]
  const tutorialCards = [
    {
      id: 'launcher-basics',
      title: t(locale, 'tutorialLauncherTitle'),
      body: t(locale, 'tutorialLauncherBody')
    },
    {
      id: 'workspace-basics',
      title: t(locale, 'tutorialWorkspaceTitle'),
      body: t(locale, 'tutorialWorkspaceBody')
    },
    {
      id: 'timeline-basics',
      title: t(locale, 'tutorialTimelineTitle'),
      body: t(locale, 'tutorialTimelineBody')
    },
    {
      id: 'export-basics',
      title: t(locale, 'tutorialExportTitle'),
      body: t(locale, 'tutorialExportBody')
    }
  ]

  if (!open) {
    return null
  }

  return (
    <Dialog open={open} onClose={onClose} size="wide" icon="bi-compass" title={t(locale, 'guideCenterTitle')}>
      <div className="guide-center">
        <aside className="guide-center__sidebar" aria-label={t(locale, 'guideCenterSidebarLabel')}>
          {sidebarSections.map((section) => (
            <button
              aria-current={activeSection === section.id ? 'page' : undefined}
              className={`guide-center__nav-item${activeSection === section.id ? ' guide-center__nav-item--active' : ''}`}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              {section.label}
            </button>
          ))}
        </aside>

        <div className="guide-center__content">
          {activeSection === 'quick-start' ? (
            <div className="dialog-form">
              <section className="context-card context-card--soft guide-intro">
                <p>{t(locale, 'guideCenterQuickStartIntro')}</p>
                <p>{t(locale, 'homeGuideIntro')}</p>
              </section>

              <section className="guide-section">
                <div className="guide-section__header">
                  <h3>{t(locale, 'homeGuideFlowTitle')}</h3>
                  <p>{t(locale, 'homeGuideFlowBody')}</p>
                </div>
                <div className="guide-grid guide-grid--dense">
                  {homeSteps.map((step, index) => (
                    <article className="guide-card" key={step.title}>
                      <div className="stack-list stack-list--tight">
                        <h4>{`${index + 1}. ${step.title}`}</h4>
                        <p>{step.body}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="context-card">
                <h3>{t(locale, 'homeGuideChecklistTitle')}</h3>
                <p>{t(locale, 'homeGuideChecklistBody')}</p>
                <ul className="stack-list stack-list--tight">
                  {checklist.map((entry) => (
                    <li key={entry}>
                      <span>{entry}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}

          {activeSection === 'ui-tour' ? (
            <div className="dialog-form">
              <section className="context-card context-card--soft guide-intro">
                <p>{t(locale, 'guideCenterUiTourIntro')}</p>
              </section>
              <section className="guide-grid guide-grid--dense">
                {tutorialCards.map((tutorial) => {
                  const completed = tutorialProgress.completedTutorialIds.includes(tutorial.id)
                  const skipped = tutorialProgress.skippedTutorialIds.includes(tutorial.id)
                  const resumable = tutorialProgress.activeSession?.tutorialId === tutorial.id

                  return (
                    <article className="guide-card" key={tutorial.id}>
                      <div className="stack-list stack-list--tight">
                        <h4>{tutorial.title}</h4>
                        <p>{tutorial.body}</p>
                        <p>{completed ? t(locale, 'tutorialStatusCompleted') : resumable ? t(locale, 'tutorialStatusResumable') : t(locale, 'tutorialStatusNotStarted')}</p>
                        <div className="dialog-actions dialog-actions--inline">
                          <Button onClick={() => onStartTutorial(tutorial.id)} size="sm" type="button" variant="secondary">
                            {resumable ? t(locale, 'tutorialResume') : completed || skipped ? t(locale, 'tutorialReplay') : t(locale, 'openTutorial')}
                          </Button>
                          {completed || skipped || resumable ? (
                            <Button onClick={() => onResetTutorial(tutorial.id)} size="sm" type="button" variant="ghost">
                              {t(locale, 'tutorialReset')}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </section>
              <div className="guide-grid guide-grid--dense">
                {knowledgeBlocks.map((block) => (
                  <article className="guide-card" key={block.title}>
                    <h4>{block.title}</h4>
                    <p>{block.body}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {activeSection === 'markdown-guide' ? (
            <div className="dialog-form">
              <section className="context-card context-card--soft guide-intro">
                {markdownGuide.intro.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>

              <div className="guide-sections">
                {markdownGuide.sections.map((section) => (
                  <section className="guide-section" key={section.title}>
                    <div className="guide-section__header">
                      <h3>{section.title}</h3>
                      {section.intro ? <p>{section.intro}</p> : null}
                    </div>
                    <div className="guide-grid guide-grid--dense">
                      {section.items.map((item) => (
                        <article className="guide-card" key={`${section.title}-${item.title}`}>
                          <div className="stack-list stack-list--tight">
                            <h4>{item.title}</h4>
                            <p>{item.description}</p>
                          </div>
                          <div className="guide-example-pair">
                            <CopyableSnippet code={item.snippet} />
                            <div
                              className="guide-example-rendered"
                              dangerouslySetInnerHTML={{
                                __html: sanitizeRenderedMarkdown(marked.parse(item.snippet, { breaks: true, gfm: true }) as string)
                              }}
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <section className="context-card">
                <h3>{locale === 'it-IT' ? 'Note finali' : 'Final notes'}</h3>
                <ul className="stack-list stack-list--tight">
                  {markdownGuide.notes.map((note) => (
                    <li key={note}>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}

          {activeSection === 'how-to' ? (
            <div className="dialog-form">
              <section className="context-card context-card--soft guide-intro">
                <p>{t(locale, 'guideCenterHowToIntro')}</p>
              </section>
              <div className="guide-grid guide-grid--dense">
                {howToCards.map((card) => (
                  <article className="guide-card" key={card.title}>
                    <h4>{card.title}</h4>
                    <p>{card.body}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {activeSection === 'shortcuts' ? (
            <div className="dialog-form">
              <section className="context-card context-card--soft guide-intro">
                <p>{t(locale, 'guideCenterShortcutsIntro')}</p>
              </section>
              <div className="guide-grid guide-grid--dense">
                {shortcutGroups.map((group) => (
                  <section className="context-card" key={group.title}>
                    <div className="guide-section__header">
                      <h3>{group.title}</h3>
                    </div>
                    <div className="guide-shortcuts">
                      {group.items.map((item) => (
                        <div className="guide-shortcuts__item" key={`${group.title}-${item.label}`}>
                          <span>{item.label}</span>
                          <code>{item.shortcut}</code>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="dialog-actions dialog-actions--end">
        <Button onClick={onClose} size="sm" type="button" variant="ghost">
          {t(locale, 'cancel')}
        </Button>
      </div>
    </Dialog>
  )
}
