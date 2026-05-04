import type { ExpertCapabilityId, ExpertCapabilityRisk } from './generated/types.generated';
export declare const expertCapabilities: Record<ExpertCapabilityId, {
    risk: ExpertCapabilityRisk;
    requiresProject: boolean;
    i18nLabel: string;
}>;
