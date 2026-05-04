import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'

import type {
  CreateSharePackageRequest,
  CreateSharePackageResponse,
  ImportSharePackageRequest,
  ImportSharePackageResponse,
  PreviewSharePackageRequest,
  PreviewSharePackageResponse,
  ShareIncludeKind,
  SharePackageManifest
} from '@pecie/schemas'
import { shareImportModes, shareIncludeModes, validateManifest, validateSharePackageManifest } from '@pecie/schemas'

import { ProjectFileSystem } from '../fs/project-file-system'

const execFileAsync = promisify(execFile)

const EXCLUDED_PATHS = ['cache', 'logs', 'exports/out']
const PACKAGE_ROOT = 'package'
const PACKAGE_MANIFEST_PATH = 'share-package-manifest.json'
const PACKAGE_GIT_BUNDLE_PATH = 'history/project.bundle'

export class ShareService {
  public constructor(private readonly fileSystem: ProjectFileSystem = new ProjectFileSystem()) {}

  public async previewPackage(input: PreviewSharePackageRequest): Promise<PreviewSharePackageResponse> {
    return {
      manifest: await this.buildManifest(input.projectPath, input.include, input.selectedMilestoneIds ?? [])
    }
  }

  public async createPackage(input: CreateSharePackageRequest): Promise<CreateSharePackageResponse> {
    const manifest = await this.buildManifest(input.projectPath, input.include, input.selectedMilestoneIds ?? [])
    const stagingRoot = await mkdtemp(path.join(tmpdir(), 'pecie-share-stage-'))
    const packageRoot = path.join(stagingRoot, PACKAGE_ROOT)

    try {
      await cp(input.projectPath, packageRoot, {
        recursive: true,
        filter: (source) => this.shouldCopyPath(input.projectPath, source, manifest.include)
      })

      if (this.shouldIncludeHistory(manifest.include)) {
        await mkdir(path.join(packageRoot, 'history'), { recursive: true })
        await execFileAsync('git', ['bundle', 'create', path.join(packageRoot, PACKAGE_GIT_BUNDLE_PATH), '--all'], {
          cwd: input.projectPath
        })
      }

      await writeFile(path.join(stagingRoot, PACKAGE_MANIFEST_PATH), JSON.stringify(manifest, null, 2), 'utf8')
      await mkdir(path.dirname(input.outputPath), { recursive: true })
      await execFileAsync('tar', ['-czf', input.outputPath, '-C', stagingRoot, PACKAGE_MANIFEST_PATH, PACKAGE_ROOT])

      return {
        manifest,
        outputPath: input.outputPath
      }
    } finally {
      await rm(stagingRoot, { recursive: true, force: true })
    }
  }

  public async importPackage(input: ImportSharePackageRequest): Promise<ImportSharePackageResponse> {
    const stagingRoot = await mkdtemp(path.join(tmpdir(), 'pecie-share-import-'))

    try {
      await execFileAsync('tar', ['-xzf', input.packagePath, '-C', stagingRoot])
      const manifest = validateSharePackageManifest(
        JSON.parse(await readFile(path.join(stagingRoot, PACKAGE_MANIFEST_PATH), 'utf8')) as unknown
      )
      const extractedProjectPath = path.join(stagingRoot, PACKAGE_ROOT)
      const projectManifest = validateManifest(
        JSON.parse(await readFile(path.join(extractedProjectPath, 'manifest.json'), 'utf8')) as unknown
      )

      const baseName = this.slugify(projectManifest.title || manifest.projectTitle || 'shared-project')
      const projectPath = await this.getAvailableProjectPath(input.workspaceDirectory, `${baseName}.pe`)
      await cp(extractedProjectPath, projectPath, { recursive: true })

      if (shareImportModes[input.mode].createsNewProjectId) {
        const nextManifest = {
          ...projectManifest,
          projectId: `${projectManifest.projectId}-shared-${randomUUID().slice(0, 8)}`
        }
        await this.fileSystem.writeJson(projectPath, 'manifest.json', nextManifest)
      }

      const bundlePath = path.join(projectPath, PACKAGE_GIT_BUNDLE_PATH)
      if (shareImportModes[input.mode].includesHistory && manifest.gitBundlePath) {
        await this.restoreGitHistory(projectPath, bundlePath)
      } else {
        await this.fileSystem.deleteEntry(projectPath, '.git')
        await this.initializeSnapshotHistory(projectPath)
      }

      await this.fileSystem.deleteEntry(projectPath, PACKAGE_GIT_BUNDLE_PATH)

      return {
        manifest,
        projectPath
      }
    } finally {
      await rm(stagingRoot, { recursive: true, force: true })
    }
  }

