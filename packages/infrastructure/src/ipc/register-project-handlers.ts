import { ipcMain } from 'electron'

import type { IpcContractMap } from '@pecie/schemas'

import { AppSettingsService } from '../app/app-settings-service'
import { CitationService } from '../citations/citation-service'
import { HistoryService } from '../history/history-service'
import { AppLoggerService } from '../logging/app-logger-service'
import { ProjectService } from '../project/project-service'
import { ResearchService } from '../research/research-service'
import { ShareService } from '../share/share-service'

export function registerProjectHandlers(
  projectService: ProjectService,
  citationService: CitationService,
  researchService: ResearchService,
  shareService: ShareService,
  historyService: HistoryService,
  appSettingsService: AppSettingsService,
  logger: AppLoggerService
): void {
  ipcMain.handle(
    'project:create',
    async (_event, payload: IpcContractMap['project:create']['request']) => {
      const response = await projectService.createProject(payload)
      await appSettingsService.rememberProject(response.projectPath)
      await logger.log({
        level: 'info',
        category: 'project',
        event: 'project-create-ipc',
        message: 'Renderer requested project creation.',
        context: {
          projectPath: response.projectPath
        }
      })
      return response
    }
  )

  ipcMain.handle(
    'project:open',
    async (_event, payload: IpcContractMap['project:open']['request']) => {
      const response = await projectService.openProject(payload)
      await historyService.initialize(response.projectPath)
      await appSettingsService.rememberProject(response.projectPath)
      await logger.log({
        level: 'info',
        category: 'project',
        event: 'project-open-ipc',
        message: 'Renderer requested project open.',
        context: {
          projectPath: response.projectPath
        }
      })
      return response
    }
  )

  ipcMain.handle(
    'document:load',
    async (_event, payload: IpcContractMap['document:load']['request']) => projectService.loadDocument(payload)
  )

  ipcMain.handle(
    'document:save',
    async (_event, payload: IpcContractMap['document:save']['request']) => {
      const response = await projectService.saveDocument(payload)
      await appSettingsService.rememberProject(payload.projectPath)
      await logger.log({
        level: 'info',
        category: 'project',
        event: 'project-touched',
        message: 'Project recency updated after document save.',
        context: {
          projectPath: payload.projectPath,
          documentId: payload.documentId
        }
      })
      return response
    }
  )

  ipcMain.handle(
    'citations:loadLibrary',
    async (_event, payload: IpcContractMap['citations:loadLibrary']['request']) => citationService.loadLibrary(payload)
  )

  ipcMain.handle(
    'citations:suggest',
    async (_event, payload: IpcContractMap['citations:suggest']['request']) => citationService.suggest(payload)
  )

  ipcMain.handle(
    'citations:listProfiles',
    async (_event, payload: IpcContractMap['citations:listProfiles']['request']) => citationService.listProfiles(payload)
  )

  ipcMain.handle(
    'citations:saveProfile',
    async (_event, payload: IpcContractMap['citations:saveProfile']['request']) => citationService.saveProfile(payload)
  )

  ipcMain.handle(
    'citations:setDefaultProfile',
    async (_event, payload: IpcContractMap['citations:setDefaultProfile']['request']) =>
      citationService.setDefaultProfile(payload)
  )

  ipcMain.handle(
    'research:listNotes',
    async (_event, payload: IpcContractMap['research:listNotes']['request']) => researchService.listResearchNotes(payload)
  )

  ipcMain.handle(
    'research:createNote',
    async (_event, payload: IpcContractMap['research:createNote']['request']) => researchService.createResearchNote(payload)
  )

  ipcMain.handle(
    'research:listPdfLibrary',
    async (_event, payload: IpcContractMap['research:listPdfLibrary']['request']) => researchService.listPdfLibrary(payload)
  )

  ipcMain.handle(
    'research:importPdf',
    async (_event, payload: IpcContractMap['research:importPdf']['request']) => researchService.importPdf(payload)
  )

  ipcMain.handle(
    'research:getGraph',
    async (_event, payload: IpcContractMap['research:getGraph']['request']) => researchService.getResearchGraph(payload)
  )

  ipcMain.handle(
    'research:createLink',
    async (_event, payload: IpcContractMap['research:createLink']['request']) => researchService.createLink(payload)
  )

  ipcMain.handle(
    'share:previewPackage',
    async (_event, payload: IpcContractMap['share:previewPackage']['request']) => shareService.previewPackage(payload)
  )

  ipcMain.handle(
    'share:createPackage',
    async (_event, payload: IpcContractMap['share:createPackage']['request']) => shareService.createPackage(payload)
  )

  ipcMain.handle(
    'share:importPackage',
    async (_event, payload: IpcContractMap['share:importPackage']['request']) => shareService.importPackage(payload)
  )

  ipcMain.handle(
    'history:createCheckpoint',
    async (_event, payload: IpcContractMap['history:createCheckpoint']['request']) => historyService.createCheckpoint(payload)
  )

  ipcMain.handle(
    'history:createMilestone',
    async (_event, payload: IpcContractMap['history:createMilestone']['request']) => historyService.createMilestone(payload)
  )

  ipcMain.handle(
    'history:listTimeline',
    async (_event, payload: IpcContractMap['history:listTimeline']['request']) => historyService.listTimeline(payload)
  )

  ipcMain.handle(
    'history:repairTimeline',
    async (_event, payload: IpcContractMap['history:repairTimeline']['request']) => historyService.repairTimeline(payload)
  )

  ipcMain.handle(
    'history:diffDocument',
    async (_event, payload: IpcContractMap['history:diffDocument']['request']) => projectService.diffDocument(payload)
  )

  ipcMain.handle(
    'history:restoreDocument',
    async (_event, payload: IpcContractMap['history:restoreDocument']['request']) => projectService.restoreDocument(payload)
  )

  ipcMain.handle(
    'history:restoreSelection',
    async (_event, payload: IpcContractMap['history:restoreSelection']['request']) => projectService.restoreSelection(payload)
  )

  ipcMain.handle(
    'binder:add-node',
    async (_event, payload: IpcContractMap['binder:add-node']['request']) => projectService.addBinderNode(payload)
  )

  ipcMain.handle(
    'binder:move-node',
    async (_event, payload: IpcContractMap['binder:move-node']['request']) => projectService.moveBinderNode(payload)
  )

  ipcMain.handle(
    'binder:delete-node',
    async (_event, payload: IpcContractMap['binder:delete-node']['request']) => projectService.deleteBinderNode(payload)
  )

  ipcMain.handle(
    'binder:absorb-node',
    async (_event, payload: IpcContractMap['binder:absorb-node']['request']) => projectService.absorbBinderNode(payload)
  )

  ipcMain.handle(
    'search:query',
    async (_event, payload: IpcContractMap['search:query']['request']) => projectService.searchDocuments(payload)
  )

  ipcMain.handle(
    'attachment:list',
    async (_event, payload: IpcContractMap['attachment:list']['request']) => projectService.listAttachments(payload)
  )

  ipcMain.handle(
    'attachment:import',
    async (_event, payload: IpcContractMap['attachment:import']['request']) => {
      const response = await projectService.importAttachments(payload)
      await appSettingsService.rememberProject(payload.projectPath)
      await logger.log({
        level: response.imported.length > 0 ? 'info' : 'warn',
        category: 'project',
        event: 'attachment-import-ipc',
        message: 'Renderer requested attachment import.',
        context: {
          projectPath: payload.projectPath,
          importedCount: response.imported.length,
          skippedCount: response.skipped.length
        }
      })
      return response
    }
  )

  ipcMain.handle(
    'attachment:preview',
    async (_event, payload: IpcContractMap['attachment:preview']['request']) => projectService.getAttachmentPreview(payload)
  )

  ipcMain.handle(
    'image:import-asset',
    async (_event, payload: IpcContractMap['image:import-asset']['request']) => {
      const response = await projectService.importImageAsset(payload)
      await logger.log({
        level: 'info',
        category: 'project',
        event: 'image-import-ipc',
        message: 'Image asset imported via IPC.',
        context: {
          projectPath: payload.projectPath,
          deduplicated: response.deduplicated,
          assetPath: response.asset.relativePath
        }
      })
      return response
    }
  )

  ipcMain.handle(
    'project:archive',
    async (_event, payload: IpcContractMap['project:archive']['request']) => {
      const response = await projectService.archiveProject(payload)
      await appSettingsService.archiveProject(payload.projectPath, response.projectPath)
      return response
    }
  )

  ipcMain.handle(
    'project:restore',
    async (_event, payload: IpcContractMap['project:restore']['request']) => {
      const response = await projectService.restoreProject(payload)
      await appSettingsService.restoreProject(payload.projectPath, response.projectPath)
      return response
    }
  )

  ipcMain.handle(
    'project:delete',
    async (_event, payload: IpcContractMap['project:delete']['request']) => {
      const response = await projectService.deleteProject(payload)
      await appSettingsService.removeProject(payload.projectPath)
      return response
    }
  )
}
