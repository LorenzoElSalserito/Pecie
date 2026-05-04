import { access, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import type {
  GetPrivacyInventoryRequest,
  PrivacyInventoryItem,
  PrivacyInventoryResponse,
  RunMaintenanceRequest,
  RunMaintenanceResponse
} from '@pecie/schemas'
import { privacyMaintenanceActions } from '@pecie/schemas'

import { ProjectFileSystem } from '../fs/project-file-system'
import { AppLoggerService } from '../logging/app-logger-service'
import { ProjectService } from '../project/project-service'

type InventoryDescriptor = Omit<PrivacyInventoryItem, 'id' | 'relativePath' | 'sizeBytes'> & {
  absolutePath: string
  relativePath: string
}

export class PrivacyService {
  public constructor(
    private readonly userDataDirectory: string,
    private readonly fileSystem: ProjectFileSystem = new ProjectFileSystem(),
    private readonly projectService?: ProjectService,
    private readonly logger?: AppLoggerService
  ) {}

  public async getInventory(input: GetPrivacyInventoryRequest): Promise<PrivacyInventoryResponse> {
    const descriptors = await this.collectDescriptors(input)
    const mappedItems = await Promise.all(
      descriptors.map(async (descriptor, index): Promise<PrivacyInventoryItem | null> => {
        const sizeBytes = await this.getPathSize(descriptor.absolutePath)
        if (sizeBytes <= 0) {
          return null
        }

        return {
          id: `${descriptor.source}-${descriptor.category}-${index}`,
          category: descriptor.category,
          label: descriptor.label,
          relativePath: descriptor.relativePath,
          sizeBytes,
          containsSensitiveData: descriptor.containsSensitiveData,
          deletable: descriptor.deletable,
          source: descriptor.source,
          ...(descriptor.maintenanceAction ? { maintenanceAction: descriptor.maintenanceAction } : {}),
          ...(descriptor.descriptionKey ? { descriptionKey: descriptor.descriptionKey } : {})
        }
      })
    )
    const items = mappedItems.filter((item): item is PrivacyInventoryItem => item !== null)

    return {
      generatedAt: new Date().toISOString(),
      items,
      totals: {
        sizeBytes: items.reduce((total, item) => total + item.sizeBytes, 0),
        sensitiveItems: items.filter((item) => item.containsSensitiveData).length,
        deletableItems: items.filter((item) => item.deletable).length
      }
    }
  }

  public async runMaintenance(input: RunMaintenanceRequest): Promise<RunMaintenanceResponse> {
    const actionDefinition = privacyMaintenanceActions[input.action]
    if (actionDefinition.requiresProject && !input.projectPath) {
      throw new Error('Questa azione richiede un progetto aperto.')
    }

    const targets = await this.resolveMaintenanceTargets(input)
    const beforeBytes = await this.measureTargets(targets)

    if (input.action === 'rebuildIndex') {
      await this.runRebuildIndex(input.projectPath ?? '')
    } else {
      await Promise.all(targets.map((target) => rm(target.absolutePath, { recursive: true, force: true })))
    }

    const afterBytes = await this.measureTargets(targets)
    const reclaimedBytes = Math.max(0, beforeBytes - afterBytes)
    const affectedPaths = targets.map((target) => target.relativePath)

    await this.logger?.log({
      level: 'info',
      category: 'settings',
      event: 'privacy-maintenance-run',
      message: 'Privacy maintenance action completed.',
      context: {
        action: input.action,
        affectedCount: affectedPaths.length,
        reclaimedBytes,
        projectPath: input.projectPath ?? null
      }
    })

    return {
      action: input.action,
      success: true,
      affectedPaths,
      reclaimedBytes,
      messageKey: `privacy.action.${input.action}.done`
    }
  }

  private async collectDescriptors(input: GetPrivacyInventoryRequest): Promise<InventoryDescriptor[]> {
    const descriptors: InventoryDescriptor[] = [
      {
        absolutePath: path.join(this.userDataDirectory, 'app-settings.json'),
        relativePath: 'app-settings.json',
        category: 'settings',
        label: 'App settings',
        containsSensitiveData: true,
        deletable: false,
        source: 'app',
        descriptionKey: 'privacy.item.settings'
      },
      {
        absolutePath: path.join(this.userDataDirectory, 'logs'),
        relativePath: 'logs/',
        category: 'logs',
        label: 'Application logs',
        containsSensitiveData: true,
        deletable: true,
        source: 'app',
        maintenanceAction: 'clearLogs',
        descriptionKey: 'privacy.item.logs'
      }
    ]

    if (!input.projectPath) {
      return descriptors
    }

    this.fileSystem.assertProjectPath(input.projectPath)

    descriptors.push(
      {
        absolutePath: this.fileSystem.resolveProjectPath(input.projectPath, 'project.json'),
        relativePath: 'project.json',
        category: 'project',
        label: 'Project metadata',
        containsSensitiveData: true,
        deletable: false,
        source: 'project',
        descriptionKey: 'privacy.item.project'
      },
      {
        absolutePath: this.fileSystem.resolveProjectPath(input.projectPath, 'history'),
        relativePath: 'history/',
        category: 'history',
        label: 'Project history',
        containsSensitiveData: true,
        deletable: false,
        source: 'project',
        descriptionKey: 'privacy.item.history'
      },
      {
        absolutePath: this.fileSystem.resolveProjectPath(input.projectPath, 'exports/out'),
        relativePath: 'exports/out/',
        category: 'exports',
        label: 'Exported output',
        containsSensitiveData: true,
        deletable: false,
        source: 'project',
        descriptionKey: 'privacy.item.exports'
      },
      {
        absolutePath: this.fileSystem.resolveProjectPath(input.projectPath, 'assets/attachments'),
        relativePath: 'assets/attachments/',
        category: 'attachments',
        label: 'Imported attachments',
        containsSensitiveData: true,
        deletable: false,
        source: 'project',
        descriptionKey: 'privacy.item.attachments'
      },
      {
        absolutePath: this.fileSystem.resolveProjectPath(input.projectPath, 'cache/index.sqlite'),
        relativePath: 'cache/index.sqlite',
        category: 'sqlite',
        label: 'Derived search index',
        containsSensitiveData: true,
        deletable: true,
        source: 'project',
        maintenanceAction: 'rebuildIndex',
        descriptionKey: 'privacy.item.sqlite'
      },
      {
        absolutePath: this.fileSystem.resolveProjectPath(input.projectPath, 'cache/index.sqlite-shm'),
        relativePath: 'cache/index.sqlite-shm',
        category: 'sqlite',
        label: 'Derived search index shared memory',
        containsSensitiveData: true,
        deletable: true,
        source: 'project',
        maintenanceAction: 'rebuildIndex',
        descriptionKey: 'privacy.item.sqlite'
      },
      {
        absolutePath: this.fileSystem.resolveProjectPath(input.projectPath, 'cache/index.sqlite-wal'),
        relativePath: 'cache/index.sqlite-wal',
        category: 'sqlite',
        label: 'Derived search index write-ahead log',
        containsSensitiveData: true,
        deletable: true,
        source: 'project',
        maintenanceAction: 'rebuildIndex',
        descriptionKey: 'privacy.item.sqlite'
      },
      {
        absolutePath: this.fileSystem.resolveProjectPath(input.projectPath, 'cache/search'),
        relativePath: 'cache/search/',
        category: 'cache',
        label: 'Search cache',
        containsSensitiveData: true,
        deletable: true,
        source: 'project',
        maintenanceAction: 'rebuildIndex',
        descriptionKey: 'privacy.item.searchCache'
      },
      {
        absolutePath: this.fileSystem.resolveProjectPath(input.projectPath, 'cache/derived'),
        relativePath: 'cache/derived/',
        category: 'cache',
        label: 'Derived cache',
        containsSensitiveData: true,
        deletable: true,
        source: 'project',
        maintenanceAction: 'rebuildIndex',
        descriptionKey: 'privacy.item.derivedCache'
      },
      {
        absolutePath: this.fileSystem.resolveProjectPath(input.projectPath, 'cache/preview'),
        relativePath: 'cache/preview/',
        category: 'cache',
        label: 'Preview cache',
        containsSensitiveData: true,
        deletable: true,
        source: 'project',
        maintenanceAction: 'clearPreviewCache',
        descriptionKey: 'privacy.item.previewCache'
      },
      {
        absolutePath: this.fileSystem.resolveProjectPath(input.projectPath, 'cache/thumbnails'),
        relativePath: 'cache/thumbnails/',
        category: 'cache',
        label: 'Thumbnail cache',
        containsSensitiveData: true,
        deletable: true,
        source: 'project',
        maintenanceAction: 'clearThumbnails',
        descriptionKey: 'privacy.item.thumbnails'
      },
      {
        absolutePath: this.fileSystem.resolveProjectPath(input.projectPath, 'logs/local-audit'),
        relativePath: 'logs/local-audit/',
        category: 'logs',
        label: 'Project audit logs',
        containsSensitiveData: true,
        deletable: true,
        source: 'project',
        maintenanceAction: 'clearLogs',
        descriptionKey: 'privacy.item.projectLogs'
      }
    )

    return descriptors
  }

  private async resolveMaintenanceTargets(input: RunMaintenanceRequest): Promise<Array<{ absolutePath: string; relativePath: string }>> {
    if (input.action === 'rebuildIndex') {
      const projectPath = input.projectPath ?? ''
      this.fileSystem.assertProjectPath(projectPath)
      return [
        {
          absolutePath: this.fileSystem.resolveProjectPath(projectPath, 'cache/index.sqlite'),
          relativePath: 'cache/index.sqlite'
        },
        {
          absolutePath: this.fileSystem.resolveProjectPath(projectPath, 'cache/index.sqlite-shm'),
          relativePath: 'cache/index.sqlite-shm'
        },
        {
          absolutePath: this.fileSystem.resolveProjectPath(projectPath, 'cache/index.sqlite-wal'),
          relativePath: 'cache/index.sqlite-wal'
        },
        {
          absolutePath: this.fileSystem.resolveProjectPath(projectPath, 'cache/search'),
          relativePath: 'cache/search/'
        },
        {
          absolutePath: this.fileSystem.resolveProjectPath(projectPath, 'cache/derived'),
          relativePath: 'cache/derived/'
        }
      ]
    }

    const projectPaths = input.projectPath ? [input.projectPath] : await this.listWorkspaceProjects(input.workspaceDirectory)
    const targets: Array<{ absolutePath: string; relativePath: string }> = []

    if (input.action === 'clearLogs') {
      targets.push({
        absolutePath: path.join(this.userDataDirectory, 'logs'),
        relativePath: 'app:logs/'
      })
    }

    for (const projectPath of projectPaths) {
      this.fileSystem.assertProjectPath(projectPath)
      if (input.action === 'clearPreviewCache') {
        targets.push({
          absolutePath: this.fileSystem.resolveProjectPath(projectPath, 'cache/preview'),
          relativePath: `${path.basename(projectPath)}/cache/preview/`
        })
      }
      if (input.action === 'clearThumbnails') {
        targets.push({
          absolutePath: this.fileSystem.resolveProjectPath(projectPath, 'cache/thumbnails'),
          relativePath: `${path.basename(projectPath)}/cache/thumbnails/`
        })
      }
      if (input.action === 'clearLogs') {
        targets.push({
          absolutePath: this.fileSystem.resolveProjectPath(projectPath, 'logs/local-audit'),
          relativePath: `${path.basename(projectPath)}/logs/local-audit/`
        })
      }
    }

    return targets
  }

  private async runRebuildIndex(projectPath: string): Promise<void> {
    if (!this.projectService) {
      throw new Error('Project service non disponibile per la reindicizzazione.')
    }

    await this.projectService.rebuildDerivedIndexForMaintenance(projectPath)
  }

  private async listWorkspaceProjects(workspaceDirectory: string): Promise<string[]> {
    try {
      const entries = await readdir(workspaceDirectory, { withFileTypes: true })
      return entries
        .filter((entry) => entry.isDirectory() && entry.name.endsWith('.pe'))
        .map((entry) => path.join(workspaceDirectory, entry.name))
    } catch {
      return []
    }
  }

  private async measureTargets(targets: Array<{ absolutePath: string }>): Promise<number> {
    const sizes = await Promise.all(targets.map((target) => this.getPathSize(target.absolutePath)))
    return sizes.reduce((total, size) => total + size, 0)
  }

  private async getPathSize(targetPath: string): Promise<number> {
    const exists = await access(targetPath)
      .then(() => true)
      .catch(() => false)

    if (!exists) {
      return 0
    }

    const details = await stat(targetPath)
    if (details.isFile()) {
      return details.size
    }

    const entries = await readdir(targetPath, { withFileTypes: true })
    const nestedSizes = await Promise.all(
      entries.map((entry) => this.getPathSize(path.join(targetPath, entry.name)))
    )

    return nestedSizes.reduce((total, size) => total + size, 0)
  }
}
