import type { SupportedLocale } from '@pecie/schemas'
import type { RuntimeCapabilityReport, expertCapabilities } from '@pecie/schemas'

import { t } from '../../i18n'

export function getRuntimeCapabilityLabel(locale: SupportedLocale, capabilityId: RuntimeCapabilityReport['capabilityId']): string {
  switch (capabilityId) {
    case 'pandoc':
      return t(locale, 'exportRuntimeCapability_pandoc')
    case 'weasyprint':
      return t(locale, 'exportRuntimeCapability_weasyprint')
    case 'xelatex':
      return t(locale, 'exportRuntimeCapability_xelatex')
    case 'pdflatex':
      return t(locale, 'exportRuntimeCapability_pdflatex')
    case 'lualatex':
      return t(locale, 'exportRuntimeCapability_lualatex')
    default:
      return capabilityId
  }
}

export function getExpertCapabilityLabel(locale: SupportedLocale, capabilityId: keyof typeof expertCapabilities): string {
  switch (capabilityId) {
    case 'gitGraph':
      return t(locale, 'expertCapability_gitGraph')
    case 'rawTags':
      return t(locale, 'expertCapability_rawTags')
    case 'guidedReset':
      return t(locale, 'expertCapability_guidedReset')
    case 'structuredLogs':
      return t(locale, 'expertCapability_structuredLogs')
    default:
      return capabilityId
  }
}
