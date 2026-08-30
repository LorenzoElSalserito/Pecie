import { execFile } from 'node:child_process'
import { lstat, open, readdir, readlink } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const elfMagic = Buffer.from([0x7f, 0x45, 0x4c, 0x46])

async function walk(root) {
  const entries = await readdir(root, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name)
    if (entry.isSymbolicLink()) {
      files.push({ path: entryPath, kind: 'symlink' })
    } else if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)))
    } else if (entry.isFile()) {
      files.push({ path: entryPath, kind: 'file' })
    }
  }

  return files
}

/**
 * Lists every symlink under `root`, with the raw target it points at.
 * A packaged runtime must contain none: symlinks either carry a build-machine
 * absolute path or get flattened/broken by the packaging steps downstream.
 */
export async function collectSymlinks(root) {
  const entries = await walk(root)
  const symlinks = []

  for (const entry of entries) {
    if (entry.kind === 'symlink') {
      symlinks.push({ path: entry.path, target: await readlink(entry.path) })
    }
  }

  return symlinks
}

export async function assertNoSymlinks(root, label) {
  const symlinks = await collectSymlinks(root)
  if (symlinks.length === 0) {
    return
  }

  const details = symlinks
    .map((entry) => `  ${path.relative(root, entry.path)} -> ${entry.target}`)
    .join('\n')
  throw new Error(
    `[${label}] runtime tree contains ${symlinks.length} symlink(s); expected real files only:\n${details}`
  )
}

async function isElfFile(filePath) {
  const stats = await lstat(filePath)
  if (!stats.isFile() || stats.size < elfMagic.length) {
    return false
  }

  const handle = await open(filePath, 'r')
  try {
    const header = Buffer.alloc(elfMagic.length)
    await handle.read(header, 0, elfMagic.length, 0)
    return header.equals(elfMagic)
  } finally {
    await handle.close()
  }
}

/**
 * Resolves every ELF binary under `root` the way the sidecar loads them at runtime
 * (PyInstaller exports the bundle directories through LD_LIBRARY_PATH) and reports
 * shared objects the dynamic loader cannot find.
 */
export async function findUnresolvedSharedObjects(root, libraryDirectories) {
  if (process.platform !== 'linux') {
    return []
  }

  const searchPath = libraryDirectories.join(path.delimiter)
  const entries = await walk(root)
  const unresolved = []

  for (const entry of entries) {
    if (entry.kind !== 'file' || !(await isElfFile(entry.path))) {
      continue
    }

    let stdout = ''
    try {
      ;({ stdout } = await execFileAsync('ldd', [entry.path], {
        env: { ...process.env, LD_LIBRARY_PATH: searchPath },
        maxBuffer: 8 * 1024 * 1024
      }))
    } catch (error) {
      // `ldd` exits non-zero for static or non-dynamic executables (pandoc, data blobs).
      stdout = typeof error?.stdout === 'string' ? error.stdout : ''
    }

    const missing = stdout
      .split('\n')
      .filter((line) => line.includes('not found'))
      .map((line) => line.trim().split(/\s+/)[0])

    if (missing.length > 0) {
      unresolved.push({ path: entry.path, missing: [...new Set(missing)] })
    }
  }

  return unresolved
}

export async function assertNoUnresolvedSharedObjects(root, libraryDirectories, label) {
  const unresolved = await findUnresolvedSharedObjects(root, libraryDirectories)
  if (unresolved.length === 0) {
    return
  }

  const details = unresolved
    .map((entry) => `  ${path.relative(root, entry.path)} -> ${entry.missing.join(', ')}`)
    .join('\n')
  throw new Error(`[${label}] runtime has unresolved native dependencies:\n${details}`)
}
