export const timelineEventKinds = {
  checkpoint: {
    colorToken: 'info',
    icon: 'bi-bookmark-star',
    label: 'Checkpoint',
    allowsRepair: false,
    hiddenByDefault: false
  },
  milestone: {
    colorToken: 'success',
    icon: 'bi-flag',
    label: 'Milestone',
    allowsRepair: false,
    hiddenByDefault: false
  },
  restore: {
    colorToken: 'warning',
    icon: 'bi-arrow-counterclockwise',
    label: 'Ripristino',
    allowsRepair: false,
    hiddenByDefault: false
  },
  bootstrap: {
    colorToken: 'neutral',
    icon: 'bi-asterisk',
    label: 'Bootstrap',
    allowsRepair: false,
    hiddenByDefault: true
  }
} as const

export type TimelineEventKind = keyof typeof timelineEventKinds
