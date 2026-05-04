import type { AppAuditEventId, PrivacyMaintenanceActionId } from './generated/types.generated';
export declare const privacyMaintenanceActions: Record<
    PrivacyMaintenanceActionId,
    {
        destructive: boolean;
        requiresProject: boolean;
        clearsUserContent: boolean;
        i18nLabel: string;
        risk: 'low' | 'medium' | 'high';
    }
>;
export declare const appAuditEvents: Record<
    AppAuditEventId,
    {
        allowBody: boolean;
        allowSnippet: boolean;
        allowPath: boolean;
    }
>;
