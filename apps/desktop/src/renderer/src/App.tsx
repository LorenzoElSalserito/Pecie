import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  AppBootstrapResponse,
  AppSettings,
  AttachmentPreviewResponse,
  AttachmentRecord,
  BinderNode,
  SupportedLocale
} from '@pecie/schemas'
import { ThemeProvider } from '@pecie/ui'

import { AttachmentPreviewDialog } from './components/AttachmentPreviewDialog'
import { ExportDialog } from './components/ExportDialog'
import { GuideCenterDialog } from './components/GuideCenterDialog'
import { InfoDialog } from './components/InfoDialog'
import { Launcher } from './components/Launcher'
import { OnboardingOverlay } from './components/OnboardingOverlay'
import { OpenProjectDialog } from './components/OpenProjectDialog'
import { ProjectLibraryDialog } from './components/ProjectLibraryDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { SetupWizard } from './components/SetupWizard'
import { ToastViewport } from './components/ToastViewport'
import type { GuideCenterSection, LoadedProject, ToastItem, ToastTone } from './components/types'
import { createToast, logEvent } from './components/utils'
import { Workspace } from './components/Workspace'
import { t } from './i18n'
import 'open-dyslexic/open-dyslexic-regular.css'
import desktopPackage from '../../../package.json'

