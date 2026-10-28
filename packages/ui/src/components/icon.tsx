import type { SVGAttributes } from 'react'

import { BOOTSTRAP_ICON_PATHS, type IconPath } from '../icons/bootstrap-icon-paths'
import type { IconName } from '../icons/registry'
import type { IconSize } from '../theme/semantic-tokens'

export type { IconName }

export type IconProps = Omit<SVGAttributes<SVGSVGElement>, 'children' | 'viewBox' | 'fill' | 'name'> & {
  /** Glyph name from the embedded Bootstrap Icons subset (without the `bi-` prefix). */
  name: IconName
  /** Accessible label; when omitted the icon is purely decorative and hidden from assistive tech. */
  label?: string
  /** Fixed box from the icon size tokens; without it the icon is 1em and follows `font-size`. */
  size?: IconSize
}

/**
 * Inline SVG icon rendered from embedded path data. The glyph lives in the JavaScript bundle:
 * no webfont, no asset URL, nothing that can fail to load once the app is installed elsewhere.
 *
 * Sized through `font-size` (1em box) so the existing `.bi` typography rules keep working, or
 * through `size` for a fixed box from the icon size tokens.
 */
export function Icon({ name, label, size, className, ...props }: IconProps): React.JSX.Element {
  const classes = ['pecie-icon', 'bi', `bi-${name}`, size ? `pecie-icon--${size}` : null, className].filter(Boolean).join(' ')
  const accessibility = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const }
  const paths: readonly IconPath[] = BOOTSTRAP_ICON_PATHS[name]
  return (
    <svg
      {...accessibility}
      {...props}
      className={classes}
      data-icon={name}
      fill="currentColor"
      focusable="false"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      {label ? <title>{label}</title> : null}
      {paths.map((path, index) => (
        <path d={path.d} fillRule={path.fillRule} key={`${name}-${index}`} />
      ))}
    </svg>
  )
}
