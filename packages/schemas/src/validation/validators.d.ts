import type { BinderDocument, HistoryRepairResult, MilestonesSnapshot, ProjectManifest, ProjectMetadata, TimelineSnapshot } from '../generated/types.generated';
export declare function validateManifest(value: unknown): ProjectManifest;
export declare function validateProjectMetadata(value: unknown): ProjectMetadata;
export declare function validateBinderDocument(value: unknown): BinderDocument;
export declare function validateHistoryRepairResult(value: unknown): HistoryRepairResult;
export declare function validateTimelineSnapshot(value: unknown): TimelineSnapshot;
export declare function validateMilestonesSnapshot(value: unknown): MilestonesSnapshot;
