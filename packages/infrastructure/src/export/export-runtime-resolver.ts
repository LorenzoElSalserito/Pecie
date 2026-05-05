import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  type ExportRuntimeCapabilityId,
  type ExportRuntimeManifest,
  type GetRuntimeCapabilitiesResponse,
  type RuntimeCapabilityReport
} from '@pecie/schemas'
import { exportRuntimeCapabilities } from '@pecie/domain'

type ResolverOptions = {
  resourcesRoot?: string
  resourceRoots?: string[]
  pathValue?: string
  platform?: NodeJS.Platform
  arch?: string
}

type ResolveRuntimeBinaryRequest = {
  capabilityId: ExportRuntimeCapabilityId
  allowSystemFallback: boolean
}

type ResolvedRuntimeBinary = {
  capabilityId: ExportRuntimeCapabilityId
  source: 'bundled' | 'system'
  executablePath: string
  version?: string
}

export class ExportRuntimeResolver {
  private readonly resourcesRoot: string
  private readonly resourceRoots: string[]
  private readonly pathEntries: string[]
  private readonly platform: NodeJS.Platform
  private readonly arch: string

  public constructor(options: ResolverOptions = {}) {
    this.resourcesRoot = options.resourcesRoot ?? process.resourcesPath
    this.resourceRoots = options.resourceRoots?.length ? options.resourceRoots : [this.resourcesRoot]
    this.pathEntries = (options.pathValue ?? process.env.PATH ?? '')
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean)
    this.platform = options.platform ?? process.platform
    this.arch = options.arch ?? process.arch
  }

  public async getRuntimeCapabilities(): Promise<GetRuntimeCapabilitiesResponse> {
    const manifest = await this.readBundledManifest()
    const capabilities = await Promise.all(
      (Object.keys(exportRuntimeCapabilities) as ExportRuntimeCapabilityId[]).map(async (capabilityId) => {
        const registryEntry = exportRuntimeCapabilities[capabilityId]
        const bundledEntry = manifest?.bundledCapabilities.find((entry) => entry.capabilityId === capabilityId)

        if (bundledEntry) {
          const absolutePath = await this.resolveBundledExecutablePath(bundledEntry.relativeExecutablePath)
          if (await this.pathExists(absolutePath)) {
            return this.toRuntimeCapabilityReport({
              capabilityId,
              distribution: registryEntry.distribution,
              status: 'available',
              source: 'bundled',
              version: bundledEntry.version,
              messageKey: 'export.runtime.status.availableBundled'
            })
          }
        }

        if (this.allowsSystemFallback(registryEntry.distribution)) {
          const systemPath = await this.findSystemExecutable(registryEntry.executableBasename)
          if (systemPath) {
            return this.toRuntimeCapabilityReport({
              capabilityId,
              distribution: registryEntry.distribution,
              status: 'available',
              source: 'system',
              messageKey: 'export.runtime.status.availableSystem'
            })
          }
        }

        return this.toRuntimeCapabilityReport({
          capabilityId,
          distribution: registryEntry.distribution,
          status: 'missing',
          source: 'none',
          messageKey: 'export.runtime.status.missing'
        })
      })
    )

    return {
      runtimeVersion: manifest?.runtimeVersion,
      capabilities
    }
  }

  public async resolveBinary(request: ResolveRuntimeBinaryRequest): Promise<ResolvedRuntimeBinary> {
    const registryEntry = exportRuntimeCapabilities[request.capabilityId]
    const manifest = await this.readBundledManifest()
    const bundledEntry = manifest?.bundledCapabilities.find((entry) => entry.capabilityId === request.capabilityId)

    if (bundledEntry) {
      const absolutePath = await this.resolveBundledExecutablePath(bundledEntry.relativeExecutablePath)
      if (await this.pathExists(absolutePath)) {
        return {
          capabilityId: request.capabilityId,
          source: 'bundled',
          executablePath: absolutePath,
          version: bundledEntry.version
        }
      }
    }

    if (request.allowSystemFallback && this.allowsSystemFallback(registryEntry.distribution)) {
      const systemPath = await this.findSystemExecutable(registryEntry.executableBasename)
      if (!systemPath) {
        throw new Error(`Runtime export capability non disponibile: ${request.capabilityId}.`)
      }

      return {
        capabilityId: request.capabilityId,
        source: 'system',
        executablePath: systemPath
      }
    }

    throw new Error(`Runtime export capability non disponibile: ${request.capabilityId}.`)
  }

  private allowsSystemFallback(distribution: RuntimeCapabilityReport['distribution']): boolean {
    return distribution === 'manual-addon' || distribution === 'system-addon'
  }

  private async readBundledManifest(): Promise<ExportRuntimeManifest | null> {
    for (const resourceRoot of this.resourceRoots) {
      const manifestPath = path.join(resourceRoot, 'export-runtime', 'manifest.json')
      if (!(await this.pathExists(manifestPath))) {
        continue
      }

      const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown
      const manifest = this.parseManifest(raw)
      if (manifest.platform !== this.platform || manifest.arch !== this.arch) {
        continue
      }
      return manifest
    }

    return null
  }

  private async resolveBundledExecutablePath(relativeExecutablePath: string): Promise<string> {
    for (const resourceRoot of this.resourceRoots) {
      const absolutePath = path.join(resourceRoot, 'export-runtime', relativeExecutablePath)
      if (await this.pathExists(absolutePath)) {
        return absolutePath
      }
    }

    return path.join(this.resourceRoots[0] ?? this.resourcesRoot, 'export-runtime', relativeExecutablePath)
  }

  private async findSystemExecutable(executableBasename: string): Promise<string | null> {
    const candidates =
      this.platform === 'win32'
        ? [`${executableBasename}.exe`, `${executableBasename}.cmd`, executableBasename]
        : [executableBasename]

    for (const directory of this.pathEntries) {
      for (const candidate of candidates) {
        const absolutePath = path.join(directory, candidate)
        if (await this.pathExists(absolutePath)) {
          return absolutePath
        }
      }
    }

    return null
  }

  private parseManifest(value: unknown): ExportRuntimeManifest {
    if (!value || typeof value !== 'object') {
      throw new Error('Manifest runtime export non valido.')
    }

    const manifest = value as Record<string, unknown>
    if (
      manifest.schemaVersion !== 1 ||
      typeof manifest.runtimeVersion !== 'string' ||
      typeof manifest.platform !== 'string' ||
      typeof manifest.arch !== 'string' ||
      !Array.isArray(manifest.bundledCapabilities)
    ) {
      throw new Error('Manifest runtime export non valido.')
    }

    for (const entry of manifest.bundledCapabilities) {
      if (
        !entry ||
        typeof entry !== 'object' ||
        typeof entry.capabilityId !== 'string' ||
        typeof entry.relativeExecutablePath !== 'string' ||
        typeof entry.version !== 'string' ||
        typeof entry.checksumSha256 !== 'string' ||
        typeof entry.byteSize !== 'number' ||
        typeof entry.verification !== 'string'
      ) {
        throw new Error('Manifest runtime export non valido.')
      }
    }

    return manifest as unknown as ExportRuntimeManifest
  }

  private toRuntimeCapabilityReport(report: RuntimeCapabilityReport): RuntimeCapabilityReport {
    return report
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    return access(targetPath)
      .then(() => true)
      .catch(() => false)
  }
}
