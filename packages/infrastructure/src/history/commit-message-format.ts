export const commitMessageFormat = {
  checkpoint: ({ label }: { label: string }) => `checkpoint: ${label}`,
  milestone: ({ label }: { label: string }) => `milestone: ${label}`,
  restore: ({ label }: { label: string }) => `restore: ${label}`,
  bootstrap: () => 'bootstrap: initial project state'
} as const

export type CommitMessageKind = keyof typeof commitMessageFormat

const COMMIT_MESSAGE_RE = /^(checkpoint|milestone|restore|bootstrap):\s*(.*)$/i

export function parseCommitMessage(message: string): { kind: CommitMessageKind | 'unknown'; label: string } {
  const match = message.trim().match(COMMIT_MESSAGE_RE)
  if (!match) {
    return {
      kind: 'unknown',
      label: message.trim()
    }
  }

  return {
    kind: match[1].toLowerCase() as CommitMessageKind,
    label: (match[2] ?? '').trim()
  }
}
