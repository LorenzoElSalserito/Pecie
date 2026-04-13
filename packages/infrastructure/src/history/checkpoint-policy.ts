export const checkpointPolicy = {
  onManualSave: 'if-content-changed',
  onAutosave: 'never',
  onMilestoneAction: 'always',
  onRestore: 'always'
} as const

export type CheckpointTrigger = keyof typeof checkpointPolicy

export function buildFallbackLabel(input: {
  trigger: CheckpointTrigger
  documentTitle?: string
  binderPath?: string[]
  nowIso: string
}): string {
  const stamp = input.nowIso.slice(0, 16).replace('T', ' ')
  const scope = input.documentTitle?.trim() || input.binderPath?.filter(Boolean).join(' / ') || 'progetto'
  return `${scope} - ${stamp}`
}
