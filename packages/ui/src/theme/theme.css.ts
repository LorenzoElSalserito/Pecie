import { HEADING_FONT_DEFINITION, MONO_FONT_DEFINITION, UI_FONT_DEFINITION, fontFamilyStack } from '@pecie/schemas'

import { tokens } from './tokens'

function toCssVariables(prefix: string, values: Record<string, string | number>): string {
  return Object.entries(values)
    .map(([key, value]) => `${prefix}-${key}: ${value};`)
    .join('\n')
}

export const globalThemeStyles = `
:root {
  color-scheme: light dark;
  ${toCssVariables('--pecie-space', tokens.spacing)}
  ${toCssVariables('--pecie-radius', tokens.radius)}
  ${toCssVariables('--pecie-shadow', tokens.shadow)}
  ${toCssVariables('--pecie-transition', tokens.transition)}
  --pecie-font-heading: ${fontFamilyStack(HEADING_FONT_DEFINITION)};
  --pecie-font-serif: ${fontFamilyStack(HEADING_FONT_DEFINITION)};
  --pecie-font-body: ${fontFamilyStack(HEADING_FONT_DEFINITION)};
  --pecie-font-ui: ${fontFamilyStack(UI_FONT_DEFINITION)};
  --pecie-font-mono: ${fontFamilyStack(MONO_FONT_DEFINITION)};
  --pecie-font-body-scale: 1;
  --pecie-font-ui-scale: 1;
  --pecie-font-body-letter-spacing: normal;
  --pecie-font-body-word-spacing: normal;
  --pecie-body-size: ${tokens.typography.body.size}px;
  --pecie-body-line-height: ${tokens.typography.body.lineHeight};
  --pecie-heading-size: ${tokens.typography.heading.size}px;
  --pecie-heading-line-height: ${tokens.typography.heading.lineHeight};
  --pecie-subheading-size: ${tokens.typography.subheading.size}px;
  --pecie-subheading-line-height: ${tokens.typography.subheading.lineHeight};
  --pecie-small-size: ${tokens.typography.small.size}px;
  --pecie-small-line-height: ${tokens.typography.small.lineHeight};
  --pecie-caption-size: ${tokens.typography.caption.size}px;
  --pecie-caption-line-height: ${tokens.typography.caption.lineHeight};
}


[data-theme='light'] {
  ${toCssVariables('--pecie-color', tokens.color.light)}
}

[data-theme='dark'] {
  ${toCssVariables('--pecie-color', tokens.color.dark)}
}

@media (prefers-contrast: more) {
  [data-theme='light'] {
    ${toCssVariables('--pecie-color', tokens.color.highContrast.light)}
  }

  [data-theme='dark'] {
    ${toCssVariables('--pecie-color', tokens.color.highContrast.dark)}
  }
}
`
