export const tokens = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { none: 0, sm: 8, md: 13, lg: 18, xl: 24, full: 9999 },
  typography: {
    body: { size: 16, lineHeight: 1.6 },
    heading: { size: 24, lineHeight: 1.25 },
    subheading: { size: 18, lineHeight: 1.35 },
    small: { size: 13, lineHeight: 1.4 },
    caption: { size: 11, lineHeight: 1.3 }
  },
  shadow: {
    sm: '0 8px 18px rgba(28,25,21,0.06)',
    md: '0 18px 42px rgba(28,25,21,0.09)',
    lg: '0 30px 76px rgba(28,25,21,0.14)'
  },
  transition: {
    fast: '120ms ease',
    normal: '200ms ease',
    slow: '320ms ease'
  },
  color: {
    light: {
      background: '#f2ede4',
      surface: '#fffdfa',
      surfaceHover: '#f8f2e8',
      surfaceStrong: '#e9dfd0',
      text: '#201a15',
      textMuted: '#62584c',
      textSubtle: '#6f6457',
      border: '#d6c7b4',
      borderSubtle: '#e8ded0',
      accent: '#a24f28',
      accentHover: '#8d431f',
      accentText: '#fffaf5',
      warning: '#b8772e',
      success: '#2f7c4a',
      successBg: '#e6f4ea',
      focus: '#176b9b',
      danger: '#9f2621',
      dangerBg: '#fdf0ee',
      overlayBg: 'rgba(27,21,16,0.34)'
    },
    dark: {
      background: '#141210',
      surface: '#1e1b17',
      surfaceHover: '#262219',
      surfaceStrong: '#2c2820',
      text: '#f0ebe2',
      textMuted: '#b5ab9e',
      textSubtle: '#9e9589',
      border: '#3d372e',
      borderSubtle: '#2e2a23',
      accent: '#e89252',
      accentHover: '#f2a76a',
      accentText: '#1a1008',
      warning: '#d59a4f',
      success: '#5bba6b',
      successBg: '#1a2e1d',
      focus: '#7dd3fc',
      danger: '#f87171',
      dangerBg: '#2e1515',
      overlayBg: 'rgba(0,0,0,0.55)'
    },
    highContrast: {
      light: {
        background: '#f7f4ee',
        surface: '#ffffff',
        surfaceHover: '#f0e8d9',
        surfaceStrong: '#e5dbc8',
        text: '#16120d',
        textMuted: '#4c4339',
        textSubtle: '#5d544a',
        border: '#5d544a',
        borderSubtle: '#857a6f',
        accent: '#8f3800',
        accentHover: '#6e2900',
        accentText: '#fffaf4',
        warning: '#9a5b00',
        success: '#1f6a2d',
        successBg: '#e4f3e6',
        focus: '#005fcc',
        danger: '#8f1010',
        dangerBg: '#fff0f0',
        overlayBg: 'rgba(18,14,10,0.58)'
      },
      dark: {
        background: '#141210',
        surface: '#0f0d0b',
        surfaceHover: '#1f1a14',
        surfaceStrong: '#2a241d',
        text: '#fffaf2',
        textMuted: '#d2c8bb',
        textSubtle: '#c0b6aa',
        border: '#d2c8bb',
        borderSubtle: '#a89c8f',
        accent: '#ffb270',
        accentHover: '#ffc38f',
        accentText: '#140b04',
        warning: '#ffcf8a',
        success: '#79d88a',
        successBg: '#112316',
        focus: '#9fd7ff',
        danger: '#ff9a9a',
        dangerBg: '#311515',
        overlayBg: 'rgba(0,0,0,0.72)'
      }
    }
  }
} as const

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedThemeMode = Exclude<ThemeMode, 'system'>
