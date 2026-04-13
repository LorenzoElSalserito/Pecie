export type SupportedLocale = 'it-IT' | 'en-US' | 'de-DE' | 'es-ES' | 'fr-FR' | 'pt-PT';
export type AuthorRole = 'student' | 'researcher' | 'writer' | 'editor' | 'author';
export type AppFontPreference = 'classic' | 'dyslexic';
export type AppUiZoom = 50 | 75 | 100 | 125 | 150;
export interface AuthorProfile {
    name: string;
    role: AuthorRole;
    institutionName?: string;
    department?: string;
    preferredLanguage: SupportedLocale;
}
export interface ProjectManifest {
    format: 'pecie-project';
    formatVersion: string;
    projectId: string;
    title: string;
    createdAt: string;
    lastOpenedAt?: string;
    appMinVersion: string;
    historyMode: 'git-local';
    contentModel: 'markdown-frontmatter';
    cacheModel: 'sqlite-derived';
    defaultExportProfile: string;
    language: string;
    privacyMode: 'local-first';
    embeddedHistory: boolean;
    a11yProfile: 'wcag22-aa';
    schemaUris: {
        manifest: string;
        project: string;
        binder: string;
    };
}
export interface ProjectMetadata {
    title: string;
    subtitle?: string;
    author: {
        name: string;
        role: AuthorRole;
    };
    institution?: {
        name: string;
        department?: string;
    };
    documentKind: 'thesis' | 'paper' | 'novel' | 'book' | 'journal' | 'article' | 'videoScript' | 'screenplay';
    defaultLanguage: string;
    defaultBibliographyStyle: string;
    projectVisibility: 'private-local';
    containsSensitiveData: boolean;
}
export interface BinderNode {
    id: string;
    type: 'folder' | 'document';
    title: string;
    children?: string[];
    path?: string;
    documentId?: string;
}
export interface BinderDocument {
    rootId: string;
    nodes: BinderNode[];
}
export interface DocumentRecord {
    documentId: string;
    binderNodeId: string;
    path: string;
    title: string;
    frontmatter: Record<string, string | boolean | string[]>;
    body: string;
}
export interface CreateProjectRequest {
    directory: string;
    projectName: string;
    title: string;
    language: SupportedLocale;
    template: 'thesis' | 'paper' | 'novel' | 'book' | 'journal' | 'article' | 'videoScript' | 'screenplay';
    authorProfile: AuthorProfile;
}
export interface CreateProjectResponse {
    projectPath: string;
    manifest: ProjectManifest;
    project: ProjectMetadata;
    binder: BinderDocument;
}
export interface OpenProjectRequest {
    projectPath: string;
}
export interface OpenProjectResponse {
    projectPath: string;
    manifest: ProjectManifest;
    project: ProjectMetadata;
    binder: BinderDocument;
}
export interface LoadDocumentRequest {
    projectPath: string;
    documentId: string;
}
export interface LoadDocumentResponse {
    document: DocumentRecord;
}
export interface SaveDocumentRequest {
    projectPath: string;
    documentId: string;
    title: string;
    body: string;
}
export interface SaveDocumentResponse {
    document: DocumentRecord;
    savedAt: string;
}
export interface AddBinderNodeRequest {
    projectPath: string;
    parentId: string;
    nodeType: 'folder' | 'document';
    title?: string;
}
export interface AddBinderNodeResponse {
    binder: BinderDocument;
    createdNode: BinderNode;
}
export interface MoveBinderNodeRequest {
    projectPath: string;
    nodeId: string;
    targetParentId: string;
    targetIndex: number;
}
export interface MoveBinderNodeResponse {
    binder: BinderDocument;
}
export interface DeleteBinderNodeRequest {
    projectPath: string;
    nodeId: string;
}
export interface DeleteBinderNodeResponse {
    binder: BinderDocument;
    deletedNodeIds: string[];
}
export interface SearchDocumentsRequest {
    projectPath: string;
    query: string;
    limit?: number;
}
export interface SearchDocumentsResponse {
    results: Array<{
        documentId: string;
        title: string;
        path: string;
        snippet: string;
    }>;
}
export interface ArchiveProjectRequest {
    projectPath: string;
    workspaceDirectory: string;
}
export interface ArchiveProjectResponse {
    projectPath: string;
}
export interface RestoreProjectRequest {
    projectPath: string;
    workspaceDirectory: string;
}
export interface RestoreProjectResponse {
    projectPath: string;
}
export interface DeleteProjectRequest {
    projectPath: string;
}
export interface DeleteProjectResponse {
    deleted: boolean;
}
export interface PickDirectoryRequest {
    defaultPath?: string;
}
export interface PickDirectoryResponse {
    canceled: boolean;
    path?: string;
}
export interface PickProjectRequest {
    defaultPath?: string;
}
export interface PickProjectResponse {
    canceled: boolean;
    path?: string;
}
export interface ExportDocumentRequest {
    projectPath: string;
    format: 'pdf' | 'docx' | 'odt' | 'rtf' | 'epub' | 'latex' | 'jats' | 'tei' | 'md' | 'txt';
    outputPath: string;
    scope: 'current-document' | 'whole-project';
    documentId?: string;
}
export interface ExportDocumentResponse {
    success: boolean;
    outputPath?: string;
    log: string[];
}
export interface AppSettings {
    workspaceDirectory: string;
    locale: SupportedLocale;
    theme: 'light' | 'dark' | 'system';
    fontPreference: AppFontPreference;
    uiZoom: AppUiZoom;
    recentProjectPaths: string[];
    archivedProjectPaths: string[];
    authorProfile: AuthorProfile;
    onboardingCompleted: boolean;
}
export type AppBootstrapRequest = Record<string, never>;
export interface AppBootstrapResponse {
    settings: AppSettings;
    defaults: {
        documentsDirectory: string;
        defaultWorkspaceDirectory: string;
        appDataDirectory: string;
    };
    firstRun: boolean;
    quickResume?: {
        projectPath: string;
        lastEditedSnippet: string;
        lastEditedAt: string;
    };
}
export interface SaveAppSettingsRequest {
    settings: AppSettings;
}
export interface SaveAppSettingsResponse {
    settings: AppSettings;
}
export interface LogEventRequest {
    level: 'info' | 'warn' | 'error';
    category: 'renderer' | 'main' | 'project' | 'settings' | 'export' | 'navigation' | 'bug-report';
    event: string;
    message: string;
    context?: Record<string, string | number | boolean | null>;
}
export interface LogEventResponse {
    recorded: boolean;
}
export interface ComposeBugReportRequest {
    locale: SupportedLocale;
    currentProjectPath?: string;
}
export interface ComposeBugReportResponse {
    opened: boolean;
    logPath: string;
    method: 'system-mail' | 'fallback';
}
export type IpcContractMap = {
    'settings:bootstrap': {
        request: AppBootstrapRequest;
        response: AppBootstrapResponse;
    };
    'settings:save': {
        request: SaveAppSettingsRequest;
        response: SaveAppSettingsResponse;
    };
    'log:event': {
        request: LogEventRequest;
        response: LogEventResponse;
    };
    'project:create': {
        request: CreateProjectRequest;
        response: CreateProjectResponse;
    };
    'project:open': {
        request: OpenProjectRequest;
        response: OpenProjectResponse;
    };
    'document:load': {
        request: LoadDocumentRequest;
        response: LoadDocumentResponse;
    };
    'document:save': {
        request: SaveDocumentRequest;
        response: SaveDocumentResponse;
    };
    'binder:add-node': {
        request: AddBinderNodeRequest;
        response: AddBinderNodeResponse;
    };
    'binder:move-node': {
        request: MoveBinderNodeRequest;
        response: MoveBinderNodeResponse;
    };
    'binder:delete-node': {
        request: DeleteBinderNodeRequest;
        response: DeleteBinderNodeResponse;
    };
    'search:query': {
        request: SearchDocumentsRequest;
        response: SearchDocumentsResponse;
    };
    'project:archive': {
        request: ArchiveProjectRequest;
        response: ArchiveProjectResponse;
    };
    'project:restore': {
        request: RestoreProjectRequest;
        response: RestoreProjectResponse;
    };
    'project:delete': {
        request: DeleteProjectRequest;
        response: DeleteProjectResponse;
    };
    'path:pickDirectory': {
        request: PickDirectoryRequest;
        response: PickDirectoryResponse;
    };
    'path:pickProject': {
        request: PickProjectRequest;
        response: PickProjectResponse;
    };
    'export:document': {
        request: ExportDocumentRequest;
        response: ExportDocumentResponse;
    };
    'bug-report:compose': {
        request: ComposeBugReportRequest;
        response: ComposeBugReportResponse;
    };
};
