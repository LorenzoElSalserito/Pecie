const ALLOWED_FINAL_EXPORT_DIR = 'exports/out/'
const ALLOWED_PREVIEW_DIR = 'cache/preview/export-step/'
const ALLOWED_VISUAL_ASSET_DIR = 'exports/visual-assets/'

export type ExportWriteKind = 'final-export' | 'export-preview' | 'visual-export-asset'

export function assertWriteTarget(relPath: string, kind: ExportWriteKind): void {
  const expected =
    kind === 'final-export'
      ? ALLOWED_FINAL_EXPORT_DIR
      : kind === 'visual-export-asset'
        ? ALLOWED_VISUAL_ASSET_DIR
        : ALLOWED_PREVIEW_DIR
  const normalized = normalizeRelativePath(relPath)

  if (!normalized.startsWith(expected)) {
    throw new Error(`[export-write-guard] ${kind} tentato fuori da ${expected}: ${relPath}`)
  }
}

export function normalizeRelativePath(relPath: string): string {
  return relPath.replace(/\\/g, '/').replace(/^\.?\//, '')
}
