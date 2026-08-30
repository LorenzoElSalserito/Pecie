import { access, chmod, copyFile, cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '..')
const exportRuntimeRoot = path.join(repoRoot, 'apps/desktop/resources/export-runtime')
const runtimeTarget = `${process.platform}-${process.arch}`
const vendorRuntimeRoot = process.env.PECIE_EXPORT_RUNTIME_SOURCE
  ? path.resolve(process.env.PECIE_EXPORT_RUNTIME_SOURCE)
  : path.join(repoRoot, 'third_party/export-runtime')

const capabilityEntries = [
  {
    capabilityId: 'pandoc',
    relativeExecutablePath:
      process.platform === 'win32'
        ? `${runtimeTarget}/pandoc/pandoc.exe`
        : `${runtimeTarget}/pandoc/bin/pandoc`
  },
  {
    capabilityId: 'weasyprint',
    relativeExecutablePath:
      process.platform === 'win32'
        ? `${runtimeTarget}/weasyprint/weasyprint.exe`
        : `${runtimeTarget}/weasyprint/bin/weasyprint`
  }
]

async function pathExists(targetPath) {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

async function fileHashSha256(targetPath) {
  const contents = await readFile(targetPath)
  return crypto.createHash('sha256').update(contents).digest('hex')
}

async function readCapabilityMetadata(sourceDirectory) {
  const metadataPath = path.join(sourceDirectory, 'metadata.json')
  if (!(await pathExists(metadataPath))) {
    return null
  }

  return JSON.parse(await readFile(metadataPath, 'utf8'))
}

// Symlinks are resolved into real files on purpose: a link kept inside the packaged
// runtime would point at a build-machine path (or break when forge/deb/dmg repack the
// tree), which is how the sidecar ended up with unresolved libjpeg/liblzma/libtiff.
async function copyDirectoryMaterializingSymlinks(sourceDirectory, targetDirectory) {
  await rm(targetDirectory, { recursive: true, force: true })
  await mkdir(targetDirectory, { recursive: true })
  const entries = await readdir(sourceDirectory, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDirectory, entry.name)
    const targetPath = path.join(targetDirectory, entry.name)
    const sourceStats = await stat(sourcePath)

    if (sourceStats.isDirectory()) {
      await copyDirectoryMaterializingSymlinks(sourcePath, targetPath)
    } else {
      await copyFile(sourcePath, targetPath)
      await chmod(targetPath, sourceStats.mode)
    }
  }
}

async function main() {
  await mkdir(exportRuntimeRoot, { recursive: true })
  await mkdir(path.join(exportRuntimeRoot, runtimeTarget), { recursive: true })

  const bundledCapabilities = []
  for (const entry of capabilityEntries) {
    const vendorAbsolutePath = path.join(vendorRuntimeRoot, entry.relativeExecutablePath)
    const vendorMetadata = await readCapabilityMetadata(path.dirname(vendorAbsolutePath))
    const bundledAbsolutePath = path.join(exportRuntimeRoot, entry.relativeExecutablePath)

    if (await pathExists(vendorAbsolutePath)) {
      await mkdir(path.dirname(bundledAbsolutePath), { recursive: true })
      if (entry.capabilityId === 'weasyprint') {
        await copyDirectoryMaterializingSymlinks(path.dirname(vendorAbsolutePath), path.dirname(bundledAbsolutePath))
      } else {
        await cp(vendorAbsolutePath, bundledAbsolutePath, { force: true })
      }
      if (process.platform !== 'win32') {
        await chmod(bundledAbsolutePath, 0o755)
      }
    }

    if (await pathExists(bundledAbsolutePath)) {
      const fileStats = await stat(bundledAbsolutePath)
      bundledCapabilities.push({
        capabilityId: entry.capabilityId,
        relativeExecutablePath: entry.relativeExecutablePath,
        version: typeof vendorMetadata?.version === 'string' ? vendorMetadata.version : 'unknown',
        checksumSha256: await fileHashSha256(bundledAbsolutePath),
        verification:
          typeof vendorMetadata?.verification === 'string' &&
          ['packaged', 'signed', 'checksummed'].includes(vendorMetadata.verification)
            ? vendorMetadata.verification
            : 'checksummed',
        byteSize: fileStats.size
      })
    }
  }

  const manifest = {
    schemaVersion: 1,
    runtimeVersion: process.env.npm_package_version ?? '0.1.0',
    platform: process.platform,
    arch: process.arch,
    bundledCapabilities
  }

  await writeFile(path.join(exportRuntimeRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
}

await main()
