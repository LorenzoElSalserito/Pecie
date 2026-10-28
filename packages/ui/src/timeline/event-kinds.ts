import type { IconName } from '../icons/registry'

export const timelineEventKinds = {
  checkpoint: {
    colorToken: 'info',
    icon: 'bookmark-star',
    label: 'Checkpoint',
    allowsRepair: false,
    hiddenByDefault: false
  },
  milestone: {
    colorToken: 'success',
    icon: 'flag',
    label: 'Milestone',
    allowsRepair: false,
    hiddenByDefault: false
  },
  restore: {
    colorToken: 'warning',
    icon: 'arrow-counterclockwise',
    label: 'Ripristino',
    allowsRepair: false,
    hiddenByDefault: false
  },
  bootstrap: {
    colorToken: 'neutral',
    icon: 'asterisk',
    label: 'Bootstrap',
    allowsRepair: false,
    hiddenByDefault: true
  }
} as const satisfies Record<string, { colorToken: string; icon: IconName; label: string; allowsRepair: boolean; hiddenByDefault: boolean }>

export type TimelineEventKind = keyof typeof timelineEventKinds
