import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ProjectFileSystem } from '../fs/project-file-system'
import { pruneProjectCacheEntries } from './cache-retention'

describe('pruneProjectCacheEntries', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { force: true, recursive: true })))
  })

  async function createProjectPath() {
    const baseDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-cache-retention-'))
    cleanupPaths.push(baseDirectory)
    const projectPath = path.join(baseDirectory, 'fixture.pe')
    await mkdir(projectPath, { recursive: true })
    return projectPath
  }

  it('prunes directory entries while keeping the protected cache key', async () => {
    const fileSystem = new ProjectFileSystem()
    const projectPath = await createProjectPath()

    for (const name of ['keep', 'candidate-a', 'candidate-b', 'candidate-c']) {
      await fileSystem.writeText(projectPath, `cache/preview/${name}/preview.json`, name)
    }

    await pruneProjectCacheEntries({
      fileSystem,
      projectPath,
      relativeDirectory: 'cache/preview',
      maxEntries: 2,
      keepName: 'keep',
      kind: 'directory'
    })

    const entries = await fileSystem.listEntries(projectPath, 'cache/preview')
    expect(entries.filter((entry) => entry.isDirectory()).length).toBeLessThanOrEqual(2)
    await expect(fileSystem.statEntry(projectPath, 'cache/preview/keep/preview.json')).resolves.toBeTruthy()
  })

  it('prunes file entries while keeping the protected file name', async () => {
    const fileSystem = new ProjectFileSystem()
    const projectPath = await createProjectPath()

    for (const name of ['keep.json', 'candidate-a.json', 'candidate-b.json', 'candidate-c.json']) {
      await fileSystem.writeText(projectPath, `cache/preview/page-breaks/${name}`, name)
    }

    await pruneProjectCacheEntries({
      fileSystem,
      projectPath,
      relativeDirectory: 'cache/preview/page-breaks',
      maxEntries: 2,
      keepName: 'keep.json',
      kind: 'file'
    })

    const entries = await fileSystem.listEntries(projectPath, 'cache/preview/page-breaks')
    expect(entries.filter((entry) => entry.isFile()).length).toBeLessThanOrEqual(2)
    await expect(fileSystem.statEntry(projectPath, 'cache/preview/page-breaks/keep.json')).resolves.toBeTruthy()
  })

  it('ignores missing cache directories', async () => {
    const fileSystem = new ProjectFileSystem()
    const projectPath = await createProjectPath()

    await expect(
      pruneProjectCacheEntries({
        fileSystem,
        projectPath,
        relativeDirectory: 'cache/missing',
        maxEntries: 2,
        keepName: 'keep',
        kind: 'directory'
      })
    ).resolves.toBeUndefined()
  })
})
