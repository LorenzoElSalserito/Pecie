import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { ListInstalledPluginsResponse, PluginDiagnostic, PluginListItem } from '@pecie/schemas'
import { validatePluginManifest } from '@pecie/schemas'

const PLUGINS_DIRECTORY_NAME = 'plugins'
const PLUGIN_MANIFEST_FILENAME = 'plugin.json'

export class PluginService {
  public constructor(private readonly appDataDirectory: string) {}

  public async listInstalledPlugins(): Promise<ListInstalledPluginsResponse> {
    const pluginsDirectory = path.join(this.appDataDirectory, PLUGINS_DIRECTORY_NAME)
    const diagnostics: PluginDiagnostic[] = []
    const plugins: PluginListItem[] = []

    let entries: string[] = []
    try {
      entries = await readdir(pluginsDirectory)
    } catch {
      return { plugins, diagnostics }
    }

    for (const entry of entries.sort((left, right) => left.localeCompare(right))) {
      const manifestPath = path.join(pluginsDirectory, entry, PLUGIN_MANIFEST_FILENAME)
      const sourcePath = `${PLUGINS_DIRECTORY_NAME}/${entry}/${PLUGIN_MANIFEST_FILENAME}`

      try {
        const manifest = validatePluginManifest(JSON.parse(await readFile(manifestPath, 'utf8')))
        plugins.push({
          manifest,
          sourcePath,
          enabled: manifest.enabledByDefault !== false
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
}
