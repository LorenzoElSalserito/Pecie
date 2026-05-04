import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  AppBootstrapResponse,
  AppSettings,
  AuthorProfile,
  BinderDocument,
  BinderNode,
  GetPreviewModeResponse,
  SetPreviewModeRequest,
  SetPreviewModeResponse,
  SaveAppSettingsRequest,
  SaveAppSettingsResponse,
  SupportedLocale
} from '@pecie/schemas'
import { validateBinderDocument } from '@pecie/schemas'
import type { PreviewMode } from '@pecie/schemas'

import { ProjectFileSystem } from '../fs/project-file-system'

const SETTINGS_FILENAME = 'app-settings.json'
export class AppSettingsService {
  private readonly fileSystem = new ProjectFileSystem()

  public constructor(
    private readonly userDataDirectory: string,
    private readonly documentsDirectory: string,
    private readonly systemLocale: string
  ) {}

  public async bootstrap(): Promise<AppBootstrapResponse> {
    const settingsPath = this.getSettingsPath()
    const fileExists = await access(settingsPath)
      .then(() => true)
      .catch(() => false)

    const defaults = {
      documentsDirectory: this.documentsDirectory,
      defaultWorkspaceDirectory: path.join(this.documentsDirectory, 'Pecie'),
      appDataDirectory: this.userDataDirectory
    }

    const savedSettings = fileExists ? ((await this.readSettings()) ?? undefined) : undefined
    const settings = this.normalizeSettings(savedSettings)

    await mkdir(settings.workspaceDirectory, { recursive: true })
    await this.persist(settings)

    return {
      settings,
      defaults,
      firstRun: !fileExists || !settings.authorProfile.name.trim(),
      quickResume: await this.loadQuickResume(settings.recentProjectPaths[0])
    }
  }

  public async saveSettings(input: SaveAppSettingsRequest): Promise<SaveAppSettingsResponse> {
    const settings = this.normalizeSettings(input.settings)
    await mkdir(settings.workspaceDirectory, { recursive: true })
    await this.persist(settings)
    return { settings }
  }

  public async getPreviewMode(): Promise<GetPreviewModeResponse> {
    const settings = this.normalizeSettings((await this.readSettings()) ?? undefined)
    return {
      mode: settings.preview.mode,
      disclosuresSeen: settings.preview.disclosuresSeen
    }
  }

  public async setPreviewMode(input: SetPreviewModeRequest): Promise<SetPreviewModeResponse> {
    const current = this.normalizeSettings((await this.readSettings()) ?? undefined)
    const mode = this.normalizePreviewMode(input.mode)
    const settings: AppSettings = {
      ...current,
      preview: {
        ...current.preview,
        mode,
        disclosuresSeen: input.markDisclosureSeen
          ? {
              ...current.preview.disclosuresSeen,
              [mode]: true
            }
          : current.preview.disclosuresSeen
      }
    }
    await this.persist(settings)
    return {
      mode,
      settings
    }
  }

  public async rememberProject(projectPath: string): Promise<void> {
    const current = (await this.readSettings()) ?? this.normalizeSettings()
    const projectDirectory = path.dirname(projectPath)
    const recentProjectPaths = [projectPath, ...(current.recentProjectPaths ?? []).filter((item) => item !== projectPath)]

    await this.persist(
      this.normalizeSettings({
        ...current,
        workspaceDirectory: projectDirectory,
        recentProjectPaths,
        archivedProjectPaths: (current.archivedProjectPaths ?? []).filter((item) => item !== projectPath)
      })
    )
  }

  public async archiveProject(projectPath: string, archivedPath: string): Promise<void> {
    const current = (await this.readSettings()) ?? this.normalizeSettings()
    await this.persist(
      this.normalizeSettings({
        ...current,
        recentProjectPaths: (current.recentProjectPaths ?? []).filter((item) => item !== projectPath),
        archivedProjectPaths: [archivedPath, ...(current.archivedProjectPaths ?? []).filter((item) => item !== archivedPath)]
      })
    )
  }

  public async restoreProject(projectPath: string, restoredPath: string): Promise<void> {
    const current = (await this.readSettings()) ?? this.normalizeSettings()
    await this.persist(
      this.normalizeSettings({
        ...current,
        archivedProjectPaths: (current.archivedProjectPaths ?? []).filter((item) => item !== projectPath),
        recentProjectPaths: [restoredPath, ...(current.recentProjectPaths ?? []).filter((item) => item !== restoredPath)]
      })
    )
  }

  public async removeProject(projectPath: string): Promise<void> {
    const current = (await this.readSettings()) ?? this.normalizeSettings()
    await this.persist(
      this.normalizeSettings({
        ...current,
        recentProjectPaths: (current.recentProjectPaths ?? []).filter((item) => item !== projectPath),
        archivedProjectPaths: (current.archivedProjectPaths ?? []).filter((item) => item !== projectPath)
      })
    )
  }

