import type { Dirent } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  ListInstalledPluginsResponse,
  PluginDiagnostic,
  PluginHook,
  PluginListItem,
  SetPluginEnabledResponse
} from '@pecie/schemas'
import { validatePluginManifest } from '@pecie/schemas'

import { PluginRunner, type PluginHookPayload, type PluginHookResult, type PluginRunnerOptions } from './plugin-runner'

const PLUGINS_DIRECTORY_NAME = 'plugins'
const PLUGIN_MANIFEST_FILENAME = 'plugin.json'
const PLUGIN_STATE_FILENAME = 'plugin-state.json'

export type RunPluginHookPipelineRequest = {
  hook: PluginHook
  payload: PluginHookPayload
}

export type PluginHookPipelineResult = {
  pluginId: string
  hook: PluginHook
  result: PluginHookResult
}

export type RunPluginHookPipelineResponse = {
  results: PluginHookPipelineResult[]
  diagnostics: PluginDiagnostic[]
}

export class PluginService {
  private readonly runner: PluginRunner

  public constructor(
    private readonly appDataDirectory: string,
    runnerOptions: PluginRunnerOptions = {}
  ) {
    this.runner = new PluginRunner(appDataDirectory, runnerOptions)
  }

  public async listInstalledPlugins(): Promise<ListInstalledPluginsResponse> {
    const pluginsDirectory = path.join(this.appDataDirectory, PLUGINS_DIRECTORY_NAME)
    const diagnostics: PluginDiagnostic[] = []
    const plugins: PluginListItem[] = []
    const state = await this.readPluginState()

    let entries: Dirent[] = []
    try {
      entries = await readdir(pluginsDirectory, { withFileTypes: true })
    } catch {
      return { plugins, diagnostics }
    }

    for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
      const manifestPath = path.join(pluginsDirectory, entry.name, PLUGIN_MANIFEST_FILENAME)
      const sourcePath = `${PLUGINS_DIRECTORY_NAME}/${entry.name}/${PLUGIN_MANIFEST_FILENAME}`

      try {
        const manifest = validatePluginManifest(JSON.parse(await readFile(manifestPath, 'utf8')))
        plugins.push({
          manifest,
          sourcePath,
          enabled: state[manifest.id]?.enabled ?? manifest.enabledByDefault !== false
        })
      } catch (error) {
        diagnostics.push({
          sourcePath,
          severity: 'error',
          message: error instanceof Error ? error.message : 'Plugin manifest could not be read.'
        })
      }
    }

    return { plugins, diagnostics }
  }

  public async setPluginEnabled(pluginId: string, enabled: boolean): Promise<SetPluginEnabledResponse> {
    if (!/^[a-zA-Z0-9._-]+$/.test(pluginId)) {
      throw new Error('Plugin id non valido.')
    }

    const inventory = await this.listInstalledPlugins()
    const plugin = inventory.plugins.find((entry) => entry.manifest.id === pluginId)
    if (!plugin) {
      throw new Error(`Plugin non trovato: ${pluginId}`)
    }

    const state = await this.readPluginState()
    state[pluginId] = {
      enabled,
      updatedAt: new Date().toISOString()
    }
    await this.writePluginState(state)

    return {
      plugin: {
        ...plugin,
        enabled
      },
      diagnostics: inventory.diagnostics
    }
  }

  public async runHookPipeline(request: RunPluginHookPipelineRequest): Promise<RunPluginHookPipelineResponse> {
    const { plugins, diagnostics } = await this.listInstalledPlugins()
    const results: PluginHookPipelineResult[] = []

    for (const plugin of plugins) {
      if (!plugin.enabled || !plugin.manifest.hooks.includes(request.hook)) {
        continue
      }

      try {
        results.push({
          pluginId: plugin.manifest.id,
          hook: request.hook,
          result: await this.runner.runHook({
            pluginId: plugin.manifest.id,
            hook: request.hook,
            payload: request.payload
          })
        })
      } catch (error) {
        diagnostics.push({
          sourcePath: plugin.sourcePath,
          severity: 'error',
          message: this.formatPluginError(error)
        })
      }
    }

    return { results, diagnostics }
  }

  private formatPluginError(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      return error.message
    }

    return 'Plugin hook failed.'
  }

  private async readPluginState(): Promise<Record<string, { enabled: boolean; updatedAt?: string }>> {
    try {
      const raw = JSON.parse(await readFile(path.join(this.appDataDirectory, PLUGINS_DIRECTORY_NAME, PLUGIN_STATE_FILENAME), 'utf8')) as unknown
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {}
      }

      return Object.fromEntries(
        Object.entries(raw as Record<string, unknown>)
          .filter(([pluginId, value]) => /^[a-zA-Z0-9._-]+$/.test(pluginId) && value && typeof value === 'object')
          .map(([pluginId, value]) => {
            const record = value as Record<string, unknown>
            return [
              pluginId,
              {
                enabled: record.enabled === true,
                updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined
              }
            ]
          })
      )
    } catch {
      return {}
    }
  }

  private async writePluginState(state: Record<string, { enabled: boolean; updatedAt?: string }>): Promise<void> {
    const target = path.join(this.appDataDirectory, PLUGINS_DIRECTORY_NAME, PLUGIN_STATE_FILENAME)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, JSON.stringify(state, null, 2), 'utf8')
  }
}
