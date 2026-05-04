import type { PluginHook, PluginPermission } from './generated/types.generated';
export declare const pluginPermissions: {
    readonly projectRead: "project.read";
    readonly projectWrite: "project.write";
    readonly exportRead: "export.read";
    readonly exportWrite: "export.write";
    readonly citationsWrite: "citations.write";
    readonly logsRead: "logs.read";
} & Record<string, PluginPermission>;
export declare const pluginHooks: {
    readonly onProjectOpen: "onProjectOpen";
    readonly onDocumentSave: "onDocumentSave";
    readonly onExportProfileLoaded: "onExportProfileLoaded";
    readonly onExportBeforeWrite: "onExportBeforeWrite";
} & Record<string, PluginHook>;
