import type { BinderDocument, ProjectManifest, ProjectMetadata } from './generated/types.generated'
import { schemaRegistry } from './schema-registry'

export const validManifestFixture: ProjectManifest = {
  format: 'pecie-project',
  formatVersion: '1.0.0',
  projectId: 'project-demo-001',
  title: 'Tesi Magistrale in Filosofia',
  createdAt: '2026-04-07T09:00:00.000Z',
  appMinVersion: '0.1.0',
  historyMode: 'git-local',
  contentModel: 'markdown-frontmatter',
  cacheModel: 'sqlite-derived',
  defaultExportProfile: 'thesis-pdf',
  language: 'it-IT',
  privacyMode: 'local-first',
  embeddedHistory: true,
  a11yProfile: 'wcag22-aa',
  schemaUris: schemaRegistry
}

export const validProjectFixture: ProjectMetadata = {
  title: 'Tesi Magistrale in Filosofia',
  author: {
    name: 'Nome Cognome',
    role: 'student'
  },
  authors: [
    {
      id: 'author-primary',
      name: 'Nome Cognome',
      role: 'student',
      institutionName: 'Universita Esempio',
      department: 'Dipartimento di Filosofia',
      preferredLanguage: 'it-IT',
      addedAt: '2026-04-07T09:00:00.000Z',
      lastModifiedAt: '2026-04-07T09:00:00.000Z'
    }
  ],
  primaryAuthorId: 'author-primary',
  authorshipStats: [
    {
      authorId: 'author-primary',
      wordCount: 1200,
      percentage: 100
    }
  ],
  institution: {
    name: 'Universita Esempio',
    department: 'Dipartimento di Filosofia'
  },
  documentKind: 'thesis',
  defaultLanguage: 'it-IT',
  defaultBibliographyStyle: 'apa',
  projectVisibility: 'private-local',
  containsSensitiveData: true
}

export const validBinderFixture: BinderDocument = {
  rootId: 'root',
  nodes: [
    { id: 'root', type: 'folder', title: 'Progetto', children: ['manuscript', 'research'] },
    {
      id: 'manuscript',
      type: 'folder',
      title: 'Manoscritto',
      children: ['intro']
    },
    {
      id: 'intro',
      type: 'document',
      title: 'Introduzione',
      path: 'docs/chapters/introduzione.md',
      documentId: 'doc-001'
    },
    { id: 'research', type: 'folder', title: 'Ricerca', children: [] }
  ]
}

export const invalidManifestFixture = {
  title: ''
}
