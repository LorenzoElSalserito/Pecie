import type { IconName } from '@pecie/ui'

import type { EditorFormatAction } from '../types'

export type FormattingActionId = EditorFormatAction | 'visualMermaid' | 'visualMarkmap' | 'visualChart'

export type FormattingActionDefinition = {
  action: FormattingActionId
  label: string
  icon: IconName
  group: 'core' | 'insert'
}

export type CitationLibraryStatus = {
  entryCount: number
  diagnosticsCount: number
}

export type EditorPreferences = { focusMode: boolean; typewriterMode: boolean }
