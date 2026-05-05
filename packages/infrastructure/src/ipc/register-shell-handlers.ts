import { execFile } from 'node:child_process'
import { rm, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { promisify } from 'node:util'

import { dialog, ipcMain, shell } from 'electron'

import type { IpcContractMap } from '@pecie/schemas'

import { AppSettingsService } from '../app/app-settings-service'
import { AppLoggerService } from '../logging/app-logger-service'
import { PluginService } from '../plugins/plugin-service'
import { ExportService } from '../project/export-service'
import { PreviewService } from '../preview/preview-service'

const execFileAsync = promisify(execFile)

export function registerShellHandlers(
  exportService: ExportService,
  previewService: PreviewService,
  appSettingsService: AppSettingsService,
  pluginService: PluginService,
  logger: AppLoggerService,
  appDataDirectory: string
): void {
  const legacyHomeDataDirectory = join(dirname(appDataDirectory), 'pecie')

  ipcMain.handle('path:pickDirectory', async (_event, payload: IpcContractMap['path:pickDirectory']['request']) => {
    const result = await dialog.showOpenDialog({
      defaultPath: payload.defaultPath,
      properties: ['openDirectory', 'createDirectory']
    })
    await logger.log({
      level: 'info',
      category: 'navigation',
      event: 'pick-directory',
      message: 'Directory picker opened.',
      context: {
        defaultPath: payload.defaultPath ?? null,
        canceled: result.canceled
      }
    })

    return {
      canceled: result.canceled,
      path: result.filePaths[0]
    }
  })

  ipcMain.handle('path:pickProject', async (_event, payload: IpcContractMap['path:pickProject']['request']) => {
    const result = await dialog.showOpenDialog({
      defaultPath: payload.defaultPath,
      properties: ['openDirectory'],
      filters: [
        {
          name: 'Pecie Project',
          extensions: ['pe']
        }
      ]
    })
    await logger.log({
      level: 'info',
      category: 'navigation',
      event: 'pick-project',
      message: 'Project picker opened.',
      context: {
        defaultPath: payload.defaultPath ?? null,
        canceled: result.canceled
      }
    })

    return {
      canceled: result.canceled,
      path: result.filePaths[0]
    }
  })

  ipcMain.handle('path:pickFiles', async (_event, payload: IpcContractMap['path:pickFiles']['request']) => {
    const result = await dialog.showOpenDialog({
      defaultPath: payload.defaultPath,
      properties: payload.allowMultiple ? ['openFile', 'multiSelections'] : ['openFile']
    })
    await logger.log({
      level: 'info',
      category: 'navigation',
      event: 'pick-files',
      message: 'File picker opened.',
      context: {
        defaultPath: payload.defaultPath ?? null,
        canceled: result.canceled,
        selectionCount: result.filePaths.length
      }
    })

    return {
      canceled: result.canceled,
      paths: result.filePaths
    }
  })

  ipcMain.handle('path:getDetails', async (_event, payload: IpcContractMap['path:getDetails']['request']) => {
    const details = await stat(payload.path)

    return {
      name: basename(payload.path),
      sizeBytes: details.size,
      isFile: details.isFile()
    }
  })

  ipcMain.handle(
    'path:openInFileManager',
    async (_event, payload: IpcContractMap['path:openInFileManager']['request']) => {
      const error = await shell.openPath(payload.path)
      await logger.log({
        level: error ? 'warn' : 'info',
        category: 'navigation',
        event: 'open-in-file-manager',
        message: error ? 'Failed to open path in file manager.' : 'Path opened in file manager.',
        context: {
          path: payload.path,
          success: !error
        }
      })

      return {
        success: !error
      }
    }
  )

  ipcMain.handle('export:document', async (_event, payload: IpcContractMap['export:document']['request']) => {
    const pluginResponse = await pluginService.runHookPipeline({
      hook: 'onExportBeforeWrite',
      payload: {
        projectPath: payload.projectPath,
        outputPath: payload.outputPath,
        format: payload.format,
        scope: payload.scope
      }
    })
    const response = await exportService.exportDocument(payload)
    await logger.log({
      level: response.success && pluginResponse.diagnostics.length === 0 ? 'info' : 'warn',
      category: 'export',
      event: 'export-document',
      message: 'Document export completed.',
      context: {
        projectPath: payload.projectPath,
        outputPath: payload.outputPath,
        format: payload.format,
        scope: payload.scope,
        success: response.success,
        pluginResultCount: pluginResponse.results.length,
        pluginDiagnosticCount: pluginResponse.diagnostics.length
      }
    })
    return response
  })

  ipcMain.handle('export:listProfiles', async (_event, payload: IpcContractMap['export:listProfiles']['request']) => {
    const response = await exportService.listProfiles(payload)
    const pluginResponse = await pluginService.runHookPipeline({
      hook: 'onExportProfileLoaded',
      payload: {
        projectPath: payload.projectPath,
        profiles: response.profiles.map((profile) => ({
          id: profile.id,
          label: profile.label,
          format: profile.format
        }))
      }
    })
    await logger.log({
      level: pluginResponse.diagnostics.length > 0 ? 'warn' : 'info',
      category: 'export',
      event: 'export-list-profiles',
      message: 'Export profiles listed.',
      context: {
        projectPath: payload.projectPath,
        profileCount: response.profiles.length,
        diagnosticCount: response.diagnostics.length,
        pluginResultCount: pluginResponse.results.length,
        pluginDiagnosticCount: pluginResponse.diagnostics.length
      }
    })
    return response
  })

  ipcMain.handle(
    'export:getRuntimeCapabilities',
    async () => {
      const response = await exportService.getRuntimeCapabilities()
      await logger.log({
        level: 'info',
        category: 'export',
        event: 'export-runtime-capabilities',
        message: 'Export runtime capabilities evaluated.',
        context: {
          capabilityCount: response.capabilities.length,
          runtimeVersion: response.runtimeVersion ?? null
        }
      })
      return response
    }
  )

  ipcMain.handle('export:preview', async (_event, payload: IpcContractMap['export:preview']['request']) => {
    const mode = (await appSettingsService.getPreviewMode()).mode
    const response = await exportService.renderPreview(payload, mode)
    await logger.log({
      level: response.status === 'error' ? 'warn' : 'info',
      category: 'export',
      event: 'export-preview',
      message: 'Export preview rendered.',
      context: {
        projectPath: payload.projectPath,
        scope: payload.scope,
        documentId: payload.documentId ?? null,
        profileId: payload.profileId ?? null,
        status: response.status,
        mode
      }
    })
    return response
  })

  ipcMain.handle('preview:getPageBreaks', async (_event, payload: IpcContractMap['preview:getPageBreaks']['request']) => {
    const mode = (await appSettingsService.getPreviewMode()).mode
    const response = await previewService.getPageBreaks(payload, mode)
    await logger.log({
      level: 'info',
      category: 'export',
      event: 'preview-page-breaks',
      message: 'Page break map generated.',
      context: {
        projectPath: payload.projectPath,
        documentId: payload.documentId,
        profileId: response.binding.profileId,
        mode
      }
    })
    return response
  })

  ipcMain.handle('preview:renderFast', async (_event, payload: IpcContractMap['preview:renderFast']['request']) => {
    const mode = (await appSettingsService.getPreviewMode()).mode
    const response = await previewService.renderFast(payload, mode)
    await logger.log({
      level: response.status === 'error' ? 'warn' : 'info',
      category: 'export',
      event: 'preview-render-fast',
      message: 'Preview engine fast pipeline executed.',
      context: {
        projectPath: payload.projectPath,
        documentId: payload.documentId,
        status: response.status,
        cacheKey: response.preview?.cacheKey ?? null,
        regeneratedInMs: response.regeneratedInMs ?? null,
        mode
      }
    })
    return response
  })

  ipcMain.handle('preview:renderAccurate', async (_event, payload: IpcContractMap['preview:renderAccurate']['request']) => {
    const mode = (await appSettingsService.getPreviewMode()).mode
    const response = await previewService.renderAccurate(payload, mode)
    await logger.log({
      level: response.status === 'error' ? 'warn' : 'info',
      category: 'export',
      event: 'preview-render-accurate',
      message: 'Preview engine accurate pipeline executed.',
      context: {
        projectPath: payload.projectPath,
        documentId: payload.documentId,
        status: response.status,
        cacheKey: response.preview?.cacheKey ?? null,
        regeneratedInMs: response.regeneratedInMs ?? null,
        mode
      }
    })
    return response
  })

  ipcMain.handle('log:event', async (_event, payload: IpcContractMap['log:event']['request']) => logger.log(payload))

  ipcMain.handle('plugins:listInstalled', async () => {
    const response = await pluginService.listInstalledPlugins()
    await logger.log({
      level: response.diagnostics.length > 0 ? 'warn' : 'info',
      category: 'settings',
      event: 'plugins-list-installed',
      message: 'Installed plugins listed.',
      context: {
        pluginCount: response.plugins.length,
        diagnosticCount: response.diagnostics.length
      }
    })
    return response
  })

  ipcMain.handle('plugins:setEnabled', async (_event, payload: IpcContractMap['plugins:setEnabled']['request']) => {
    const response = await pluginService.setPluginEnabled(payload.pluginId, payload.enabled)
    await logger.log({
      level: 'info',
      category: 'settings',
      event: 'plugins-set-enabled',
      message: 'Plugin enabled state updated.',
      context: {
        pluginId: payload.pluginId,
        enabled: payload.enabled,
        diagnosticCount: response.diagnostics.length
      }
    })
    return response
  })

  ipcMain.handle('bug-report:compose', async (_event, payload: IpcContractMap['bug-report:compose']['request']) => {
    const bundle = await logger.createBugReportBundle(payload)
    const subject = encodeURIComponent('[PECIE BUG REPORT]')
    const body = encodeURIComponent(
      `Please describe the issue.\n\nLocale: ${payload.locale}\nProject: ${payload.currentProjectPath ?? 'n/a'}\nLog file: ${bundle.logPath}\n`
    )

    if (process.platform === 'linux') {
      try {
        await execFileAsync('xdg-email', [
          '--subject',
          '[PECIE BUG REPORT]',
          '--body',
          `Please describe the issue.\n\nLocale: ${payload.locale}\nProject: ${payload.currentProjectPath ?? 'n/a'}\n`,
          '--attach',
          bundle.logPath,
          'commercial.lorenzodm@gmail.com'
        ])
        await logger.log({
          level: 'info',
          category: 'bug-report',
          event: 'compose-linux',
          message: 'Bug report composer opened with attachment.',
          context: {
            logPath: bundle.logPath
          }
        })
        return {
          ...bundle,
          opened: true,
          method: 'system-mail'
        }
      } catch {
        // fall back below
      }
    }

    await shell.showItemInFolder(bundle.logPath)
    await shell.openExternal(`mailto:commercial.lorenzodm@gmail.com?subject=${subject}&body=${body}`)
    await logger.log({
      level: 'warn',
      category: 'bug-report',
      event: 'compose-fallback',
      message: 'Bug report composer fallback used.',
      context: {
        logPath: bundle.logPath
      }
    })

    return bundle
  })

  ipcMain.handle('app:prepareUninstall', async () => {
    await logger.log({
      level: 'warn',
      category: 'settings',
      event: 'prepare-uninstall',
      message: 'Local application data removal requested before uninstall.',
      context: {
        appDataDirectory
      }
    })

    await rm(appDataDirectory, {
      recursive: true,
      force: true
    })
    if (legacyHomeDataDirectory !== appDataDirectory) {
      await rm(legacyHomeDataDirectory, {
        recursive: true,
        force: true
      })
    }

    return {
      success: true,
      removedPath: appDataDirectory
    }
  })
}
