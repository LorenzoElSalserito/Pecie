import { Button, Dialog } from '@pecie/ui'

import { t } from '../i18n'
import type { InfoDialogProps } from './types'

export function InfoDialog({ open, locale, version, onClose }: InfoDialogProps): React.JSX.Element | null {
  if (!open) {
    return null
  }

  return (
    <Dialog open={open} onClose={onClose} size="compact" icon="bi-info-circle" title={t(locale, 'infoTitle')}>
      <div className="dialog-form">
        <section className="context-card context-card--soft">
          <p>{t(locale, 'appInfoLine', { version })}</p>
        </section>
        <div className="dialog-actions dialog-actions--end">
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            {t(locale, 'cancel')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
