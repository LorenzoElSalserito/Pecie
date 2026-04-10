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
  --pecie-font-heading: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
  --pecie-font-serif: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
  --pecie-font-body: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
  --pecie-font-ui: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  --pecie-font-mono: "IBM Plex Mono", "SFMono-Regular", monospace;
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

[data-font='dyslexic'] {
  --pecie-font-body: "OpenDyslexicRegular", "OpenDyslexic", "Arial", sans-serif;
  --pecie-font-ui: "OpenDyslexicRegular", "OpenDyslexic", "Arial", sans-serif;
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