function AppShell(): React.JSX.Element {
  const [bootstrap, setBootstrap] = useState<AppBootstrapResponse | null>(null)
  const [project, setProject] = useState<LoadedProject>(null)
  const [selectedNode, setSelectedNode] = useState<BinderNode | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false)
  const [isProjectLibraryOpen, setIsProjectLibraryOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentRecord | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreviewResponse['preview'] | null>(null)
  const [isGuideCenterOpen, setIsGuideCenterOpen] = useState(false)
  const [guideCenterSection, setGuideCenterSection] = useState<GuideCenterSection>('quick-start')
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const lastToastRef = useRef<{ message: string; tone: ToastTone; at: number } | null>(null)

  const loadBootstrap = useCallback(async () => {
    const response = await window.pecie.invokeSafe('settings:bootstrap', {})
    setBootstrap(response)
  }, [])

  const pushToast = useCallback((message: string, tone: ToastTone = 'success') => {
    const now = Date.now()
    const lastToast = lastToastRef.current
    if (lastToast && lastToast.message === message && lastToast.tone === tone && now - lastToast.at < 1600) {
      return
    }
    lastToastRef.current = { message, tone, at: now }
    setToasts((currentToasts) => [...currentToasts, createToast(message, tone)])
  }, [])

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId))
  }, [])

  useEffect(() => {
    void loadBootstrap()
  }, [loadBootstrap])

  const settings = bootstrap?.settings
  const locale = settings?.locale ?? 'en-US'

  const saveSettings = useCallback(
    async (nextSettings: AppSettings) => {
      const response = await window.pecie.invokeSafe('settings:save', { settings: nextSettings })
      await logEvent('info', 'settings', 'settings-save-request', 'Renderer requested settings save.', {
        locale: response.settings.locale,
        theme: response.settings.theme
      })
      setBootstrap((currentBootstrap) =>
        currentBootstrap
          ? { ...currentBootstrap, settings: response.settings, firstRun: !response.settings.authorProfile.name.trim() }
          : null
      )
      setIsSettingsOpen(false)
      pushToast(t(response.settings.locale, 'toastSettingsSaved'))
    },
    [pushToast]
  )

  const openProject = useCallback(
    async (projectPath: string) => {
      await logEvent('info', 'navigation', 'open-project-request', 'Renderer requested project open.', { projectPath })
      const openedProject = await window.pecie.invokeSafe('project:open', { projectPath })
      setProject(openedProject)
      setSelectedNode(null)
      setIsOpenDialogOpen(false)
      await loadBootstrap()
      pushToast(
        t(openedProject.manifest.language as SupportedLocale, 'toastWelcomeBackProject', {
          project: openedProject.manifest.title
        }),
        'info'
      )
    },
    [loadBootstrap, pushToast]
  )

  const archiveProject = useCallback(
    async (projectPath: string) => {
      await window.pecie.invokeSafe('project:archive', { projectPath, workspaceDirectory: settings?.workspaceDirectory ?? '' })
      if (project?.projectPath === projectPath) {
        setProject(null)
        setSelectedNode(null)
      }
      await loadBootstrap()
      pushToast(t(locale, 'toastProjectArchived'))
    },
    [loadBootstrap, locale, project?.projectPath, pushToast, settings?.workspaceDirectory]
  )

  const restoreProject = useCallback(
    async (projectPath: string) => {
      await window.pecie.invokeSafe('project:restore', { projectPath, workspaceDirectory: settings?.workspaceDirectory ?? '' })
      await loadBootstrap()
      pushToast(t(locale, 'toastProjectRestored'))
    },
    [loadBootstrap, locale, pushToast, settings?.workspaceDirectory]
  )

  const deleteProject = useCallback(
    async (projectPath: string) => {
      await window.pecie.invokeSafe('project:delete', { projectPath })
      if (project?.projectPath === projectPath) {
        setProject(null)
        setSelectedNode(null)
      }
      await loadBootstrap()
      pushToast(t(locale, 'toastProjectDeleted'))
    },
    [loadBootstrap, locale, project?.projectPath, pushToast]
  )

  if (!bootstrap || !settings) {
    return <main className="app-loading">{t(locale, 'loadingApp')}</main>
  }

  const onboardingOpen = !settings.onboardingCompleted && !bootstrap.firstRun && !project

  return (
    <ThemeProvider defaultMode={settings.theme} fontPreference={settings.fontPreference} key={`${settings.theme}-${settings.fontPreference}`}>
      <>
        <ToastViewport dismissLabel={t(locale, 'dismissToast')} onDismiss={dismissToast} toasts={toasts} />
        <AttachmentPreviewDialog
          attachment={previewAttachment}
          locale={locale}
          onClose={() => {
            setPreviewAttachment(null)
            setAttachmentPreview(null)
          }}
          open={Boolean(previewAttachment)}
          preview={attachmentPreview}
        />
        <GuideCenterDialog
          initialSection={guideCenterSection}
          locale={locale}
          onClose={() => setIsGuideCenterOpen(false)}
          open={isGuideCenterOpen}
        />
        <InfoDialog locale={locale} onClose={() => setIsInfoOpen(false)} open={isInfoOpen} version={desktopPackage.version} />
        <a className="skip-link" href="#app-main-content">
          {t(locale, 'skipToContent')}
        </a>

        <div id="app-main-content">
          {bootstrap.firstRun ? (
            <SetupWizard bootstrap={bootstrap} onComplete={saveSettings} />
          ) : project ? (
            <Workspace
              authorProfile={settings.authorProfile}
              locale={locale}
              onBackToProjects={() => {
                void logEvent('info', 'navigation', 'back-to-projects', 'Returned to project home.')
                setProject(null)
              }}
              onManageProjects={() => setIsProjectLibraryOpen(true)}
              onManualDocumentSaved={() => pushToast(t(locale, 'toastDocumentSaved'))}
              onNewProject={() => setProject(null)}
              onNotify={pushToast}
              onOpenExport={() => setIsExportOpen(true)}
              onOpenGuide={() => {
                setGuideCenterSection('markdown-guide')
                setIsGuideCenterOpen(true)
              }}
              onOpenProject={() => setIsOpenDialogOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onPreviewAttachment={(attachment) => {
                if (!attachment) {
                  setPreviewAttachment(null)
                  setAttachmentPreview(null)
                  return
                }
                setPreviewAttachment(attachment)
                setAttachmentPreview(null)
                void window.pecie
                  .invokeSafe('attachment:preview', {
                    projectPath: project.projectPath,
                    relativePath: attachment.relativePath
                  })
                  .then((response) => setAttachmentPreview(response.preview))
                  .catch(() => {
                    setAttachmentPreview({
                      kind: 'unsupported'
                    })
                  })
              }}
              onProjectChange={setProject}
              onSelectionChange={setSelectedNode}
              project={project}
            />
          ) : (
            <Launcher
              appVersion={desktopPackage.version}
              quickResume={bootstrap.quickResume}
              onOpenGuide={() => {
                setGuideCenterSection('quick-start')
                setIsGuideCenterOpen(true)
              }}
              onOpenInfo={() => setIsInfoOpen(true)}
              onOpenProjectDialog={() => setIsOpenDialogOpen(true)}
              onOpenProjectLibrary={() => setIsProjectLibraryOpen(true)}
              onOpenRecentProject={openProject}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onProjectCreated={(createdProject) => {
                void logEvent('info', 'project', 'project-created-ui', 'Project created from launcher.', {
                  projectPath: createdProject.projectPath
                })
                setProject(createdProject)
                setSelectedNode(null)
                void loadBootstrap()
                pushToast(t(createdProject.manifest.language as SupportedLocale, 'toastProjectCreated'))
              }}
              settings={settings}
            />
          )}
        </div>

        <SettingsDialog
          appDataDirectory={bootstrap.defaults.appDataDirectory}
          currentProjectPath={project?.projectPath}
          onClose={() => setIsSettingsOpen(false)}
          onPrepareUninstall={async () => {
            const response = await window.pecie.invokeSafe('app:prepareUninstall', {})
            if (response.success) {
              pushToast(t(locale, 'toastUninstallPrepared'))
            }
          }}
          onSave={saveSettings}
          open={isSettingsOpen}
          settings={settings}
        />

        <OpenProjectDialog
          locale={locale}
          onClose={() => setIsOpenDialogOpen(false)}
          onOpenProject={openProject}
          open={isOpenDialogOpen}
          recentProjectPaths={settings.recentProjectPaths}
          workspaceDirectory={settings.workspaceDirectory}
        />

        <ProjectLibraryDialog
          currentProjectPath={project?.projectPath}
          locale={locale}
          onArchiveProject={archiveProject}
          onClose={() => setIsProjectLibraryOpen(false)}
          onDeleteProject={deleteProject}
          onOpenProject={openProject}
          onRestoreProject={restoreProject}
          open={isProjectLibraryOpen}
          settings={settings}
        />

        <ExportDialog
          locale={locale}
          onClose={() => setIsExportOpen(false)}
          open={isExportOpen}
          project={project}
          selectedNode={selectedNode}
          workspaceDirectory={settings.workspaceDirectory}
        />

        <OnboardingOverlay
          locale={locale}
          onClose={() =>
            void saveSettings({
              ...settings,
              onboardingCompleted: true
            })
          }
          open={onboardingOpen}
        />
      </>
    </ThemeProvider>
  )
}

export default function App(): React.JSX.Element {
  return <AppShell />
}
