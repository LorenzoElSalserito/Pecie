import { describe, expect, it } from 'vitest'

import type { PluginManifest } from '@pecie/schemas'

import { assertPluginPermission, hasPluginPermission, pluginDeclaresHook, PluginPermissionError } from './plugin-permissions'

const manifest: PluginManifest = {
  id: 'demo',
  schemaVersion: 1,
  label: 'Demo',
  version: '0.1.0',
  entryPoint: 'index.js',
  permissions: ['project.read'],
  hooks: ['onProjectOpen']
}

describe('plugin permissions', () => {
  it('resolves permissions from the manifest catalog', () => {
    expect(hasPluginPermission(manifest, 'project.read')).toBe(true)
    expect(hasPluginPermission(manifest, 'project.write')).toBe(false)
    expect(pluginDeclaresHook(manifest, 'onProjectOpen')).toBe(true)
    expect(pluginDeclaresHook(manifest, 'onDocumentSave')).toBe(false)
  })

  it('throws a structured error when a permission is missing', () => {
    expect(() => assertPluginPermission(manifest, 'project.write')).toThrow(PluginPermissionError)
  })
})
