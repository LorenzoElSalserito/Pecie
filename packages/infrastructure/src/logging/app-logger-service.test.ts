import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { AppLoggerService } from './app-logger-service'

describe('AppLoggerService', () => {
  const cleanupPaths: string[] = []

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((target) => rm(target, { recursive: true, force: true })))
  })

  it('writes structured logs when context is privacy-safe', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'pecie-logger-'))
    cleanupPaths.push(directory)
    const logger = new AppLoggerService(directory)

    const response = await logger.log({
      level: 'info',
      category: 'project',
      event: 'project-opened',
      message: 'Project opened.',
      context: {
        projectPath: '/tmp/demo.pe',
        documentId: 'doc-1'
      }
    })

    expect(response.recorded).toBe(true)
    const logContent = await readFile(logger.getSessionLogPath(), 'utf8')
    expect(logContent).toContain('project-opened')
  })

  it('rejects content-bearing fields in log context', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'pecie-logger-sensitive-'))
    cleanupPaths.push(directory)
    const logger = new AppLoggerService(directory)

    await expect(
      logger.log({
        level: 'warn',
        category: 'project',
        event: 'document-loaded',
        message: 'Document loaded.',
        context: {
          markdown: '# secret'
        }
      })
    ).rejects.toThrow(/markdown/i)
  })

  it('enforces audit event path restrictions from the central catalog', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'pecie-logger-audit-'))
    cleanupPaths.push(directory)
    const logger = new AppLoggerService(directory)

    await expect(
      logger.log({
        level: 'warn',
        category: 'project',
        event: 'previewFailed',
        message: 'Preview failed.',
        context: {
          projectPath: '/tmp/demo.pe'
        }
      })
    ).rejects.toThrow(/path field/i)
  })
})
