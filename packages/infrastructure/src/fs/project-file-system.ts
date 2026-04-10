import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export class ProjectFileSystem {
  public assertProjectPath(projectPath: string): void {
    if (!projectPath.endsWith('.pe')) {
      throw new Error('Il progetto deve avere estensione .pe')
    }
  }

  public resolveProjectPath(projectPath: string, relativePath: string): string {
    this.assertProjectPath(projectPath)

    const resolved = path.resolve(projectPath, relativePath)
    const normalizedRoot = `${path.resolve(projectPath)}${path.sep}`

    if (!resolved.startsWith(normalizedRoot) && resolved !== path.resolve(projectPath)) {
      throw new Error(`Path traversal bloccato: ${relativePath}`)
    }

    return resolved
  }

  public async ensureDir(projectPath: string, relativePath: string): Promise<string> {
    const target = this.resolveProjectPath(projectPath, relativePath)
    await mkdir(target, { recursive: true })
    return target
  }

  public async writeJson(projectPath: string, relativePath: string, value: unknown): Promise<void> {
    const target = this.resolveProjectPath(projectPath, relativePath)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, JSON.stringify(value, null, 2), 'utf8')
  }

  public async readJson<T>(projectPath: string, relativePath: string): Promise<T> {
    const target = this.resolveProjectPath(projectPath, relativePath)
    const raw = await readFile(target, 'utf8')
    return JSON.parse(raw) as T
  }

  public async writeText(projectPath: string, relativePath: string, value: string): Promise<void> {
    const target = this.resolveProjectPath(projectPath, relativePath)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, value, 'utf8')
  }

  public async readText(projectPath: string, relativePath: string): Promise<string> {
    const target = this.resolveProjectPath(projectPath, relativePath)
    return readFile(target, 'utf8')
  }

  public async readBuffer(projectPath: string, relativePath: string): Promise<Buffer> {
    const target = this.resolveProjectPath(projectPath, relativePath)
    return readFile(target)
  }

  public async listEntries(projectPath: string, relativePath: string) {
    const target = this.resolveProjectPath(projectPath, relativePath)
    return readdir(target, { withFileTypes: true })
  }

  public async statEntry(projectPath: string, relativePath: string) {
    const target = this.resolveProjectPath(projectPath, relativePath)
    return stat(target)
  }

  public async copyIntoProject(projectPath: string, sourcePath: string, relativeTargetPath: string): Promise<void> {
    const target = this.resolveProjectPath(projectPath, relativeTargetPath)
    await mkdir(path.dirname(target), { recursive: true })
    await copyFile(sourcePath, target)
  }

  public async deleteEntry(projectPath: string, relativePath: string): Promise<void> {
    const target = this.resolveProjectPath(projectPath, relativePath)
    await rm(target, { force: true, recursive: true })
  }
}
