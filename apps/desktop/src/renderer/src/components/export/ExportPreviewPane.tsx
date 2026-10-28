import type { PreviewExportResponse, SupportedLocale } from '@pecie/schemas'
import { Banner, Button } from '@pecie/ui'

import { t } from '../../i18n'

function renderPreviewParagraphs(value: string): React.JSX.Element[] {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => <p key={paragraph}>{paragraph}</p>)
}

export type ExportPreviewPaneProps = {
  locale: SupportedLocale
  previewResponse: PreviewExportResponse
  previewKind: 'visual' | 'reader' | 'approximate' | 'text'
  previewModeLabel: string
  projectPath: string
  pageIndex: number
  onPageIndexChange: (update: (current: number) => number) => void
}

/** Preview card shown before the final export: paged visual preview, reader, approximate or plain text. */
export function ExportPreviewPane({ locale, previewResponse, previewKind, previewModeLabel, projectPath, pageIndex, onPageIndexChange }: ExportPreviewPaneProps): React.JSX.Element {
  const previewPage = previewResponse.preview?.pages[pageIndex] ?? null
  const previewPageUrl = previewPage ? `file://${projectPath}/${previewPage.previewAssetRelPath}` : ''
  const totalPages = previewResponse.preview?.totalPages ?? 0
  return (
    <section className="context-card">
      <h3>{t(locale, 'exportPreviewTitle')}</h3>
      <Banner>{t(locale, 'exportPreviewModeLabel', { mode: previewModeLabel })}</Banner>
      {previewResponse.warningMessageKey ? <Banner>{t(locale, previewResponse.warningMessageKey)}</Banner> : null}
      {previewKind === 'visual' && previewPage ? (
        <>
          <iframe className="attachment-preview-frame" src={previewPageUrl} title={t(locale, 'exportPreviewFrameTitle')} />
          {totalPages > 1 ? (
            <div className="dialog-actions dialog-actions--end">
              <Button disabled={pageIndex === 0} onClick={() => onPageIndexChange((current) => Math.max(0, current - 1))} size="sm" type="button" variant="ghost">
                {t(locale, 'previous')}
              </Button>
              <span className="message-box">{t(locale, 'exportPreviewPageCounter', { current: String(pageIndex + 1), total: String(totalPages) })}</span>
              <Button disabled={pageIndex >= totalPages - 1} onClick={() => onPageIndexChange((current) => Math.min(totalPages - 1, current + 1))} size="sm" type="button" variant="ghost">
                {t(locale, 'next')}
              </Button>
            </div>
          ) : null}
        </>
      ) : previewKind === 'reader' ? (
        <article className="attachment-preview-reader">{renderPreviewParagraphs(previewResponse.previewText ?? '')}</article>
      ) : previewKind === 'approximate' ? (
        <article className="attachment-preview-text attachment-preview-text--rich">{renderPreviewParagraphs(previewResponse.previewText ?? '')}</article>
      ) : (
        <pre className="attachment-preview-text">{previewResponse.previewText ?? ''}</pre>
      )}
    </section>
  )
}