  private async readSettings(): Promise<Partial<AppSettings> | null> {
    try {
      const raw = await readFile(this.getSettingsPath(), 'utf8')
      return JSON.parse(raw) as Partial<AppSettings>
    } catch {
      return null
    }
  }

  private normalizeSettings(candidate?: Partial<AppSettings>): AppSettings {
    const locale = this.normalizeLocale(candidate?.locale ?? candidate?.authorProfile?.preferredLanguage ?? 'en-US')
    const authorProfile = this.normalizeAuthorProfile(candidate?.authorProfile, locale)

    return {
      workspaceDirectory: candidate?.workspaceDirectory?.trim() || path.join(this.documentsDirectory, 'Pecie'),
      locale,
      theme: candidate?.theme === 'light' || candidate?.theme === 'dark' || candidate?.theme === 'system'
        ? candidate.theme
        : 'system',
      fontPreference: candidate?.fontPreference === 'dyslexic' ? 'dyslexic' : 'classic',
      uiZoom:
        candidate?.uiZoom === 50 ||
        candidate?.uiZoom === 75 ||
        candidate?.uiZoom === 100 ||
        candidate?.uiZoom === 125 ||
        candidate?.uiZoom === 150
          ? candidate.uiZoom
          : 100,
      expertModeEnabled: candidate?.expertModeEnabled === true,
      recentProjectPaths: Array.isArray(candidate?.recentProjectPaths)
        ? candidate.recentProjectPaths.filter((item): item is string => typeof item === 'string')
        : [],
      archivedProjectPaths: Array.isArray(candidate?.archivedProjectPaths)
        ? candidate.archivedProjectPaths.filter((item): item is string => typeof item === 'string')
        : [],
      authorProfile: {
        ...authorProfile,
        preferredLanguage: locale
      },
      preview: {
        mode: this.normalizePreviewMode(candidate?.preview?.mode),
        disclosuresSeen:
          candidate?.preview?.disclosuresSeen && typeof candidate.preview.disclosuresSeen === 'object'
            ? {
                'ultra-performance': Boolean(candidate.preview.disclosuresSeen['ultra-performance']),
                performance: Boolean(candidate.preview.disclosuresSeen.performance),
                full: Boolean(candidate.preview.disclosuresSeen.full)
              }
            : {},
        pageMarkers: {
          byProjectAndProfile:
            candidate?.preview?.pageMarkers?.byProjectAndProfile &&
            typeof candidate.preview.pageMarkers.byProjectAndProfile === 'object'
              ? Object.fromEntries(
                  Object.entries(candidate.preview.pageMarkers.byProjectAndProfile).flatMap(([key, value]) => {
                    if (!value || typeof value !== 'object') {
                      return []
                    }
                    const projectId = typeof value.projectId === 'string' ? value.projectId.trim() : ''
                    const profileId = typeof value.profileId === 'string' ? value.profileId.trim() : ''
                    if (!projectId || !profileId) {
                      return []
                    }
                    return [
                      [
                        key,
                        {
                          projectId,
                          profileId,
                          showPageMarkers: value.showPageMarkers !== false
                        }
                      ]
                    ]
                  })
                )
              : {}
        },
        exportPreview: {
          byProfile:
            candidate?.preview?.exportPreview?.byProfile && typeof candidate.preview.exportPreview.byProfile === 'object'
              ? Object.fromEntries(
                  Object.entries(candidate.preview.exportPreview.byProfile).flatMap(([key, value]) => {
                    if (!value || typeof value !== 'object') {
                      return []
                    }

                    const profileId = typeof value.profileId === 'string' ? value.profileId.trim() : ''
                    if (!profileId) {
                      return []
                    }

                    const lastDisclosureShownForMode =
                      value.lastDisclosureShownForMode === 'ultra-performance' ||
                      value.lastDisclosureShownForMode === 'performance' ||
                      value.lastDisclosureShownForMode === 'full'
                        ? value.lastDisclosureShownForMode
                        : null

                    return [
                      [
                        key,
                        {
                          profileId,
                          showPreviewBeforeSave: value.showPreviewBeforeSave === true,
                          lastDisclosureShownForMode
                        }
                      ]
                    ]
                  })
                )
              : {},
          globalDefault: false
        }
      },
      tutorialProgress: {
        completedTutorialIds: Array.isArray(candidate?.tutorialProgress?.completedTutorialIds)
          ? candidate.tutorialProgress.completedTutorialIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : [],
        skippedTutorialIds: Array.isArray(candidate?.tutorialProgress?.skippedTutorialIds)
          ? candidate.tutorialProgress.skippedTutorialIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : [],
        lastTutorialId:
          typeof candidate?.tutorialProgress?.lastTutorialId === 'string' && candidate.tutorialProgress.lastTutorialId.trim().length > 0
            ? candidate.tutorialProgress.lastTutorialId.trim()
            : undefined,
        activeSession:
          candidate?.tutorialProgress?.activeSession &&
          typeof candidate.tutorialProgress.activeSession === 'object' &&
          typeof candidate.tutorialProgress.activeSession.tutorialId === 'string' &&
          candidate.tutorialProgress.activeSession.tutorialId.trim().length > 0 &&
          Number.isInteger(candidate.tutorialProgress.activeSession.stepIndex) &&
          candidate.tutorialProgress.activeSession.stepIndex >= 0 &&
          (candidate.tutorialProgress.activeSession.status === 'running' ||
            candidate.tutorialProgress.activeSession.status === 'paused')
            ? {
                tutorialId: candidate.tutorialProgress.activeSession.tutorialId.trim(),
                stepIndex: candidate.tutorialProgress.activeSession.stepIndex,
                status: candidate.tutorialProgress.activeSession.status
              }
            : undefined
      },
      onboardingCompleted: Boolean(candidate?.onboardingCompleted)
    }
  }

