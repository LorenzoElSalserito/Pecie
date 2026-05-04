import type { ShareImportMode, ShareIncludeKind } from './generated/types.generated'

export const shareIncludeModes = {
  'current-only': {
    i18nLabel: 'shareInclude_current-only',
    includesHistory: false,
    includesTimelineMetadata: false
  },
  'current-plus-timeline-meta': {
    i18nLabel: 'shareInclude_current-plus-timeline-meta',
    includesHistory: false,
    includesTimelineMetadata: true
  },
  'current-plus-full-history': {
    i18nLabel: 'shareInclude_current-plus-full-history',
    includesHistory: true,
    includesTimelineMetadata: true
  },
  'current-plus-selected-milestones': {
    i18nLabel: 'shareInclude_current-plus-selected-milestones',
    includesHistory: true,
    includesTimelineMetadata: true
  }
} as const satisfies Record<
  ShareIncludeKind,
  {
    i18nLabel: string
    includesHistory: boolean
    includesTimelineMetadata: boolean
  }
>

export const shareImportModes = {
  fork: {
    i18nLabel: 'shareImportMode_fork',
    includesHistory: true,
    createsNewProjectId: true
  },
  'import-with-history': {
    i18nLabel: 'shareImportMode_import-with-history',
    includesHistory: true,
    createsNewProjectId: false
  },
  'import-without-history': {
    i18nLabel: 'shareImportMode_import-without-history',
    includesHistory: false,
    createsNewProjectId: false
  },
  'open-copy': {
    i18nLabel: 'shareImportMode_open-copy',
    includesHistory: false,
    createsNewProjectId: true
  }
} as const satisfies Record<
  ShareImportMode,
  {
    i18nLabel: string
    includesHistory: boolean
    createsNewProjectId: boolean
  }
>
