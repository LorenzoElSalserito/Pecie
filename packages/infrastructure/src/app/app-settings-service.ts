import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  AppBootstrapResponse,
  AppSettings,
  AuthorProfile,
  BinderDocument,
  BinderNode,
  SaveAppSettingsRequest,
  SaveAppSettingsResponse,
  SupportedLocale
} from '@pecie/schemas'
import { validateBinderDocument } from '@pecie/schemas'

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
