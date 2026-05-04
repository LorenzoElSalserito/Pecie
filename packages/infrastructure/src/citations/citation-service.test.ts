import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ProjectFileSystem } from '../fs/project-file-system'
import { AppLoggerService } from '../logging/app-logger-service'
import { GitAdapter } from '../history/git-adapter'
import { HistoryService } from '../history/history-service'
import { ProjectService } from '../project/project-service'
import { CitationService } from './citation-service'

const noopIndexAdapter = {
  initialize: () => undefined,
  upsert: () => undefined,
  upsertAttachment: () => undefined,
  removeAttachment: () => undefined,
  remove: () => undefined,
  search: () => ({ nodes: [], content: [], attachments: [] })
}

describe('CitationService', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { force: true, recursive: true })))
  })

  it('loads BibTeX and CSL JSON sources through the default citation profile', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-citation-service-'))
    cleanupPaths.push(baseDirectory)

    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(baseDirectory)
    const historyService = new HistoryService(fileSystem, new GitAdapter(), logger)
    const projectService = new ProjectService(fileSystem, noopIndexAdapter, logger, historyService)
    const citationService = new CitationService(fileSystem)

    const project = await projectService.createProject({
      directory: baseDirectory,
      projectName: 'citations-demo',
      title: 'Citations Demo',
      language: 'it-IT',
      template: 'paper',
      authorProfile: {
        name: 'Fixture Author',
        role: 'researcher',
        preferredLanguage: 'it-IT'
      }
    })

    await fileSystem.writeText(
      project.projectPath,
      'citations/references.bib',
      `@book{doe2024,
  title = {Understanding Pecie},
  author = {Doe, Jane and Smith, John},
  year = {2024},
  publisher = {Open Library}
}
`
    )
    await fileSystem.writeText(
      project.projectPath,
      'citations/additional.json',
      JSON.stringify([
        {
          id: 'rossi2023',
          title: 'Studio sulle interfacce editoriali',
          author: [{ family: 'Rossi', given: 'Maria' }],
          issued: { 'date-parts': [[2023, 6, 14]] },
          'container-title': 'Rivista di UX'
        }
      ])
    )
    await fileSystem.writeJson(project.projectPath, 'citations/profiles/default.json', {
      id: 'default',
      schemaVersion: 1,
      label: 'Default citation profile',
      bibliographySources: ['citations/references.bib', 'citations/additional.json'],
      citationStyle: 'citations/csl/apa.csl',
      locale: 'it-IT',
      linkCitations: false,
      suppressBibliography: false,
      bibliographyTitle: {
        'it-IT': 'Bibliografia'
      }
    })

    const loaded = await citationService.loadLibrary({
      projectPath: project.projectPath
    })

    expect(loaded.library.profile.id).toBe('default')
    expect(loaded.library.entries.map((entry) => entry.citeKey)).toEqual(['doe2024', 'rossi2023'])
    expect(loaded.library.entries[0]?.authorsShort).toBe('Doe & Smith')
    expect(loaded.library.entries[1]?.year).toBe(2023)
    expect(loaded.library.diagnostics).toHaveLength(0)
  })

  it('suggests citekeys by prefix and title', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-citation-suggest-'))
    cleanupPaths.push(baseDirectory)

    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(baseDirectory)
    const historyService = new HistoryService(fileSystem, new GitAdapter(), logger)
    const projectService = new ProjectService(fileSystem, noopIndexAdapter, logger, historyService)
    const citationService = new CitationService(fileSystem)

    const project = await projectService.createProject({
      directory: baseDirectory,
      projectName: 'citations-suggest',
      title: 'Citations Suggest',
      language: 'en-US',
      template: 'paper',
      authorProfile: {
        name: 'Fixture Author',
        role: 'researcher',
        preferredLanguage: 'en-US'
      }
    })

    await fileSystem.writeText(
      project.projectPath,
      'citations/references.bib',
      `@article{miller2022,
  title = {Preview engines for editorial tools},
  author = {Miller, Ada},
  year = {2022},
  journal = {Journal of Tooling}
}
@article{garcia2021,
  title = {Shared packages in academic writing},
  author = {Garcia, Luis},
  year = {2021},
  journal = {Publishing Systems}
}
`
    )

    const suggestions = await citationService.suggest({
      projectPath: project.projectPath,
      prefix: 'prev',
      limit: 5
    })

    expect(suggestions.suggestions).toHaveLength(1)
    expect(suggestions.suggestions[0]?.citeKey).toBe('miller2022')
    expect(suggestions.suggestions[0]?.displayTitle).toContain('Preview engines')
  })

  it('lists profiles and persists the project default profile binding', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-citation-profiles-'))
    cleanupPaths.push(baseDirectory)

    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(baseDirectory)
    const historyService = new HistoryService(fileSystem, new GitAdapter(), logger)
    const projectService = new ProjectService(fileSystem, noopIndexAdapter, logger, historyService)
    const citationService = new CitationService(fileSystem)

    const project = await projectService.createProject({
      directory: baseDirectory,
      projectName: 'citations-profiles',
      title: 'Citations Profiles',
      language: 'en-US',
      template: 'paper',
      authorProfile: {
        name: 'Fixture Author',
        role: 'researcher',
        preferredLanguage: 'en-US'
      }
    })

    await citationService.saveProfile({
      projectPath: project.projectPath,
      profile: {
        id: 'thesis-main',
        schemaVersion: 1,
        label: 'Thesis Main',
        bibliographySources: ['citations/references.bib'],
        citationStyle: 'citations/csl/apa.csl',
        locale: 'en-US',
        linkCitations: false,
        suppressBibliography: false
      },
      setAsDefault: true
    })

    const listed = await citationService.listProfiles({
      projectPath: project.projectPath
    })

    expect(listed.defaultProfileId).toBe('thesis-main')
    expect(listed.profiles.map((profile) => profile.id)).toContain('thesis-main')
    expect(listed.profiles.find((profile) => profile.id === 'thesis-main')?.isDefault).toBe(true)

    const updatedProject = await fileSystem.readJson<{ defaultCitationProfileId?: string }>(project.projectPath, 'project.json')
    expect(updatedProject.defaultCitationProfileId).toBe('thesis-main')
  })

  it('loads the project default citation profile when no explicit profile id is provided', async () => {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-citation-default-binding-'))
    cleanupPaths.push(baseDirectory)

    const fileSystem = new ProjectFileSystem()
    const logger = new AppLoggerService(baseDirectory)
    const historyService = new HistoryService(fileSystem, new GitAdapter(), logger)
    const projectService = new ProjectService(fileSystem, noopIndexAdapter, logger, historyService)
    const citationService = new CitationService(fileSystem)

    const project = await projectService.createProject({
      directory: baseDirectory,
      projectName: 'citations-default-binding',
      title: 'Citations Default Binding',
      language: 'en-US',
      template: 'paper',
      authorProfile: {
        name: 'Fixture Author',
        role: 'researcher',
        preferredLanguage: 'en-US'
      }
    })

    await fileSystem.writeText(
      project.projectPath,
      'citations/references-alt.bib',
      `@article{smith2025,
  title = {Bound profiles},
  author = {Smith, Ada},
  year = {2025},
  journal = {Citation Systems}
}
`
    )

    await citationService.saveProfile({
      projectPath: project.projectPath,
      profile: {
        id: 'alt',
        schemaVersion: 1,
        label: 'Alt Profile',
        bibliographySources: ['citations/references-alt.bib'],
        citationStyle: 'citations/csl/apa.csl',
        locale: 'en-US',
        linkCitations: false,
        suppressBibliography: false
      },
      setAsDefault: true
    })

    const loaded = await citationService.loadLibrary({
      projectPath: project.projectPath
    })

    expect(loaded.library.profile.id).toBe('alt')
    expect(loaded.library.entries.map((entry) => entry.citeKey)).toEqual(['smith2025'])
  })
})
