import { app, BrowserWindow, shell } from 'electron'
import { access, cp, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { is } from '@electron-toolkit/utils'
import {
  AppSettingsService,
  AppLoggerService,
  CitationService,
  ExportService,
  GitAdapter,
  HistoryService,
  PreviewService,
  PrivacyService,
  PluginService,
  ProjectFileSystem,
  ProjectService,
  ResearchService,
  ShareService,
  ExportRuntimeResolver,
  registerProjectHandlers,
  registerSettingsHandlers,
  registerShellHandlers
} from '@pecie/infrastructure'
import appIconPath from '../renderer/src/asset/Icon.png'
import splashLogoSvg from '../renderer/src/asset/Icon.svg?raw'

const shouldDisableElectronSandbox = process.env.ELECTRON_DISABLE_SANDBOX === '1'

if (shouldDisableElectronSandbox) {
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-setuid-sandbox')
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths))
}

function getAppIconPath(): string {
  return appIconPath
}

function getSplashLogoMarkup(): string {
  if (typeof splashLogoSvg === 'string' && splashLogoSvg.trim()) {
    return `<div class="mark mark--svg" aria-hidden="true">${splashLogoSvg}</div>`
  }

  return '<div class="mark mark--fallback" aria-hidden="true">P</div>'
}

function createSplashWindow(): BrowserWindow {
  const iconPath = getAppIconPath()
  const splashWindow = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    show: true,
    center: true,
    alwaysOnTop: true,
    backgroundColor: '#161410',
    icon: iconPath
  })

  splashWindow.loadURL(
    `data:text/html;charset=UTF-8,${encodeURIComponent(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Pecie</title>
          <style>
            body {
              margin: 0;
              display: grid;
              place-items: center;
              min-height: 100vh;
              background: radial-gradient(circle at top, #7f5d2a, transparent 35%), #161410;
              color: #f8f2e7;
              font-family: ui-sans-serif, system-ui, sans-serif;
            }
            .splash {
              display: grid;
              gap: 18px;
              justify-items: center;
              text-align: center;
            }
            .mark {
              width: 92px;
              height: 92px;
              border-radius: 28px;
              border: 1px solid rgba(248, 242, 231, 0.16);
              background: rgba(248, 242, 231, 0.08);
              display: block;
              object-fit: contain;
              padding: 10px;
            }
            .mark--svg {
              padding: 12px;
            }
            .mark--svg svg {
              display: block;
              width: 100%;
              height: 100%;
            }
            .mark--fallback {
              display: grid;
              place-items: center;
              font-size: 42px;
              font-weight: 800;
            }
            .label {
              font-size: 28px;
              font-weight: 700;
              letter-spacing: -0.04em;
            }
            .hint {
              color: rgba(248, 242, 231, 0.7);
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <main class="splash" aria-label="Pecie loading splash">
            ${getSplashLogoMarkup()}
            <div class="label">Pecie</div>
            <div class="hint">Loading workspace…</div>
          </main>
        </body>
      </html>
    `)}`
  )

  return splashWindow
}

function createWindow(splashWindow: BrowserWindow | null): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#161410',
    icon: getAppIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: !shouldDisableElectronSandbox,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    splashWindow?.close()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    let protocol = ''
    try {
      protocol = new URL(url).protocol
    } catch {
      protocol = ''
    }

    if (['https:', 'http:', 'mailto:'].includes(protocol)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    return
  }

  void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

async function pathExists(targetPath: string): Promise<boolean> {
  return access(targetPath)
    .then(() => true)
    .catch(() => false)
}

async function configureAppStorage(): Promise<string> {
  const legacyUserDataPath = app.getPath('userData')
  const previousHomeDirectory = join(app.getPath('home'), 'pecie')
  const appDataDirectory = join(app.getPath('home'), '.pecie')

  if (!(await pathExists(appDataDirectory)) && (await pathExists(previousHomeDirectory))) {
    await mkdir(appDataDirectory, { recursive: true })
    await cp(previousHomeDirectory, appDataDirectory, {
      recursive: true,
      force: false
    })
  } else if (!(await pathExists(appDataDirectory)) && (await pathExists(legacyUserDataPath))) {
    await mkdir(appDataDirectory, { recursive: true })
    await cp(legacyUserDataPath, appDataDirectory, {
      recursive: true,
      force: false
    })
  } else {
    await mkdir(appDataDirectory, { recursive: true })
  }

  app.setPath('userData', appDataDirectory)
  return appDataDirectory
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.pecie.desktop')
  const appDataDirectory = await configureAppStorage()

  const logger = new AppLoggerService(appDataDirectory)
  const appSettingsService = new AppSettingsService(appDataDirectory, app.getPath('documents'), app.getLocale())
  const projectFileSystem = new ProjectFileSystem()
  const citationService = new CitationService(projectFileSystem)
  const researchService = new ResearchService(projectFileSystem)
  const shareService = new ShareService(projectFileSystem)
  const exportRuntimeResolver = new ExportRuntimeResolver({
    resourceRoots: uniquePaths([
      join(app.getAppPath(), 'resources'),
      join(__dirname, '../../resources'),
      process.resourcesPath
    ])
  })
  const historyService = new HistoryService(projectFileSystem, new GitAdapter(), logger)
  const projectService = new ProjectService(projectFileSystem, undefined, logger, historyService)
  const privacyService = new PrivacyService(appDataDirectory, projectFileSystem, projectService, logger)
  const pluginService = new PluginService(appDataDirectory)
  registerSettingsHandlers(appSettingsService, privacyService, logger)
  registerProjectHandlers(
    projectService,
    citationService,
    researchService,
    shareService,
    historyService,
    appSettingsService,
    pluginService,
    logger
  )
  registerShellHandlers(
    new ExportService(projectFileSystem, undefined, exportRuntimeResolver),
    new PreviewService(projectFileSystem),
    appSettingsService,
    pluginService,
    logger,
    appDataDirectory
  )

  const splashWindow = createSplashWindow()
  createWindow(splashWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(null)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
