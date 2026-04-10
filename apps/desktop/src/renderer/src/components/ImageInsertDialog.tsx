import { useState } from 'react'

import { Button, Dialog } from '@pecie/ui'

import { t } from '../i18n'
import type { ImageInsertDialogProps } from './types'
import { formatFileSize } from './utils'

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])
const MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024

export function ImageInsertDialog({
  open,
  locale,
  projectPath,
  documentRelativePath,
  onClose,
  onInsert
}: ImageInsertDialogProps): React.JSX.Element | null {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [altText, setAltText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function reset(): void {
    setFilePath(null)
    setFileName('')
    setFileSize(0)
    setAltText('')
    setError(null)
    setBusy(false)
  }

  function handleClose(): void {
    reset()
    onClose()
  }

  async function handlePickFile(): Promise<void> {
    setError(null)
    const response = await window.pecie.invokeSafe('path:pickFiles', {
      allowMultiple: false,
      defaultPath: projectPath
    })
    if (response.canceled || response.paths.length === 0) {
      return
    }

    const picked = response.paths[0]
    const details = await window.pecie.invokeSafe('path:getDetails', { path: picked })
    if (!details.isFile) {
      setError(t(locale, 'imageDialogNoFile'))
      return
    }

    const name = details.name
    const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : ''

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      setError(t(locale, 'imageDialogInvalidFormat'))
      return
    }

    if (details.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      setError(t(locale, 'imageDialogTooLarge', { size: formatFileSize(MAX_IMAGE_SIZE_BYTES, locale) }))
      return
    }

    setFilePath(picked)
    setFileName(name)
    setFileSize(details.sizeBytes)

    if (!altText.trim()) {
      const baseName = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name
      setAltText(baseName.replace(/[-_]+/g, ' '))
    }
  }

  async function handleConfirm(): Promise<void> {
    if (!filePath) {
      setError(t(locale, 'imageDialogNoFile'))
      return
    }

    setBusy(true)
    setError(null)

    try {
      const response = await window.pecie.invokeSafe('image:import-asset', {
        projectPath,
        sourcePath: filePath,
        altText: altText.trim() || fileName,
        documentRelativePath
      })

      onInsert(response.markdownSnippet)
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      size="default"
      icon="bi-image"
      title={t(locale, 'imageDialogTitle')}
    >
      <div className="image-insert-dialog">
        <div className="image-insert-dialog__picker">
          <Button
            onClick={() => void handlePickFile()}
            size="sm"
            type="button"
            variant="secondary"
            disabled={busy}
          >
            <i className="bi bi-folder2-open" aria-hidden="true"></i>{' '}
            {t(locale, 'imageDialogPickFile')}
          </Button>
          {fileName ? (
            <span className="image-insert-dialog__file-info">
              <i className="bi bi-file-earmark-image" aria-hidden="true"></i>{' '}
              <strong>{fileName}</strong>
              {fileSize > 0 ? ` (${formatFileSize(fileSize, locale)})` : null}
            </span>
          ) : (
            <span className="muted-copy">{t(locale, 'imageDialogNoFile')}</span>
          )}
        </div>
        {filePath ? (
          <p className="muted-copy">{t(locale, 'imageDialogSupportedFormats', { size: formatFileSize(MAX_IMAGE_SIZE_BYTES, locale) })}</p>
        ) : null}

        <label className="field">
          <span>{t(locale, 'imageDialogAltText')}</span>
          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder={t(locale, 'imageDialogAltTextPlaceholder')}
            disabled={busy}
          />
        </label>

        {error ? (
          <p className="field-error" role="alert">{error}</p>
        ) : null}
      </div>

      <div className="dialog-actions dialog-actions--end">
        <Button onClick={handleClose} size="sm" type="button" variant="ghost" disabled={busy}>
          {t(locale, 'cancel')}
        </Button>
        <Button
          onClick={() => void handleConfirm()}
          size="sm"
          type="button"
          disabled={busy || !filePath}
        >
          {busy ? t(locale, 'imageDialogImporting') : t(locale, 'imageDialogConfirm')}
        </Button>
      </div>
    </Dialog>
  )
}
