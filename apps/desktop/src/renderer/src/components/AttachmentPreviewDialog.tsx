import { useEffect, useRef } from 'react'

import { Button, Dialog } from '@pecie/ui'

import { t } from '../i18n'
import type { AttachmentPreviewDialogProps } from './types'

export function AttachmentPreviewDialog({
  open,
  locale,
  attachment,
  preview,
  onClose
}: AttachmentPreviewDialogProps): React.JSX.Element | null {
  const epubContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = epubContainerRef.current
    if (!open || !attachment || preview?.kind !== 'epub' || !container) {
      return
    }

    let destroyed = false
    let rendition: { destroy?: () => void; display?: () => Promise<unknown> | void } | null = null

    void import('epubjs').then((module) => {
      if (destroyed) {
        return
      }
      const EPUB = module.default
      const book = EPUB(`file://${attachment.absolutePath}`)
      rendition = book.renderTo(container, {
        width: '100%',
        height: 640
      })
      if (rendition.display) {
        void rendition.display()
      }
    })

    return () => {
      destroyed = true
      rendition?.destroy?.()
      container.innerHTML = ''
    }
  }, [attachment, open, preview?.kind])

  if (!open || !attachment) {
    return null
  }

  const fileUrl = `file://${attachment.absolutePath}`

  return (
    <Dialog open={open} onClose={onClose} size="wide" icon="bi-paperclip" title={attachment.name}>
      <div className="dialog-form">
        <div className="context-card context-card--soft">
          <dl className="meta-list">
            <div>
              <dt>{t(locale, 'format')}</dt>
              <dd>{attachment.extension || t(locale, 'notAvailable')}</dd>
            </div>
            <div>
              <dt>{t(locale, 'path')}</dt>
              <dd>{attachment.relativePath}</dd>
            </div>
          </dl>
        </div>

        {!preview ? (
          <div className="context-card context-card--soft">
            <p>{t(locale, 'loadingDocument')}</p>
          </div>
        ) : preview.kind === 'pdf' ? (
          <iframe className="attachment-preview-frame" src={fileUrl} title={attachment.name} />
        ) : preview.kind === 'epub' ? (
          <div className="attachment-preview-reader" ref={epubContainerRef} />
        ) : preview.kind === 'html' ? (
          <article
            className="attachment-preview-text attachment-preview-text--rich"
            dangerouslySetInnerHTML={{ __html: preview.htmlContent ?? '' }}
          ></article>
        ) : preview.kind === 'text' ? (
          <pre className="attachment-preview-text">{preview.textContent ?? ''}</pre>
        ) : (
          <div className="context-card context-card--soft">
            <p>{t(locale, 'attachmentPreviewUnavailable')}</p>
          </div>
        )}

        <div className="dialog-actions dialog-actions--end">
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            {t(locale, 'cancel')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
