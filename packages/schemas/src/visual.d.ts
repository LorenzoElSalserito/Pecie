import type { ChartBlock, VisualBlockCapabilityId, VisualBlockKind } from './generated/types.generated';
export declare const visualBlockCapabilities: Record<VisualBlockCapabilityId, {
    blockKind: VisualBlockKind;
    library: string;
    renderer: string;
    insertCommand: string;
    exportStrategy: 'svg-first' | 'svg-or-png-snapshot';
    i18nLabel: string;
}>;
export declare const visualBlockInsertCommands: {
    readonly mermaidDiagram: {
        readonly capability: "mermaidDiagram";
        readonly markdownFence: "mermaid";
        readonly templateFactory: () => string;
    };
    readonly markmapMindmap: {
        readonly capability: "markmapMindmap";
        readonly markdownFence: "markmap";
        readonly templateFactory: () => string;
    };
    readonly rechartsStats: {
        readonly capability: "rechartsStats";
        readonly markdownFence: "chart";
        readonly templateFactory: () => string;
    };
};
export type VisualBlockInsertCommandId = keyof typeof visualBlockInsertCommands;
export type { ChartBlock };
