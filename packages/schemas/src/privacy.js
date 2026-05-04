export const privacyMaintenanceActions = {
    rebuildIndex: {
        destructive: false,
        requiresProject: true,
        clearsUserContent: false,
        i18nLabel: 'privacy.action.rebuildIndex',
        risk: 'low'
    },
    clearPreviewCache: {
        destructive: true,
        requiresProject: false,
        clearsUserContent: false,
        i18nLabel: 'privacy.action.clearPreviewCache',
        risk: 'medium'
    },
    clearLogs: {
        destructive: true,
        requiresProject: false,
        clearsUserContent: false,
        i18nLabel: 'privacy.action.clearLogs',
        risk: 'medium'
    },
    clearThumbnails: {
        destructive: true,
        requiresProject: false,
        clearsUserContent: false,
        i18nLabel: 'privacy.action.clearThumbnails',
        risk: 'low'
    }
};
export const appAuditEvents = {
    projectOpened: { allowBody: false, allowSnippet: false, allowPath: true },
    documentSaved: { allowBody: false, allowSnippet: false, allowPath: true },
    exportCompleted: { allowBody: false, allowSnippet: false, allowPath: true },
    sharePackageCreated: { allowBody: false, allowSnippet: false, allowPath: true },
    previewFailed: { allowBody: false, allowSnippet: false, allowPath: false }
};
