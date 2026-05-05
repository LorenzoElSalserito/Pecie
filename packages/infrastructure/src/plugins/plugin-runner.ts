import { readFile } from 'node:fs/promises'
import path from 'node:path'
import vm from 'node:vm'

import type { PluginHook, PluginManifest, PluginPermission } from '@pecie/schemas'
import { validatePluginManifest } from '@pecie/schemas'

import { assertPluginPermission, pluginDeclaresHook } from './plugin-permissions'

const PLUGINS_DIRECTORY_NAME = 'plugins'
const PLUGIN_MANIFEST_FILENAME = 'plugin.json'
const DEFAULT_TIMEOUT_MS = 1000

export type PluginHookPayload = Record<string, unknown>
export type PluginHookResult = Record<string, unknown> | null

export type PluginProjectApi = {
  writeDocument?: (request: { documentId: string; markdown: string }) => Promise<void> | void
}

export type PluginRunnerOptions = {
  timeoutMs?: number
  projectApi?: PluginProjectApi
}

export type RunPluginHookRequest = {
  pluginId: string
  hook: PluginHook
  payload: PluginHookPayload
}

type PluginModule = {
  hooks?: Partial<Record<PluginHook, (context: PluginExecutionContext) => unknown | Promise<unknown>>>
}

type PluginExecutionContext = {
  payload: PluginHookPayload
  permissions: readonly PluginPermission[]
  project: {
    writeDocument: (request: { documentId: string; markdown: string }) => Promise<void>
  }
}

export class PluginRunner {
  private readonly timeoutMs: number

  public constructor(
    private readonly appDataDirectory: string,
    private readonly options: PluginRunnerOptions = {}
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  public async runHook(request: RunPluginHookRequest): Promise<PluginHookResult> {
    const { manifest, pluginDirectory } = await this.loadManifest(request.pluginId)
    if (manifest.enabledByDefault === false || !pluginDeclaresHook(manifest, request.hook)) {
      return null
    }

    const entryPoint = this.resolveEntryPoint(pluginDirectory, manifest.entryPoint)
    const pluginModule = this.evaluateModule(await readFile(entryPoint, 'utf8'), entryPoint)
    const hookHandler = pluginModule.hooks?.[request.hook]
    if (typeof hookHandler !== 'function') {
      return null
    }

    const context = this.buildExecutionContext(manifest, request.payload)
    const result = await this.withTimeout(Promise.resolve(hookHandler(context)))
    return this.toSerializableResult(result)
  }

  private async loadManifest(pluginId: string): Promise<{ manifest: PluginManifest; pluginDirectory: string }> {
    if (!/^[a-zA-Z0-9._-]+$/.test(pluginId)) {
      throw new Error('Plugin id non valido.')
    }

    const pluginDirectory = path.join(this.appDataDirectory, PLUGINS_DIRECTORY_NAME, pluginId)
    const manifestPath = path.join(pluginDirectory, PLUGIN_MANIFEST_FILENAME)
    const manifest = validatePluginManifest(JSON.parse(await readFile(manifestPath, 'utf8')))
    if (manifest.id !== pluginId) {
      throw new Error(`Plugin manifest id mismatch: expected "${pluginId}", found "${manifest.id}".`)
    }

    return { manifest, pluginDirectory }
  }

  private resolveEntryPoint(pluginDirectory: string, entryPoint: string): string {
    const resolved = path.resolve(pluginDirectory, entryPoint)
    const root = `${path.resolve(pluginDirectory)}${path.sep}`
    if (!resolved.startsWith(root)) {
      throw new Error('Plugin entryPoint fuori dalla cartella plugin.')
    }
    return resolved
  }

  private evaluateModule(source: string, filename: string): PluginModule {
    const module = { exports: {} as PluginModule }
    const sandbox = vm.createContext({
      module,
      exports: module.exports,
      console: {
        log: () => undefined,
        warn: () => undefined,
        error: () => undefined
      }
    })
    const script = new vm.Script(source, { filename })
    script.runInContext(sandbox, { timeout: this.timeoutMs })
    return module.exports
  }

  private buildExecutionContext(manifest: PluginManifest, payload: PluginHookPayload): PluginExecutionContext {
    const frozenPayload = this.deepFreeze(this.cloneJson(payload))
    return {
      payload: frozenPayload,
      permissions: Object.freeze([...manifest.permissions]),
      project: {
        writeDocument: async (request) => {
          assertPluginPermission(manifest, 'project.write')
          await this.options.projectApi?.writeDocument?.(this.cloneJson(request))
        }
      }
    }
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timeout: NodeJS.Timeout | undefined
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error(`Plugin execution timed out after ${this.timeoutMs}ms.`)), this.timeoutMs)
    })

    try {
      return await Promise.race([operation, timeoutPromise])
    } finally {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }

  private toSerializableResult(value: unknown): PluginHookResult {
    if (value === undefined || value === null) {
      return null
    }

    const cloned = this.cloneJson(value)
    if (!cloned || typeof cloned !== 'object' || Array.isArray(cloned)) {
      throw new Error('Plugin result must be a serializable object.')
    }

    return cloned as PluginHookResult
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
  }

  private deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object') {
      Object.freeze(value)
      for (const nested of Object.values(value as Record<string, unknown>)) {
        this.deepFreeze(nested)
      }
    }

    return value
  }
}
