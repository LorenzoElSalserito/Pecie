import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type GitCommit = {
  hash: string
  authorName: string
  authorEmail: string
  createdAt: string
  subject: string
  body: string
  touchedPaths: string[]
}

export type GitCommitIdentity = {
  name: string
  email: string
}

export class GitAdapter {
  public async init(projectPath: string): Promise<void> {
    await execFileAsync('git', ['init'], { cwd: projectPath })
  }

  public async addAll(projectPath: string): Promise<void> {
    await execFileAsync('git', ['add', '.'], { cwd: projectPath })
  }

  public async statusPorcelain(projectPath: string): Promise<string> {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: projectPath })
    return stdout.trim()
  }

  public async hasChanges(projectPath: string): Promise<boolean> {
    return (await this.statusPorcelain(projectPath)).length > 0
  }

  public async commit(projectPath: string, message: string, author: GitCommitIdentity, allowEmpty = false): Promise<string> {
    const args = ['commit']
    if (allowEmpty) {
      args.push('--allow-empty')
    }
    args.push('-m', message)
    await execFileAsync('git', args, {
      cwd: projectPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: author.name,
        GIT_AUTHOR_EMAIL: author.email,
        GIT_COMMITTER_NAME: author.name,
        GIT_COMMITTER_EMAIL: author.email
      }
    })
    return this.revParseHead(projectPath)
  }

  public async revParseHead(projectPath: string): Promise<string> {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: projectPath })
    return stdout.trim()
  }

  public async showFile(projectPath: string, commitHash: string, relativePath: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', ['show', `${commitHash}:${relativePath}`], { cwd: projectPath })
      return stdout
    } catch {
      return ''
    }
  }

  public async listFileHistory(projectPath: string, relativePath: string): Promise<string[]> {
    const { stdout } = await execFileAsync('git', ['log', '--format=%H', '--', relativePath], { cwd: projectPath })
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  public async log(projectPath: string): Promise<GitCommit[]> {
    const format = ['%H', '%an', '%ae', '%aI', '%s', '%b'].join('%x1f') + '%x1e'
    const { stdout } = await execFileAsync('git', ['log', `--pretty=format:${format}`], { cwd: projectPath })
    const entries = stdout
      .split('\x1e')
      .map((entry) => entry.trim())
      .filter(Boolean)

    return Promise.all(
      entries.map(async (entry) => {
        const fields = entry.split('\x1f')
        const hash = (fields[0] ?? '').trim()
        const { stdout: touchedPathsStdout } = await execFileAsync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', hash], {
          cwd: projectPath
        })
        return {
          hash,
          authorName: (fields[1] ?? '').trim(),
          authorEmail: (fields[2] ?? '').trim(),
          createdAt: (fields[3] ?? '').trim(),
          subject: (fields[4] ?? '').trim(),
          body: fields.slice(5).join('\x1f').trim(),
          touchedPaths: touchedPathsStdout
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        }
      })
    )
  }
}
