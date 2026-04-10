import { appendFile, copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

import type {
  ComposeBugReportRequest,
  ComposeBugReportResponse,
  LogEventRequest,
  LogEventResponse
} from '@pecie/schemas'

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
}
