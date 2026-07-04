import fs from 'node:fs'
import * as git from 'isomorphic-git'

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
    await git.init({ fs, dir: projectPath })
  }

  public async addAll(projectPath: string): Promise<void> {
    const status = await git.statusMatrix({ fs, dir: projectPath })
    await Promise.all(
      status.map(([filepath, _headStatus, workdirStatus]) => {
        if (workdirStatus === 0) {
          return git.remove({ fs, dir: projectPath, filepath })
        }
        return git.add({ fs, dir: projectPath, filepath })
      })
    )
  }

  public async statusPorcelain(projectPath: string): Promise<string> {
    const status = await git.statusMatrix({ fs, dir: projectPath })
    return status
      .filter(([_filepath, headStatus, workdirStatus, stageStatus]) => headStatus !== workdirStatus || workdirStatus !== stageStatus)
      .map(([filepath]) => filepath)
      .join('\n')
  }

  public async hasChanges(projectPath: string): Promise<boolean> {
    return (await this.statusPorcelain(projectPath)).length > 0
  }

  public async commit(projectPath: string, message: string, author: GitCommitIdentity, allowEmpty = false): Promise<string> {
    const hasChanges = await this.hasChanges(projectPath)
    if (!hasChanges && !allowEmpty) {
      throw new Error('No changes to commit')
    }
    return git.commit({
      fs,
      dir: projectPath,
      message,
      author,
      committer: author
    })
  }

  public async revParseHead(projectPath: string): Promise<string> {
    return git.resolveRef({ fs, dir: projectPath, ref: 'HEAD' })
  }

  public async showFile(projectPath: string, commitHash: string, relativePath: string): Promise<string> {
    try {
      const { blob } = await git.readBlob({ fs, dir: projectPath, oid: commitHash, filepath: relativePath })
      return Buffer.from(blob).toString('utf8')
    } catch {
      return ''
    }
  }

  public async listFileHistory(projectPath: string, relativePath: string): Promise<string[]> {
    const commits = await git.log({ fs, dir: projectPath, filepath: relativePath, force: true })
    return commits.map((entry) => entry.oid)
  }

  public async log(projectPath: string): Promise<GitCommit[]> {
    const entries = await git.log({ fs, dir: projectPath })
    return Promise.all(
      entries.map(async (entry) => {
        const messageParts = entry.commit.message.trimEnd().split('\n')
        const authorTimestamp = entry.commit.author.timestamp
        const authorTimezoneOffset = entry.commit.author.timezoneOffset ?? new Date().getTimezoneOffset()
        return {
          hash: entry.oid,
          authorName: entry.commit.author.name ?? '',
          authorEmail: entry.commit.author.email ?? '',
          createdAt: this.formatGitTimestamp(authorTimestamp, authorTimezoneOffset),
          subject: messageParts[0] ?? '',
          body: messageParts.slice(1).join('\n').trim(),
          touchedPaths: await this.listTouchedPaths(projectPath, entry.oid, entry.commit.parent[0])
        }
      })
    )
  }

  private async listTouchedPaths(projectPath: string, commitHash: string, parentHash?: string): Promise<string[]> {
    const touchedPaths = await git.walk({
      fs,
      dir: projectPath,
      trees: parentHash ? [git.TREE({ ref: parentHash }), git.TREE({ ref: commitHash })] : [git.TREE({ ref: commitHash })],
      map: async (filepath, entries) => {
        if (filepath === '.') {
          return undefined
        }
        const types = await Promise.all(entries.map((entry) => entry?.type()))
        if (types.some((type) => type === 'tree')) {
          return undefined
        }
        const objectIds = await Promise.all(entries.map((entry) => entry?.oid()))
        return new Set(objectIds).size > 1 ? filepath : undefined
      },
      reduce: async (_parent, children) => children.flat().filter(Boolean)
    })
    return touchedPaths
  }

  private formatGitTimestamp(timestamp: number | undefined, timezoneOffset: number): string {
    const date = new Date((timestamp ?? Math.floor(Date.now() / 1000)) * 1000)
    const offsetMs = timezoneOffset * 60 * 1000
    const localDate = new Date(date.getTime() - offsetMs)
    const sign = timezoneOffset <= 0 ? '+' : '-'
    const absoluteOffset = Math.abs(timezoneOffset)
    const hours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0')
    const minutes = String(absoluteOffset % 60).padStart(2, '0')
    return `${localDate.toISOString().replace('Z', '')}${sign}${hours}:${minutes}`
  }
}
