import type {
    BinderDocument,
    CitationLibrary,
    CitationProfile,
    ExportProfile,
    HistoryRepairResult,
    MilestonesSnapshot,
    PageBreakMap,
    PaginatedPreview,
    PdfLibrarySnapshot,
    PluginManifest,
    PrivacyInventoryResponse,
    ProjectManifest,
    ProjectMetadata,
    PreviewProfileBinding,
    ResearchLinkMap,
    ResearchNoteRecord,
    SharePackageManifest,
    TutorialScript,
    TimelineSnapshot
} from './generated/types.generated';
export declare const manifestSchema: Record<string, unknown>;
export declare const projectSchema: Record<string, unknown>;
export declare const binderSchema: Record<string, unknown>;
export declare const timelineSchema: Record<string, unknown>;
export declare const milestonesSchema: Record<string, unknown>;
export declare const historyRepairSchema: Record<string, unknown>;
export declare const exportProfileSchema: Record<string, unknown>;
export declare const previewProfileBindingSchema: Record<string, unknown>;
export declare const paginatedPreviewSchema: Record<string, unknown>;
export declare const pageBreakMapSchema: Record<string, unknown>;
export declare const citationProfileSchema: Record<string, unknown>;
export declare const citationLibrarySchema: Record<string, unknown>;
export declare const researchNoteSchema: Record<string, unknown>;
export declare const researchLinkMapSchema: Record<string, unknown>;
export declare const pdfLibrarySchema: Record<string, unknown>;
export declare const sharePackageManifestSchema: Record<string, unknown>;
export declare const privacyInventorySchema: Record<string, unknown>;
export declare const tutorialScriptSchema: Record<string, unknown>;
export declare const pluginManifestSchema: Record<string, unknown>;
export type SchemaDocument = {
    manifest: ProjectManifest;
    project: ProjectMetadata;
    binder: BinderDocument;
    timeline: TimelineSnapshot;
    milestones: MilestonesSnapshot;
    historyRepair: HistoryRepairResult;
    exportProfile: ExportProfile;
    previewProfileBinding: PreviewProfileBinding;
    paginatedPreview: PaginatedPreview;
    pageBreakMap: PageBreakMap;
    citationProfile: CitationProfile;
    citationLibrary: CitationLibrary;
    researchNote: ResearchNoteRecord;
    researchLinkMap: ResearchLinkMap;
    pdfLibrary: PdfLibrarySnapshot;
    sharePackageManifest: SharePackageManifest;
    privacyInventory: PrivacyInventoryResponse;
    tutorialScript: TutorialScript;
    pluginManifest: PluginManifest;
};
