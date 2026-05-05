import type { PluginManifest, PluginPermission } from '@pecie/schemas'

export class PluginPermissionError extends Error {
  public constructor(
    public readonly pluginId: string,
    public readonly permission: PluginPermission
  ) {
    super(`Plugin "${pluginId}" requires permission "${permission}".`)
  }
}

export function hasPluginPermission(manifest: PluginManifest, permission: PluginPermission): boolean {
  return manifest.permissions.includes(permission)
}

export function assertPluginPermission(manifest: PluginManifest, permission: PluginPermission): void {
  if (!hasPluginPermission(manifest, permission)) {
    throw new PluginPermissionError(manifest.id, permission)
  }
}

export function pluginDeclaresHook(manifest: PluginManifest, hook: string): boolean {
  return manifest.hooks.some((entry) => entry === hook)
}
