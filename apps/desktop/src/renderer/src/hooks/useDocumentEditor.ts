import { useCallback, useEffect, useRef, useState } from 'react'

import type { AuthorProfile, DocumentRecord, SupportedLocale } from '@pecie/schemas'

import { t } from '../i18n'
import type { LoadedProject, SaveState, VisibleBinderNode } from '../components/types'

export function useDocumentEditor(
  locale: SupportedLocale,
  project: NonNullable<LoadedProject>,
  selectedNode: VisibleBinderNode | null,
  authorProfile: AuthorProfile,
  onDocumentSaved?: (document: DocumentRecord) => void,
  onManualSaved?: () => void
): {
  draftTitle: string
  draftBody: string
  documentId: string | null
  saveState: SaveState
  statusMessage: string
  setDraftTitle: (value: string) => void
  setDraftBody: (value: string) => void
  saveNow: (mode?: 'manual' | 'autosave') => Promise<void>
} {
  const [document, setDocument] = useState<DocumentRecord | null>(null)
  const [draftTitle, setDraftTitleState] = useState('')
  const [draftBody, setDraftBodyState] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [statusMessage, setStatusMessage] = useState(t(locale, 'selectDocument'))
  const autosaveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!selectedNode?.documentId) {
      setDocument(null)
      setDraftTitleState('')
      setDraftBodyState('')
      setSaveState('idle')
      setStatusMessage(t(locale, 'selectDocument'))
      return
    }

    let isActive = true
    setSaveState('saving')
    setStatusMessage(t(locale, 'loadingDocument'))

    void window.pecie
      .invokeSafe('document:load', {
        projectPath: project.projectPath,
        documentId: selectedNode.documentId
      })
      .then((response) => {
        if (!isActive) {
          return
        }

        setDocument(response.document)
        setDraftTitleState(response.document.title)
        setDraftBodyState(response.document.body)
        setSaveState('idle')
        setStatusMessage(t(locale, 'documentLoaded'))
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setSaveState('error')
        setStatusMessage(error instanceof Error ? error.message : t(locale, 'loadError'))
      })

    return () => {
      isActive = false
    }
  }, [locale, project.projectPath, selectedNode?.documentId])

  const saveNow = useCallback(
    async (mode: 'manual' | 'autosave' = 'manual'): Promise<void> => {
      if (!document) {
        return
      }

      setSaveState('saving')
      setStatusMessage(t(locale, 'saving'))

      try {
        const response = await window.pecie.invokeSafe('document:save', {
          projectPath: project.projectPath,
          documentId: document.documentId,
          title: draftTitle,
          body: draftBody,
          authorProfile
        })

        setDocument(response.document)
        setDraftTitleState(response.document.title)
        setDraftBodyState(response.document.body)
        onDocumentSaved?.(response.document)
        setSaveState('saved')
        setStatusMessage(
          t(locale, 'savedAt', {
            time: new Date(response.savedAt).toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit'
            })
          })
        )
        if (mode === 'manual') {
          onManualSaved?.()
        }
      } catch (error: unknown) {
        setSaveState('error')
        setStatusMessage(error instanceof Error ? error.message : t(locale, 'saveError'))
      }
    },
    [authorProfile, document, draftBody, draftTitle, locale, onDocumentSaved, onManualSaved, project.projectPath]
  )

  useEffect(() => {
    if (!document) {
      return
    }

    const hasChanges = draftTitle !== document.title || draftBody !== document.body
    if (!hasChanges) {
      return
    }

    setSaveState('dirty')
    setStatusMessage(t(locale, 'unsavedChanges'))

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void saveNow('autosave')
    }, 1200)

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [document, draftBody, draftTitle, locale, saveNow])

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveNow('manual')
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [saveNow])

  return {
    draftTitle,
    draftBody,
    documentId: document?.documentId ?? null,
    saveState,
    statusMessage,
    setDraftTitle: setDraftTitleState,
    setDraftBody: setDraftBodyState,
    saveNow
  }
}
