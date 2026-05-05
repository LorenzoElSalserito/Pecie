import { ProjectFileSystem } from '../fs/project-file-system'

export type ProjectCacheEntryKind = 'directory' | 'file'

export interface PruneProjectCacheOptions {
  fileSystem: ProjectFileSystem
  projectPath: string
  relativeDirectory: string
  maxEntries: number
  keepName: string
  kind: ProjectCacheEntryKind
}

type CacheEntry = {
  name: string
  relativePath: string
  mtimeMs: number
}

export async function pruneProjectCacheEntries(options: PruneProjectCacheOptions): Promise<void> {
  const entries = await options.fileSystem.listEntries(options.projectPath, options.relativeDirectory).catch(() => [])
  const candidates = await Promise.all(
    entries
      .filter((entry) => (options.kind === 'directory' ? entry.isDirectory() : entry.isFile()))
      .map(async (entry) => {
        const relativePath = `${options.relativeDirectory}/${entry.name}`
        const stats = await options.fileSystem.statEntry(options.projectPath, relativePath).catch(() => null)
        return stats
          ? {
              name: entry.name,
              relativePath,
              mtimeMs: stats.mtimeMs
            }
          : null
      })
  )
  const sorted = candidates
    .filter((entry): entry is CacheEntry => entry !== null)
    .sort((left, right) => {
      if (left.name === options.keepName) return -1
      if (right.name === options.keepName) return 1
      return right.mtimeMs - left.mtimeMs
    })

  if (sorted.length <= options.maxEntries) {
    return
  }

  const retained = new Set(sorted.slice(0, options.maxEntries).map((entry) => entry.name))
  retained.add(options.keepName)
  await Promise.all(
    sorted
      .filter((entry) => !retained.has(entry.name))
      .map((entry) => options.fileSystem.deleteEntry(options.projectPath, entry.relativePath).catch(() => undefined))
  )
}
