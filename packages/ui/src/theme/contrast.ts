/** WCAG 2.x relative luminance and contrast ratio helpers (sRGB hex input). */

export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const expanded = value.length === 3 ? value.split('').map((char) => char + char).join('') : value
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Not an opaque hex color: ${hex}`)
  }
  return [parseInt(expanded.slice(0, 2), 16), parseInt(expanded.slice(2, 4), 16), parseInt(expanded.slice(4, 6), 16)]
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

/** WCAG AA thresholds: 4.5 for text, 3 for large text and UI components. */
export const WCAG_AA = { text: 4.5, ui: 3 } as const
