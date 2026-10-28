import { BOOTSTRAP_ICON_PATHS } from './bootstrap-icon-paths'

export type IconName = keyof typeof BOOTSTRAP_ICON_PATHS

export const iconNames = Object.keys(BOOTSTRAP_ICON_PATHS) as readonly IconName[]

export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && Object.hasOwn(BOOTSTRAP_ICON_PATHS, value)
}
