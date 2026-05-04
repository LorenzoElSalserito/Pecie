import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ExportRuntimeResolver } from './export-runtime-resolver'

describe('ExportRuntimeResolver', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { recursive: true, force: true })))
  })

  it('reports bundled capabilities from the packaged runtime manifest', async () => {
    const resourcesRoot = await mkdtemp(path.join(tmpdir(), 'pecie-runtime-resolver-'))
    cleanupPaths.push(resourcesRoot)

    await mkdir(path.join(resourcesRoot, 'export-runtime', 'linux-x64', 'pandoc', 'bin'), { recursive: true })
    await writeFile(path.join(resourcesRoot, 'export-runtime', 'linux-x64', 'pandoc', 'bin', 'pandoc'), '', 'utf8')
    await writeFile(
      path.join(resourcesRoot, 'export-runtime', 'manifest.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          runtimeVersion: '1.0.0',
          platform: 'linux',
          arch: 'x64',
          bundledCapabilities: [
            {
              capabilityId: 'pandoc',
              relativeExecutablePath: 'linux-x64/pandoc/bin/pandoc',
              version: '3.6.0',
              checksumSha256: 'abc123',
              byteSize: 0,
              verification: 'checksummed'
            }
          ]
        },
        null,
        2
      ),
      'utf8'
    )

    const resolver = new ExportRuntimeResolver({
      resourcesRoot,
      platform: 'linux',
      arch: 'x64',
      pathValue: ''
    })

    const response = await resolver.getRuntimeCapabilities()

    expect(response.runtimeVersion).toBe('1.0.0')
    expect(response.capabilities.find((entry) => entry.capabilityId === 'pandoc')).toMatchObject({
      capabilityId: 'pandoc',
      status: 'available',
      source: 'bundled'
    })
  })

  it('resolves an explicit system binary only when binary resolution allows it', async () => {
    const systemRoot = await mkdtemp(path.join(tmpdir(), 'pecie-runtime-system-'))
    cleanupPaths.push(systemRoot)
    const systemPandoc = path.join(systemRoot, 'pandoc')
    await writeFile(systemPandoc, '', 'utf8')
    await chmod(systemPandoc, 0o755)

    const resolver = new ExportRuntimeResolver({
      resourcesRoot: path.join(tmpdir(), 'pecie-runtime-missing'),
      pathValue: systemRoot,
      platform: 'linux',
      arch: 'x64'
    })

    const resolved = await resolver.resolveBinary({
      capabilityId: 'pandoc',
      allowSystemFallback: true
    })

    expect(resolved.source).toBe('system')
    expect(resolved.executablePath).toBe(systemPandoc)
  })

  it('fails instead of returning an unchecked command name when system fallback is unavailable', async () => {
    const resolver = new ExportRuntimeResolver({
      resourcesRoot: path.join(tmpdir(), 'pecie-runtime-missing'),
      pathValue: ''
    })

    await expect(
      resolver.resolveBinary({
        capabilityId: 'pandoc',
        allowSystemFallback: true
      })
    ).rejects.toThrow(/capability non disponibile/)
  })
})
