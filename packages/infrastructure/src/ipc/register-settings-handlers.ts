import { ipcMain } from 'electron'

import type { IpcContractMap } from '@pecie/schemas'

import { AppSettingsService } from '../app/app-settings-service'
import { AppLoggerService } from '../logging/app-logger-service'

export function registerSettingsHandlers(appSettingsService: AppSettingsService, logger: AppLoggerService): void {
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
}
