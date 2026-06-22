import { useEffect, useState, type ReactNode } from 'react'

import { ThemeContext } from './theme-context'
import { globalThemeStyles } from './theme.css'
import { tokens, type ResolvedThemeMode, type ThemeMode } from './tokens'

export const UI_ZOOM_OPTIONS = [10, 25, 50, 75, 100, 125, 150] as const
export type AppUiZoom = (typeof UI_ZOOM_OPTIONS)[number]

function resolveTheme(mode: ThemeMode): ResolvedThemeMode {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  return mode
}

export function ThemeProvider({
  children,
  defaultMode = 'system',
  fontPreference = 'classic',
  uiZoom = 100
}: {
  children: ReactNode
  defaultMode?: ThemeMode
  fontPreference?: 'classic' | 'dyslexic'
  uiZoom?: AppUiZoom
}): React.JSX.Element {
  const [mode, setMode] = useState<ThemeMode>(defaultMode)
  const [resolvedMode, setResolvedMode] = useState<ResolvedThemeMode>(() => resolveTheme(defaultMode))

  useEffect(() => {
    setMode(defaultMode)
    setResolvedMode(resolveTheme(defaultMode))
  }, [defaultMode])

  useEffect(() => {
    const nextMode = resolveTheme(mode)
    setResolvedMode(nextMode)
    document.documentElement.dataset.theme = nextMode
  }, [mode])

  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.pecieTheme = 'true'
    style.textContent = globalThemeStyles
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.font = fontPreference
  }, [fontPreference])

  useEffect(() => {
    document.documentElement.style.removeProperty('zoom')
    document.body.style.removeProperty('zoom')
    document.documentElement.dataset.uiZoom = String(uiZoom)
    document.documentElement.style.setProperty('--pecie-ui-zoom', `${uiZoom}%`)
    document.documentElement.style.fontSize = `${uiZoom}%`

    const fontScale = fontPreference === 'dyslexic' ? 0.9 : 1
    const uiFontScale = fontPreference === 'dyslexic' ? 0.92 : 1
    const zoomScale = uiZoom / 100
    document.documentElement.style.setProperty('--pecie-body-size', `${tokens.typography.body.size * fontScale * zoomScale}px`)
    document.documentElement.style.setProperty('--pecie-heading-size', `${tokens.typography.heading.size * uiFontScale * zoomScale}px`)
    document.documentElement.style.setProperty('--pecie-subheading-size', `${tokens.typography.subheading.size * uiFontScale * zoomScale}px`)
    document.documentElement.style.setProperty('--pecie-small-size', `${tokens.typography.small.size * uiFontScale * zoomScale}px`)
    document.documentElement.style.setProperty('--pecie-caption-size', `${tokens.typography.caption.size * uiFontScale * zoomScale}px`)
  }, [fontPreference, uiZoom])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (): void => {
      if (mode === 'system') {
        setResolvedMode(resolveTheme('system'))
        document.documentElement.dataset.theme = resolveTheme('system')
      }
    }

    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [mode])

  return (
    <ThemeContext.Provider
      value={{
        mode,
        resolvedMode,
        setMode
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}
