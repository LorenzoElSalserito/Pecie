import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { access, chmod, cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '..')
const configPath = path.join(repoRoot, 'apps/desktop/export-runtime.config.json')
const vendorRoot = path.join(repoRoot, 'third_party/export-runtime')
const targetKey = `${process.platform}-${process.arch}`
const skipDownload = process.env.PECIE_SKIP_PANDOC_DOWNLOAD === '1'

async function pathExists(targetPath) {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

async function sha256ForFile(targetPath) {
  const fileContents = await readFile(targetPath)
  return createHash('sha256').update(fileContents).digest('hex')
}

function runOrThrow(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options
  })
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`)
  }
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download Pandoc runtime: ${response.status} ${response.statusText}`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  await writeFile(destinationPath, bytes)
}

async function extractArchive(archivePath, archiveType, outputDirectory) {
  if (archiveType === 'tar.gz') {
    runOrThrow('tar', ['-xzf', archivePath, '-C', outputDirectory], { cwd: repoRoot })
    return
  }

  if (archiveType === 'zip') {
    if (process.platform === 'win32') {
      runOrThrow(
        'powershell.exe',
        ['-NoProfile', '-Command', `Expand-Archive -Path "${archivePath}" -DestinationPath "${outputDirectory}" -Force`],
        { cwd: repoRoot }
      )
      return
    }

    runOrThrow('unzip', ['-q', archivePath, '-d', outputDirectory], { cwd: repoRoot })
    return
  }

  throw new Error(`Unsupported archive type: ${archiveType}`)
}

async function ensureVendorBinaryExecutable(binaryPath) {
  if (process.platform !== 'win32') {
    await chmod(binaryPath, 0o755)
  }
}

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const targetConfig = config?.pandoc?.targets?.[targetKey]
  if (!targetConfig) {
    throw new Error(`Pandoc runtime target not configured for ${targetKey}`)
  }

  const vendorBinaryPath = path.join(vendorRoot, targetConfig.vendorBinaryRelativePath)
  const vendorMetadataPath = path.join(path.dirname(vendorBinaryPath), 'metadata.json')
  const expectedVersion = config.pandoc.version

  if (await pathExists(vendorBinaryPath) && (await pathExists(vendorMetadataPath))) {
    const metadata = JSON.parse(await readFile(vendorMetadataPath, 'utf8'))
    const currentSha256 = await sha256ForFile(vendorBinaryPath)
    if (
      metadata.version === expectedVersion &&
      metadata.archiveSha256 === targetConfig.sha256 &&
      currentSha256 === metadata.sha256
    ) {
      await ensureVendorBinaryExecutable(vendorBinaryPath)
      return
    }
  }

  if (skipDownload) {
    throw new Error(
      `Pandoc ${expectedVersion} is missing or outdated for ${targetKey}, and PECIE_SKIP_PANDOC_DOWNLOAD=1 prevents syncing it.`
    )
  }

  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'pecie-pandoc-runtime-'))
  try {
    const archivePath = path.join(tempDirectory, targetConfig.assetName)
    const releaseUrl = `${config.pandoc.releaseBaseUrl}/${targetConfig.assetName}`

    await downloadFile(releaseUrl, archivePath)
    const downloadedSha256 = await sha256ForFile(archivePath)
    if (downloadedSha256 !== targetConfig.sha256) {
      throw new Error(`Pandoc archive checksum mismatch for ${targetConfig.assetName}`)
    }

    const extractionDirectory = path.join(tempDirectory, 'extract')
    await mkdir(extractionDirectory, { recursive: true })
    await extractArchive(archivePath, targetConfig.archiveType, extractionDirectory)

    const extractedBinaryPath = path.join(
      extractionDirectory,
      targetConfig.archiveRootDirectoryName,
      targetConfig.archiveBinaryRelativePath
    )

    if (!(await pathExists(extractedBinaryPath))) {
      throw new Error(`Pandoc binary not found after extraction: ${extractedBinaryPath}`)
    }

    await mkdir(path.dirname(vendorBinaryPath), { recursive: true })
    await cp(extractedBinaryPath, vendorBinaryPath, { force: true })
    await ensureVendorBinaryExecutable(vendorBinaryPath)

    const vendorSha256 = await sha256ForFile(vendorBinaryPath)
    const vendorStats = await stat(vendorBinaryPath)
    await writeFile(
      vendorMetadataPath,
      JSON.stringify(
        {
          version: expectedVersion,
          verification: 'checksummed',
          sourceUrl: releaseUrl,
          archiveSha256: targetConfig.sha256,
          sha256: vendorSha256,
          byteSize: vendorStats.size
        },
        null,
        2
      ),
      'utf8'
    )
  } finally {
    await rm(tempDirectory, { recursive: true, force: true })
  }
}

await main()