  private normalizeAuthorProfile(candidate: Partial<AuthorProfile> | undefined, locale: SupportedLocale): AuthorProfile {
    return {
      name: candidate?.name?.trim() || '',
      role:
        candidate?.role === 'researcher' ||
        candidate?.role === 'writer' ||
        candidate?.role === 'editor' ||
        candidate?.role === 'author'
          ? candidate.role
          : 'student',
      institutionName: candidate?.institutionName?.trim() || undefined,
      department: candidate?.department?.trim() || undefined,
      preferredLanguage: this.normalizeLocale(candidate?.preferredLanguage ?? locale)
    }
  }

  private normalizeLocale(locale: string): SupportedLocale {
    const normalizedLocale = locale.toLowerCase()

    if (normalizedLocale.startsWith('it')) {
      return 'it-IT'
    }
    if (normalizedLocale.startsWith('en')) {
      return 'en-US'
    }
    if (normalizedLocale.startsWith('de')) {
      return 'de-DE'
    }
    if (normalizedLocale.startsWith('es')) {
      return 'es-ES'
    }
    if (normalizedLocale.startsWith('fr')) {
      return 'fr-FR'
    }
    if (normalizedLocale.startsWith('pt')) {
      return 'pt-PT'
    }

    return 'en-US'
  }

  private normalizePreviewMode(mode: string | undefined): PreviewMode {
    return mode === 'ultra-performance' || mode === 'full' ? mode : 'performance'
  }

  private async persist(settings: AppSettings): Promise<void> {
    await mkdir(this.userDataDirectory, { recursive: true })
    await writeFile(this.getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8')
  }

  private async loadQuickResume(projectPath?: string): Promise<AppBootstrapResponse['quickResume']> {
    if (!projectPath) {
      return undefined
    }

    try {
      this.fileSystem.assertProjectPath(projectPath)
      const binder = validateBinderDocument(await this.fileSystem.readJson<BinderDocument>(projectPath, 'binder.json'))
      const latestDocument = await this.findLatestEditedDocument(projectPath, binder.nodes)

      if (!latestDocument) {
        return undefined
      }

      const rawDocument = await this.fileSystem.readText(projectPath, latestDocument.path)
      const snippet = this.createSnippet(rawDocument)
      if (!snippet) {
        return undefined
      }

      return {
        projectPath,
        lastEditedSnippet: snippet,
        lastEditedAt: latestDocument.lastEditedAt
      }
    } catch {
      return undefined
    }
  }

  private async findLatestEditedDocument(
    projectPath: string,
    nodes: BinderNode[]
  ): Promise<{ path: string; lastEditedAt: string } | null> {
    const documents = await Promise.all(
      nodes
        .filter((node): node is BinderNode & { path: string } => node.type === 'document' && typeof node.path === 'string')
        .map(async (node) => {
          try {
            const stats = await this.fileSystem.statEntry(projectPath, node.path)
            return {
              path: node.path,
              lastEditedAt: stats.mtime.toISOString(),
              timestamp: stats.mtime.getTime()
            }
          } catch {
            return null
          }
        })
    )

    const latestDocument = documents
      .filter((document): document is { path: string; lastEditedAt: string; timestamp: number } => document !== null)
      .sort((left, right) => right.timestamp - left.timestamp)[0]

    return latestDocument
      ? {
          path: latestDocument.path,
          lastEditedAt: latestDocument.lastEditedAt
        }
      : null
  }

  private createSnippet(rawDocument: string): string {
    const body = rawDocument
      .replace(/^---\s*\n[\s\S]*?\n---\s*/u, '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/`{1,3}[^`]*`{1,3}/g, ' ')
      .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
      .replace(/\[[^\]]*]\([^)]+\)/g, ' ')
      .replace(/[#>*_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return body.slice(0, 80).trim()
  }

  private getSettingsPath(): string {
    return path.join(this.userDataDirectory, SETTINGS_FILENAME)
  }
}
