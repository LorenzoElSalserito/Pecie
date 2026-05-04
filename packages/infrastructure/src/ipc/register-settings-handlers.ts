import { ipcMain } from 'electron'

import type { IpcContractMap } from '@pecie/schemas'

import { AppSettingsService } from '../app/app-settings-service'
import { AppLoggerService } from '../logging/app-logger-service'
import { PrivacyService } from '../privacy/privacy-service'

export function registerSettingsHandlers(
  appSettingsService: AppSettingsService,
  privacyService: PrivacyService,
  logger: AppLoggerService
): void {
  ipcMain.handle('settings:bootstrap', async () => {
    const response = await appSettingsService.bootstrap()
    await logger.log({
      level: 'info',
      category: 'settings',
      event: 'bootstrap',
      message: 'Application settings bootstrapped.',
      context: {
        workspaceDirectory: response.settings.workspaceDirectory,
        locale: response.settings.locale,
        firstRun: response.firstRun
      }
    })
    return response
  })

  ipcMain.handle('settings:save', async (_event, payload: IpcContractMap['settings:save']['request']) => {
    const response = await appSettingsService.saveSettings(payload)
    await logger.log({
      level: 'info',
      category: 'settings',
      event: 'settings-saved',
      message: 'Application settings saved.',
      context: {
        workspaceDirectory: response.settings.workspaceDirectory,
        locale: response.settings.locale,
        theme: response.settings.theme
      }
    })
    return response
  })

  ipcMain.handle('preview:getMode', async () => appSettingsService.getPreviewMode())

  ipcMain.handle('preview:setMode', async (_event, payload: IpcContractMap['preview:setMode']['request']) => {
    const response = await appSettingsService.setPreviewMode(payload)
    await logger.log({
      level: 'info',
      category: 'settings',
      event: 'preview-mode-saved',
      message: 'Preview mode saved.',
      context: {
        mode: response.mode
      }
    })
    return response
  })

  ipcMain.handle('privacy:getInventory', async (_event, payload: IpcContractMap['privacy:getInventory']['request']) =>
    privacyService.getInventory(payload)
  )

  ipcMain.handle('privacy:runMaintenance', async (_event, payload: IpcContractMap['privacy:runMaintenance']['request']) =>
    privacyService.runMaintenance(payload)
  )
}
