import type { IpcContractMap } from '@pecie/schemas'

export const ipcContracts = {
  'settings:bootstrap': {
    request: 'AppBootstrapRequest',
    response: 'AppBootstrapResponse'
  },
  'settings:save': {
    request: 'SaveAppSettingsRequest',
    response: 'SaveAppSettingsResponse'
  },
  'preview:getMode': {
    request: 'GetPreviewModeRequest',
    response: 'GetPreviewModeResponse'
  },
  'preview:setMode': {
    request: 'SetPreviewModeRequest',
    response: 'SetPreviewModeResponse'
  },
  'preview:getPageBreaks': {
    request: 'GetPageBreaksRequest',
    response: 'GetPageBreaksResponse'
  },
  'preview:renderFast': {
    request: 'RenderFastRequest',
    response: 'RenderFastResponse'
  },
  'preview:renderAccurate': {
    request: 'RenderAccurateRequest',
    response: 'RenderAccurateResponse'
  },
  'log:event': {
    request: 'LogEventRequest',
    response: 'LogEventResponse'
  },
  'plugins:listInstalled': {
    request: 'ListInstalledPluginsRequest',
    response: 'ListInstalledPluginsResponse'
  },
  'plugins:setEnabled': {
    request: 'SetPluginEnabledRequest',
    response: 'SetPluginEnabledResponse'
  },
  'project:create': {
    request: 'CreateProjectRequest',
    response: 'CreateProjectResponse'
  },
  'project:open': {
    request: 'OpenProjectRequest',
    response: 'OpenProjectResponse'
  },
  'document:load': {
    request: 'LoadDocumentRequest',
    response: 'LoadDocumentResponse'
  },
  'document:save': {
    request: 'SaveDocumentRequest',
    response: 'SaveDocumentResponse'
  },
  'citations:loadLibrary': {
    request: 'LoadCitationLibraryRequest',
    response: 'LoadCitationLibraryResponse'
  },
  'citations:suggest': {
    request: 'SuggestCiteKeyRequest',
    response: 'SuggestCiteKeyResponse'
  },
  'citations:listProfiles': {
    request: 'ListCitationProfilesRequest',
    response: 'ListCitationProfilesResponse'
  },
  'citations:saveProfile': {
    request: 'SaveCitationProfileRequest',
    response: 'SaveCitationProfileResponse'
  },
  'citations:setDefaultProfile': {
    request: 'SetDefaultCitationProfileRequest',
    response: 'SetDefaultCitationProfileResponse'
  },
  'research:listNotes': {
    request: 'ListResearchNotesRequest',
    response: 'ListResearchNotesResponse'
  },
  'research:createNote': {
    request: 'CreateResearchNoteRequest',
    response: 'CreateResearchNoteResponse'
  },
  'research:listPdfLibrary': {
    request: 'ListPdfLibraryRequest',
    response: 'ListPdfLibraryResponse'
  },
  'research:importPdf': {
    request: 'ImportPdfRequest',
    response: 'ImportPdfResponse'
  },
  'research:getGraph': {
    request: 'GetResearchGraphRequest',
    response: 'GetResearchGraphResponse'
  },
  'research:createLink': {
    request: 'CreateResearchLinkRequest',
    response: 'CreateResearchLinkResponse'
  },
  'share:previewPackage': {
    request: 'PreviewSharePackageRequest',
    response: 'PreviewSharePackageResponse'
  },
  'share:createPackage': {
    request: 'CreateSharePackageRequest',
    response: 'CreateSharePackageResponse'
  },
  'share:importPackage': {
    request: 'ImportSharePackageRequest',
    response: 'ImportSharePackageResponse'
  },
  'privacy:getInventory': {
    request: 'GetPrivacyInventoryRequest',
    response: 'PrivacyInventoryResponse'
  },
  'privacy:runMaintenance': {
    request: 'RunMaintenanceRequest',
    response: 'RunMaintenanceResponse'
  },
  'history:createCheckpoint': {
    request: 'CreateCheckpointRequest',
    response: 'CreateCheckpointResponse'
  },
  'history:createMilestone': {
    request: 'CreateMilestoneRequest',
    response: 'CreateMilestoneResponse'
  },
  'history:listTimeline': {
    request: 'ListTimelineRequest',
    response: 'ListTimelineResponse'
  },
  'history:repairTimeline': {
    request: 'RepairTimelineRequest',
    response: 'RepairTimelineResponse'
  },
  'history:diffDocument': {
    request: 'DiffDocumentRequest',
    response: 'DiffDocumentResponse'
  },
  'history:restoreDocument': {
    request: 'RestoreDocumentRequest',
    response: 'RestoreDocumentResponse'
  },
  'history:restoreSelection': {
    request: 'RestoreSelectionRequest',
    response: 'RestoreSelectionResponse'
  },
  'binder:add-node': {
    request: 'AddBinderNodeRequest',
    response: 'AddBinderNodeResponse'
  },
  'binder:move-node': {
    request: 'MoveBinderNodeRequest',
    response: 'MoveBinderNodeResponse'
  },
  'binder:delete-node': {
    request: 'DeleteBinderNodeRequest',
    response: 'DeleteBinderNodeResponse'
  },
  'binder:absorb-node': {
    request: 'AbsorbBinderNodeRequest',
    response: 'AbsorbBinderNodeResponse'
  },
  'search:query': {
    request: 'SearchDocumentsRequest',
    response: 'SearchDocumentsResponse'
  },
  'project:archive': {
    request: 'ArchiveProjectRequest',
    response: 'ArchiveProjectResponse'
  },
  'project:restore': {
    request: 'RestoreProjectRequest',
    response: 'RestoreProjectResponse'
  },
  'project:delete': {
    request: 'DeleteProjectRequest',
    response: 'DeleteProjectResponse'
  },
  'path:pickDirectory': {
    request: 'PickDirectoryRequest',
    response: 'PickDirectoryResponse'
  },
  'path:pickProject': {
    request: 'PickProjectRequest',
    response: 'PickProjectResponse'
  },
  'path:pickFiles': {
    request: 'PickFilesRequest',
    response: 'PickFilesResponse'
  },
  'path:openInFileManager': {
    request: 'OpenPathRequest',
    response: 'OpenPathResponse'
  },
  'export:listProfiles': {
    request: 'ListExportProfilesRequest',
    response: 'ListExportProfilesResponse'
  },
  'export:getRuntimeCapabilities': {
    request: 'GetRuntimeCapabilitiesRequest',
    response: 'GetRuntimeCapabilitiesResponse'
  },
  'export:preview': {
    request: 'PreviewExportRequest',
    response: 'PreviewExportResponse'
  },
  'attachment:list': {
    request: 'ListAttachmentsRequest',
    response: 'ListAttachmentsResponse'
  },
  'attachment:import': {
    request: 'ImportAttachmentsRequest',
    response: 'ImportAttachmentsResponse'
  },
  'attachment:preview': {
    request: 'AttachmentPreviewRequest',
    response: 'AttachmentPreviewResponse'
  },
  'export:document': {
    request: 'ExportDocumentRequest',
    response: 'ExportDocumentResponse'
  },
  'bug-report:compose': {
    request: 'ComposeBugReportRequest',
    response: 'ComposeBugReportResponse'
  },
  'app:prepareUninstall': {
    request: 'PrepareUninstallRequest',
    response: 'PrepareUninstallResponse'
  }
} as const

export type IpcChannel = keyof IpcContractMap
