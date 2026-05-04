import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { PluginService } from './plugin-service'

describe('PluginService', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { recursive: true, force: true })))
  })

  it('discovers valid plugin manifests without executing plugin code', async () => {
    const appDataDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-plugins-'))
    cleanupPaths.push(appDataDirectory)
    const pluginDirectory = path.join(appDataDirectory, 'plugins', 'demo-plugin')
    await mkdir(pluginDirectory, { recursive: true })
    await writeFile(
      path.join(pluginDirectory, 'plugin.json'),
      JSON.stringify({
        id: 'demo-plugin',
        schemaVersion: 1,
        label: 'Demo plugin',
        version: '0.1.0',
        entryPoint: 'index.js',
        permissions: ['project.read', 'export.read'],
        hooks: ['onProjectOpen', 'onExportProfileLoaded']
      }),
      'utf8'
    )

    const response = await new PluginService(appDataDirectory).listInstalledPlugins()

    expect(response.diagnostics).toEqual([])
    expect(response.plugins).toHaveLength(1)
    expect(response.plugins[0]?.manifest.id).toBe('demo-plugin')
    expect(response.plugins[0]?.sourcePath).toBe('plugins/demo-plugin/plugin.json')
  })

  it('isolates broken manifests as diagnostics', async () => {
    const appDataDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-plugins-broken-'))
    cleanupPaths.push(appDataDirectory)
    const pluginDirectory = path.join(appDataDirectory, 'plugins', 'broken-plugin')
    await mkdir(pluginDirectory, { recursive: true })
    await writeFile(
      path.join(pluginDirectory, 'plugin.json'),
      JSON.stringify({
        id: 'broken-plugin',
        schemaVersion: 1,
        label: 'Broken plugin',
        version: '0.1.0',
        entryPoint: '../escape.js',
        permissions: ['project.write'],
        hooks: ['onDocumentSave']
      }),
      'utf8'
    )

    const response = await new PluginService(appDataDirectory).listInstalledPlugins()

    expect(response.plugins).toEqual([])
    expect(response.diagnostics).toHaveLength(1)
    expect(response.diagnostics[0]?.sourcePath).toBe('plugins/broken-plugin/plugin.json')
    expect(response.diagnostics[0]?.message).toMatch(/entryPoint/i)
  })
})
