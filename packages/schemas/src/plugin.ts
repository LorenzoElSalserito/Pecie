import type { PluginHook, PluginPermission } from './generated/types.generated'

export const pluginPermissions = {
  projectRead: 'project.read',
  projectWrite: 'project.write',
  exportRead: 'export.read',
  exportWrite: 'export.write',
  citationsWrite: 'citations.write',
  logsRead: 'logs.read'
} as const satisfies Record<string, PluginPermission>

export const pluginHooks = {
  onProjectOpen: 'onProjectOpen',
  onDocumentSave: 'onDocumentSave',
  onExportProfileLoaded: 'onExportProfileLoaded',
  onExportBeforeWrite: 'onExportBeforeWrite'
} as const satisfies Record<string, PluginHook>
