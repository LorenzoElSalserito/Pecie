import type { BinderDocument, ProjectManifest, ProjectMetadata } from './generated/types.generated';
export declare const manifestSchema: {
    readonly $id: "manifest.schema.json";
    readonly type: "object";
    readonly required: readonly ["format", "formatVersion", "projectId", "title", "createdAt", "appMinVersion", "historyMode", "contentModel", "cacheModel", "defaultExportProfile", "language", "privacyMode", "embeddedHistory", "a11yProfile", "schemaUris"];
};
export declare const projectSchema: {
    readonly $id: "project.schema.json";
    readonly type: "object";
    readonly required: readonly ["title", "author", "documentKind", "defaultLanguage", "defaultBibliographyStyle", "projectVisibility", "containsSensitiveData"];
};
export declare const binderSchema: {
    readonly $id: "binder.schema.json";
    readonly type: "object";
    readonly required: readonly ["rootId", "nodes"];
};
export type SchemaDocument = {
    manifest: ProjectManifest;
    project: ProjectMetadata;
    binder: BinderDocument;
};
