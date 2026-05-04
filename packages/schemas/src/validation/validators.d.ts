import type {
    BinderDocument,
    CitationLibrary,
    CitationProfile,
    HistoryRepairResult,
    MilestonesSnapshot,
    PdfLibrarySnapshot,
    PluginManifest,
    PrivacyInventoryResponse,
    ProjectManifest,
    ProjectMetadata,
    ResearchLinkMap,
    ResearchNoteRecord,
    SharePackageManifest,
    TutorialScript,
    TimelineSnapshot
} from '../generated/types.generated';
export declare function validateManifest(value: unknown): ProjectManifest;
export declare function validateProjectMetadata(value: unknown): ProjectMetadata;
export declare function validateBinderDocument(value: unknown): BinderDocument;
export declare function validateHistoryRepairResult(value: unknown): HistoryRepairResult;
export declare function validateTimelineSnapshot(value: unknown): TimelineSnapshot;
export declare function validateMilestonesSnapshot(value: unknown): MilestonesSnapshot;
export declare function validateCitationProfile(value: unknown): CitationProfile;
export declare function validateCitationLibrary(value: unknown): CitationLibrary;
export declare function validateResearchNote(value: unknown): ResearchNoteRecord;
export declare function validatePdfLibrary(value: unknown): PdfLibrarySnapshot;
export declare function validateResearchLinkMap(value: unknown): ResearchLinkMap;
export declare function validateSharePackageManifest(value: unknown): SharePackageManifest;
export declare function validatePrivacyInventory(value: unknown): PrivacyInventoryResponse;
export declare function validateTutorialScript(value: unknown): TutorialScript;
export declare function validatePluginManifest(value: unknown): PluginManifest;
