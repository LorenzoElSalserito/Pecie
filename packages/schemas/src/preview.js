export const previewModes = {
    'ultra-performance': {
        liveSplitEnabled: false,
        exportPreviewStepEnabled: false,
        pageMarkersEnabled: true,
        pageMarkersPipeline: 'html-print-css-offset-only',
        pageMarkersRefresh: 'on-save-and-profile-change',
        livePipeline: null,
        debounceMs: null,
        refreshStrategy: 'disabled',
        disclosureKey: 'preview.mode.ultraPerformance.disclosure',
        shortLabelKey: 'preview.mode.ultraPerformance.label',
        helperKey: 'preview.mode.ultraPerformance.helper'
    },
    performance: {
        liveSplitEnabled: true,
        exportPreviewStepEnabled: true,
        pageMarkersEnabled: true,
        pageMarkersPipeline: 'html-print-css-offset-only',
        pageMarkersRefresh: 'on-save-and-profile-change',
        livePipeline: 'html-print-css',
        debounceMs: 500,
        refreshStrategy: 'debounced',
        disclosureKey: 'preview.mode.performance.disclosure',
        shortLabelKey: 'preview.mode.performance.label',
        helperKey: 'preview.mode.performance.helper'
    },
    full: {
        liveSplitEnabled: true,
        exportPreviewStepEnabled: true,
        pageMarkersEnabled: true,
        pageMarkersPipeline: 'html-print-css-offset-only',
        pageMarkersRefresh: 'on-save-and-profile-change',
        livePipeline: 'pandoc-accurate',
        debounceMs: 2000,
        refreshStrategy: 'idle-or-explicit',
        disclosureKey: 'preview.mode.full.disclosure',
        shortLabelKey: 'preview.mode.full.label',
        helperKey: 'preview.mode.full.helper'
    }
};
export const previewCapabilities = {
    pdf: { paginated: true, previewKind: 'visual', supportsPageMarkers: true },
    docx: { paginated: false, previewKind: 'approximate', supportsPageMarkers: false },
    odt: { paginated: true, previewKind: 'approximate', supportsPageMarkers: true },
    rtf: { paginated: false, previewKind: 'approximate', supportsPageMarkers: false },
    epub: { paginated: false, previewKind: 'reader', supportsPageMarkers: false },
    html: { paginated: true, previewKind: 'visual', supportsPageMarkers: true },
    latex: { paginated: true, previewKind: 'visual', supportsPageMarkers: true },
    jats: { paginated: false, previewKind: 'text', supportsPageMarkers: false },
    tei: { paginated: false, previewKind: 'text', supportsPageMarkers: false },
    md: { paginated: false, previewKind: 'text', supportsPageMarkers: false },
    txt: { paginated: false, previewKind: 'text', supportsPageMarkers: false }
};
export function arePageMarkersAvailable(mode) {
    return previewModes[mode].pageMarkersEnabled;
}
