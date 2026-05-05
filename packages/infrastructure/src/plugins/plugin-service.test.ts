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

  it('persists plugin enabled overrides across service instances', async () => {
    const appDataDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-plugins-state-'))
    cleanupPaths.push(appDataDirectory)
    const pluginDirectory = path.join(appDataDirectory, 'plugins', 'stateful-plugin')
    await mkdir(pluginDirectory, { recursive: true })
    await writeFile(
      path.join(pluginDirectory, 'plugin.json'),
      JSON.stringify({
        id: 'stateful-plugin',
        schemaVersion: 1,
        label: 'Stateful plugin',
        version: '0.1.0',
        entryPoint: 'index.js',
        permissions: ['project.read'],
        hooks: ['onProjectOpen']
      }),
      'utf8'
    )

    const service = new PluginService(appDataDirectory)
    expect((await service.listInstalledPlugins()).plugins[0]?.enabled).toBe(true)

    const updated = await service.setPluginEnabled('stateful-plugin', false)
    expect(updated.plugin.enabled).toBe(false)

    const reloaded = await new PluginService(appDataDirectory).listInstalledPlugins()
    expect(reloaded.plugins[0]?.enabled).toBe(false)
  })

  it('runs hook pipelines only for enabled plugins that declare the hook', async () => {
    const appDataDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-plugins-pipeline-'))
    cleanupPaths.push(appDataDirectory)

    async function writePlugin(input: {
      directory: string
      id: string
      enabledByDefault?: boolean
      hooks: string[]
      source: string
    }): Promise<void> {
      const pluginDirectory = path.join(appDataDirectory, 'plugins', input.directory)
      await mkdir(pluginDirectory, { recursive: true })
      await writeFile(
        path.join(pluginDirectory, 'plugin.json'),
        JSON.stringify({
          id: input.id,
          schemaVersion: 1,
          label: input.id,
          version: '0.1.0',
          entryPoint: 'index.js',
          permissions: ['project.read'],
          hooks: input.hooks,
          enabledByDefault: input.enabledByDefault
        }),
        'utf8'
      )
      await writeFile(path.join(pluginDirectory, 'index.js'), input.source, 'utf8')
    }

    await writePlugin({
      directory: 'alpha',
      id: 'alpha',
      hooks: ['onProjectOpen'],
      source: `
        module.exports.hooks = {
          onProjectOpen(context) {
            return { seenTitle: context.payload.project.title }
          }
        }
      `
    })
    await writePlugin({
      directory: 'disabled',
      id: 'disabled',
      enabledByDefault: false,
      hooks: ['onProjectOpen'],
      source: `
        module.exports.hooks = {
          onProjectOpen() {
            return { shouldNotRun: true }
          }
        }
      `
    })
    await writePlugin({
      directory: 'other-hook',
      id: 'other-hook',
      hooks: ['onDocumentSave'],
      source: `
        module.exports.hooks = {
          onDocumentSave() {
            return { shouldNotRun: true }
          }
        }
      `
    })

    const response = await new PluginService(appDataDirectory).runHookPipeline({
      hook: 'onProjectOpen',
      payload: { project: { title: 'Pipeline Project' } }
    })

    expect(response.diagnostics).toEqual([])
    expect(response.results).toEqual([
      {
        pluginId: 'alpha',
        hook: 'onProjectOpen',
        result: { seenTitle: 'Pipeline Project' }
      }
    ])

    await new PluginService(appDataDirectory).setPluginEnabled('alpha', false)
    const disabledResponse = await new PluginService(appDataDirectory).runHookPipeline({
      hook: 'onProjectOpen',
      payload: { project: { title: 'Pipeline Project' } }
    })

    expect(disabledResponse.diagnostics).toEqual([])
    expect(disabledResponse.results).toEqual([])
  })

  it('keeps hook pipeline errors isolated per plugin', async () => {
    const appDataDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-plugins-pipeline-error-'))
    cleanupPaths.push(appDataDirectory)
    const pluginDirectory = path.join(appDataDirectory, 'plugins', 'broken-hook')
    await mkdir(pluginDirectory, { recursive: true })
    await writeFile(
      path.join(pluginDirectory, 'plugin.json'),
      JSON.stringify({
        id: 'broken-hook',
        schemaVersion: 1,
        label: 'Broken hook',
        version: '0.1.0',
        entryPoint: 'index.js',
        permissions: ['project.read'],
        hooks: ['onProjectOpen']
      }),
      'utf8'
    )
    await writeFile(
      path.join(pluginDirectory, 'index.js'),
      `
        module.exports.hooks = {
          onProjectOpen() {
            throw new Error('boom')
          }
        }
      `,
      'utf8'
    )

    const response = await new PluginService(appDataDirectory).runHookPipeline({
      hook: 'onProjectOpen',
      payload: {}
    })

    expect(response.results).toEqual([])
    expect(response.diagnostics).toHaveLength(1)
    expect(response.diagnostics[0]?.sourcePath).toBe('plugins/broken-hook/plugin.json')
    expect(response.diagnostics[0]?.message).toContain('boom')
  })
})
