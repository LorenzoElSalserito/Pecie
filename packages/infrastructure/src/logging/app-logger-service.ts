import { appendFile, copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

import type {
  AppAuditEventId,
  ComposeBugReportRequest,
  ComposeBugReportResponse,
  LogEventRequest,
  LogEventResponse
} from '@pecie/schemas'
import { appAuditEvents } from '@pecie/schemas'

const CONTENT_FIELD_NAMES = new Set(['body', 'content', 'markdown', 'snippet'])
const PATH_FIELD_NAMES = new Set([
  'path',
  'projectPath',
  'outputPath',
  'absolutePath',
  'currentProjectPath',
  'logPath',
  'defaultPath',
  'assetPath',
  'existingPath'
])

export class AppLoggerService {
  private readonly logsDirectory: string
  private readonly sessionId: string
  private readonly sessionLogPath: string

  public constructor(private readonly userDataDirectory: string) {
    this.logsDirectory = path.join(userDataDirectory, 'logs')
    this.sessionId = new Date().toISOString().replaceAll(':', '-')
    this.sessionLogPath = path.join(this.logsDirectory, `pecie-session-${this.sessionId}.jsonl`)
  }

  public async log(input: LogEventRequest): Promise<LogEventResponse> {
    this.assertPrivacyBoundaries(input)
    await mkdir(this.logsDirectory, { recursive: true })
    const record = {
      timestamp: new Date().toISOString(),
      level: input.level,
      category: input.category,
      event: input.event,
      message: input.message,
      context: input.context ?? {}
    }

    await appendFile(this.sessionLogPath, `${JSON.stringify(record)}\n`, 'utf8')
    return { recorded: true }
  }

  public async createBugReportBundle(input: ComposeBugReportRequest): Promise<ComposeBugReportResponse> {
    await mkdir(this.logsDirectory, { recursive: true })
    const exportedLogPath = path.join(this.logsDirectory, 'pecie-bug-report-latest.jsonl')
    await copyFile(this.sessionLogPath, exportedLogPath)
    await this.log({
      level: 'info',
      category: 'bug-report',
      event: 'bundle-created',
      message: 'Bug report log bundle prepared.',
      context: {
        locale: input.locale,
        currentProjectPath: input.currentProjectPath ?? null,
        logPath: exportedLogPath
      }
    })

    return {
      opened: false,
      logPath: exportedLogPath,
      method: 'fallback'
    }
  }

  public getSessionLogPath(): string {
    return this.sessionLogPath
  }

  private assertPrivacyBoundaries(input: LogEventRequest): void {
    const context = input.context ?? {}
    const contentField = this.findForbiddenField(context, CONTENT_FIELD_NAMES)
    if (contentField) {
      throw new Error(`Sensitive content field "${contentField}" is not allowed in log context.`)
    }

    if (this.isAuditEvent(input.event)) {
      const policy = appAuditEvents[input.event]
      if (!policy.allowSnippet) {
        const snippetField = this.findForbiddenField(context, new Set(['snippet']))
        if (snippetField) {
          throw new Error(`Audit event "${input.event}" does not allow field "${snippetField}".`)
        }
      }

      if (!policy.allowPath) {
        const pathField = this.findForbiddenField(context, PATH_FIELD_NAMES)
        if (pathField) {
          throw new Error(`Audit event "${input.event}" does not allow path field "${pathField}".`)
        }
      }
    }
  }

  private findForbiddenField(value: unknown, forbiddenNames: Set<string>): string | null {
    if (!value || typeof value !== 'object') {
      return null
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = this.findForbiddenField(item, forbiddenNames)
        if (nested) {
          return nested
        }
      }
      return null
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      if (forbiddenNames.has(key)) {
        return key
      }
      const nested = this.findForbiddenField(nestedValue, forbiddenNames)
      if (nested) {
        return `${key}.${nested}`
      }
    }

    return null
  }

  private isAuditEvent(event: string): event is AppAuditEventId {
    return event in appAuditEvents
  }
}
