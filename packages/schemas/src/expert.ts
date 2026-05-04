import type { ExpertCapabilityId, ExpertCapabilityRisk } from './generated/types.generated'

export const expertCapabilities = {
  gitGraph: {
    risk: 'medium',
    requiresProject: true,
    i18nLabel: 'expert.capability.gitGraph'
  },
  rawTags: {
    risk: 'low',
    requiresProject: true,
    i18nLabel: 'expert.capability.rawTags'
  },
  guidedReset: {
    risk: 'high',
    requiresProject: true,
    i18nLabel: 'expert.capability.guidedReset'
  },
  structuredLogs: {
    risk: 'low',
    requiresProject: false,
    i18nLabel: 'expert.capability.structuredLogs'
  }
} as const satisfies Record<
  ExpertCapabilityId,
  {
    risk: ExpertCapabilityRisk
    requiresProject: boolean
    i18nLabel: string
  }
>
