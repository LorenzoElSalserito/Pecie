import { useEffect, useState, type ReactNode } from 'react'

import { ThemeContext } from './theme-context'
import { globalThemeStyles } from './theme.css'
import type { ResolvedThemeMode, ThemeMode } from './tokens'

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
  uiZoom?: 50 | 75 | 100 | 125 | 150
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
    document.documentElement.style.zoom = `${uiZoom}%`
    document.documentElement.style.setProperty('--pecie-ui-zoom', `${uiZoom}%`)
  }, [uiZoom])

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
