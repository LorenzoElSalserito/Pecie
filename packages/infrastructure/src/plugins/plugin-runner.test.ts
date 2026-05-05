import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { PluginRunner } from './plugin-runner'

describe('PluginRunner', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { recursive: true, force: true })))
  })

  async function createPlugin(input: {
    id?: string
    permissions?: string[]
    hooks?: string[]
    source: string
  }): Promise<string> {
    const appDataDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-plugin-runner-'))
    cleanupPaths.push(appDataDirectory)
    const pluginId = input.id ?? 'demo-plugin'
    const pluginDirectory = path.join(appDataDirectory, 'plugins', pluginId)
    await mkdir(pluginDirectory, { recursive: true })
    await writeFile(
      path.join(pluginDirectory, 'plugin.json'),
      JSON.stringify({
        id: pluginId,
        schemaVersion: 1,
        label: 'Demo plugin',
        version: '0.1.0',
        entryPoint: 'index.js',
        permissions: input.permissions ?? ['project.read'],
        hooks: input.hooks ?? ['onProjectOpen']
      }),
      'utf8'
    )
    await writeFile(path.join(pluginDirectory, 'index.js'), input.source, 'utf8')
    return appDataDirectory
  }

  it('runs a declared hook with a frozen DTO and serializable result', async () => {
    const appDataDirectory = await createPlugin({
      source: `
        module.exports.hooks = {
          onProjectOpen(context) {
            context.payload.project.title = 'mutated'
            return { title: context.payload.project.title, permissionCount: context.permissions.length }
          }
        }
      `
    })

    const result = await new PluginRunner(appDataDirectory).runHook({
      pluginId: 'demo-plugin',
      hook: 'onProjectOpen',
      payload: { project: { title: 'Original' } }
    })

    expect(result).toEqual({ title: 'Original', permissionCount: 1 })
  })

  it('blocks project writes when project.write is not declared', async () => {
    const appDataDirectory = await createPlugin({
      permissions: ['project.read'],
      hooks: ['onDocumentSave'],
      source: `
        module.exports.hooks = {
          async onDocumentSave(context) {
            await context.project.writeDocument({ documentId: 'doc-1', markdown: 'changed' })
          }
        }
      `
    })

    await expect(
      new PluginRunner(appDataDirectory).runHook({
        pluginId: 'demo-plugin',
        hook: 'onDocumentSave',
        payload: { documentId: 'doc-1' }
      })
    ).rejects.toThrow(/project.write/)
  })

  it('allows project writes only through the provided project API when permission is declared', async () => {
    const writes: Array<{ documentId: string; markdown: string }> = []
    const appDataDirectory = await createPlugin({
      permissions: ['project.read', 'project.write'],
      hooks: ['onDocumentSave'],
      source: `
        module.exports.hooks = {
          async onDocumentSave(context) {
            await context.project.writeDocument({ documentId: context.payload.documentId, markdown: 'changed' })
            return { ok: true }
          }
        }
      `
    })

    const result = await new PluginRunner(appDataDirectory, {
      projectApi: {
        writeDocument: (request) => {
          writes.push(request)
        }
      }
    }).runHook({
      pluginId: 'demo-plugin',
      hook: 'onDocumentSave',
      payload: { documentId: 'doc-1' }
    })

    expect(result).toEqual({ ok: true })
    expect(writes).toEqual([{ documentId: 'doc-1', markdown: 'changed' }])
  })

  it('times out synchronous plugin code', async () => {
    const appDataDirectory = await createPlugin({
      source: 'while (true) {}'
    })

    await expect(
      new PluginRunner(appDataDirectory, { timeoutMs: 20 }).runHook({
        pluginId: 'demo-plugin',
        hook: 'onProjectOpen',
        payload: {}
      })
    ).rejects.toThrow(/Script execution timed out|timed out/)
  })

  it('rejects non-serializable or primitive hook results', async () => {
    const appDataDirectory = await createPlugin({
      source: `
        module.exports.hooks = {
          onProjectOpen() {
            return 'not-an-object'
          }
        }
      `
    })

    await expect(
      new PluginRunner(appDataDirectory).runHook({
        pluginId: 'demo-plugin',
        hook: 'onProjectOpen',
        payload: {}
      })
    ).rejects.toThrow(/serializable object/)
  })
})
