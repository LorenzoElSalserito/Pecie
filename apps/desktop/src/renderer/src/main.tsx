import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

import 'bootstrap-icons/font/bootstrap-icons.css'
import './styles/app.css'

import App from './App'

globalThis.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  }
}

loader.config({ monaco })

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
