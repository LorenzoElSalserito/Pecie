import type { ExportFormat, PreviewMode } from './generated/types.generated';
export declare const previewModes: {
    readonly 'ultra-performance': {
        readonly liveSplitEnabled: false;
        readonly exportPreviewStepEnabled: false;
        readonly pageMarkersEnabled: true;
        readonly pageMarkersPipeline: "html-print-css-offset-only";
        readonly pageMarkersRefresh: "on-save-and-profile-change";
        readonly livePipeline: null;
        readonly debounceMs: null;
        readonly refreshStrategy: "disabled";
        readonly disclosureKey: "preview.mode.ultraPerformance.disclosure";
        readonly shortLabelKey: "preview.mode.ultraPerformance.label";
        readonly helperKey: "preview.mode.ultraPerformance.helper";
    };
    readonly performance: {
        readonly liveSplitEnabled: true;
        readonly exportPreviewStepEnabled: true;
        readonly pageMarkersEnabled: true;
        readonly pageMarkersPipeline: "html-print-css-offset-only";
        readonly pageMarkersRefresh: "on-save-and-profile-change";
        readonly livePipeline: "html-print-css";
        readonly debounceMs: 500;
        readonly refreshStrategy: "debounced";
        readonly disclosureKey: "preview.mode.performance.disclosure";
        readonly shortLabelKey: "preview.mode.performance.label";
        readonly helperKey: "preview.mode.performance.helper";
    };
    readonly full: {
        readonly liveSplitEnabled: true;
        readonly exportPreviewStepEnabled: true;
        readonly pageMarkersEnabled: true;
        readonly pageMarkersPipeline: "html-print-css-offset-only";
        readonly pageMarkersRefresh: "on-save-and-profile-change";
        readonly livePipeline: "pandoc-accurate";
        readonly debounceMs: 2000;
        readonly refreshStrategy: "idle-or-explicit";
        readonly disclosureKey: "preview.mode.full.disclosure";
        readonly shortLabelKey: "preview.mode.full.label";
        readonly helperKey: "preview.mode.full.helper";
    };
};
export declare const previewCapabilities: Record<ExportFormat, {
    paginated: boolean;
    previewKind: 'visual' | 'approximate' | 'reader' | 'text';
    supportsPageMarkers: boolean;
}>;
export declare function arePageMarkersAvailable(mode: PreviewMode): true;
