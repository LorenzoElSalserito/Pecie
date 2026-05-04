import { createHash } from 'node:crypto'

import type { PreviewMode } from '@pecie/schemas'

export function computePreviewCacheKey(input: {
  normalizedMarkdown: string
  serializedProfile: string
  mode: PreviewMode
  schemaVersion: number
}): string {
  const hash = createHash('sha256')
  hash.update('v')
  hash.update(String(input.schemaVersion))
  hash.update('\0')
  hash.update(input.mode)
  hash.update('\0')
  hash.update(input.serializedProfile)
  hash.update('\0')
  hash.update(input.normalizedMarkdown)
  return hash.digest('hex')
}
