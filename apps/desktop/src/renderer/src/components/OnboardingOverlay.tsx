import { Button, Dialog } from '@pecie/ui'

import { t } from '../i18n'
import type { OnboardingOverlayProps } from './types'

export function OnboardingOverlay({ open, locale, onClose }: OnboardingOverlayProps): React.JSX.Element | null {
  if (!open) {
    return null
  }

  return (
    <Dialog open={open} onClose={onClose} size="compact" icon="bi-rocket-takeoff" title={t(locale, 'onboardingTitle')}>
      <ol className="tutorial-list">
        <li>{t(locale, 'onboardingStep1')}</li>
        <li>{t(locale, 'onboardingStep2')}</li>
        <li>{t(locale, 'onboardingStep3')}</li>
        <li>{t(locale, 'onboardingStep4')}</li>
      </ol>

      <div className="dialog-actions dialog-actions--end">
        <Button onClick={onClose} size="sm" type="button">
          {t(locale, 'understood')}
        </Button>
      </div>
    </Dialog>
  )
}
