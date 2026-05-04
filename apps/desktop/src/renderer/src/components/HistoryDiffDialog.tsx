import { useEffect, useRef, useState } from 'react'

import { Button, Dialog } from '@pecie/ui'

import { t } from '../i18n'
import type { HistoryDiffDialogProps } from './types'

export function HistoryDiffDialog({
  open,
  locale,
  title,
  subtitle,
  diff,
  busy = false,
  canRestore = false,
  onClose,
  onRestore,
  onRestoreSelection
}: HistoryDiffDialogProps): React.JSX.Element | null {
  const [selectedRange, setSelectedRange] = useState<{ startOffset: number; endOffset: number } | null>(null)
  const historicalTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  function resolveSelectedRange(): { startOffset: number; endOffset: number } | null {
    if (selectedRange) {
      return selectedRange
    }

    const textarea = historicalTextareaRef.current
    if (!textarea) {
      return null
    }

    const startOffset = textarea.selectionStart ?? 0
    const endOffset = textarea.selectionEnd ?? 0
    return endOffset > startOffset ? { startOffset, endOffset } : null
  }

  useEffect(() => {
    setSelectedRange(null)
  }, [diff, open])

  if (!open || !diff) {
    return null
  }

  const hasSelectionRestore = Boolean(onRestoreSelection)

  return (
    <Dialog open={open} onClose={onClose} size="wide" icon="bi-layout-text-window-reverse" title={title} description={subtitle}>
      <div className="history-diff-dialog">
        <div className="history-diff-dialog__panes">
          <section className="history-diff-pane">
            <header className="history-diff-pane__header">
              <strong>{diff.before.label}</strong>
              <span>{new Date(diff.before.createdAt).toLocaleString(locale)}</span>
            </header>
            <textarea
              className="history-diff-pane__content history-diff-pane__content--textarea"
              defaultValue={diff.before.content}
              readOnly
              ref={historicalTextareaRef}
              onSelect={(event) => {
                if (!hasSelectionRestore) {
                  return
                }
                const target = event.currentTarget
                const startOffset = target.selectionStart ?? 0
                const endOffset = target.selectionEnd ?? 0
                if (endOffset > startOffset) {
                  setSelectedRange({ startOffset, endOffset })
                }
              }}
            />
          </section>
          <section className="history-diff-pane">
            <header className="history-diff-pane__header">
              <strong>{diff.after.label}</strong>
              <span>{new Date(diff.after.createdAt).toLocaleString(locale)}</span>
            </header>
            <pre className="history-diff-pane__content">{diff.after.content}</pre>
          </section>
        </div>
        {'warning' in diff ? <p className="history-diff-dialog__warning">{diff.warning}</p> : null}
        <div className="dialog-actions">
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            {t(locale, 'close')}
          </Button>
          {hasSelectionRestore ? (
            <Button
              onClick={() => {
                const range = resolveSelectedRange()
                if (!range) {
                  return
                }
                void onRestoreSelection?.(range)
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              {t(locale, 'restoreSelectedText')}
            </Button>
          ) : null}
          {canRestore && onRestore ? (
            <Button disabled={busy} onClick={() => void onRestore()} size="sm" type="button" variant="secondary">
              {busy ? t(locale, 'restoringDocument') : t(locale, 'restoreThisVersion')}
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  )
}