  private async buildManifest(
    projectPath: string,
    include: ShareIncludeKind,
    selectedMilestoneIds: string[]
  ): Promise<SharePackageManifest> {
    const manifest = validateManifest(await this.fileSystem.readJson(projectPath, 'manifest.json'))
    const privacyWarnings: SharePackageManifest['privacyWarnings'] = [
      { code: 'share.warning.localOnly', severity: 'info' },
      { code: 'share.warning.excludedDerived', severity: 'info' }
    ]

    if (include === 'current-plus-full-history' || include === 'current-plus-selected-milestones') {
      privacyWarnings.push({ code: 'share.warning.historyIncluded', severity: 'critical' })
    } else if (include === 'current-plus-timeline-meta') {
      privacyWarnings.push({ code: 'share.warning.timelineMetaIncluded', severity: 'warning' })
    }

    return {
      sharePackageVersion: '1.0.0',
      projectId: manifest.projectId,
      projectTitle: manifest.title,
      createdAt: new Date().toISOString(),
      include,
      selectedMilestoneIds,
      privacyWarnings,
      excludedPaths: EXCLUDED_PATHS,
      gitBundlePath: shareIncludeModes[include].includesHistory ? PACKAGE_GIT_BUNDLE_PATH : undefined
    }
  }

  private shouldIncludeHistory(include: ShareIncludeKind): boolean {
    return shareIncludeModes[include].includesHistory
  }

  private shouldCopyPath(projectPath: string, sourcePath: string, include: ShareIncludeKind): boolean {
    const relativePath = path.relative(projectPath, sourcePath).replace(/\\/g, '/')
    if (!relativePath || relativePath === '.') {
      return true
    }

    if (relativePath === '.git' || relativePath.startsWith('.git/')) {
      return false
    }

    if (EXCLUDED_PATHS.some((excludedPath) => relativePath === excludedPath || relativePath.startsWith(`${excludedPath}/`))) {
      return false
    }

    if (include === 'current-only' && (relativePath === 'history' || relativePath.startsWith('history/'))) {
      return false
    }

    if (
      include === 'current-plus-timeline-meta' &&
      (relativePath === 'history' || relativePath.startsWith('history/')) &&
      !relativePath.endsWith('timeline.json') &&
      !relativePath.endsWith('milestones.json')
    ) {
      return false
    }

    return true
  }

  private async restoreGitHistory(projectPath: string, bundlePath: string): Promise<void> {
    const tempCloneDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-share-history-clone-'))
    try {
      await execFileAsync('git', ['clone', bundlePath, tempCloneDirectory], { cwd: projectPath })
      await this.fileSystem.deleteEntry(projectPath, '.git')
      await cp(path.join(tempCloneDirectory, '.git'), path.join(projectPath, '.git'), { recursive: true })
    } finally {
      await rm(tempCloneDirectory, { recursive: true, force: true })
    }
  }

  private async initializeSnapshotHistory(projectPath: string): Promise<void> {
    await execFileAsync('git', ['init'], { cwd: projectPath })
    await execFileAsync('git', ['add', '.'], { cwd: projectPath })
    await execFileAsync('git', ['commit', '--allow-empty', '-m', 'share: imported snapshot'], {
      cwd: projectPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Pecie',
        GIT_AUTHOR_EMAIL: 'local@pecie.app',
        GIT_COMMITTER_NAME: 'Pecie',
        GIT_COMMITTER_EMAIL: 'local@pecie.app'
      }
    })
  }

  private async getAvailableProjectPath(directory: string, desiredName: string): Promise<string> {
    let attempt = 0

    while (true) {
      const candidateName =
        attempt === 0 ? desiredName : `${path.basename(desiredName, '.pe')}-${attempt.toString().padStart(2, '0')}.pe`
      const candidate = path.join(directory, candidateName)
      const exists = await stat(candidate).then(() => true).catch(() => false)
      if (!exists) {
        return candidate
      }
      attempt += 1
    }
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
}
