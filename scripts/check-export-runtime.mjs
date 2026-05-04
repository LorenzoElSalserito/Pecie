import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '..')
const configPath = path.join(repoRoot, 'apps/desktop/export-runtime.config.json')
const manifestPath = path.join(repoRoot, 'apps/desktop/resources/export-runtime/manifest.json')
const vendorRoot = path.join(repoRoot, 'third_party/export-runtime')
const targetKey = `${process.platform}-${process.arch}`

async function pathExists(targetPath) {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const expectedPandocVersion = config?.pandoc?.version
  const targetConfig = config?.pandoc?.targets?.[targetKey]
  const exists = await pathExists(manifestPath)
  if (!exists) {
    throw new Error(`[export-runtime] manifest missing for ${targetKey}`)
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const bundledCapabilities = Array.isArray(manifest.bundledCapabilities) ? manifest.bundledCapabilities : []
  const pandocEntry = bundledCapabilities.find((capability) => capability.capabilityId === 'pandoc')

  console.log(`[export-runtime] target=${targetKey}`)
  console.log(`[export-runtime] runtimeVersion=${manifest.runtimeVersion ?? 'unknown'}`)

  if (!targetConfig) {
    throw new Error(`[export-runtime] pandoc target not configured for ${targetKey}`)
  }

  if (!pandocEntry) {
    throw new Error('[export-runtime] bundled pandoc capability is missing')
  }

  const bundledPandocPath = path.join(
    repoRoot,
    'apps/desktop/resources/export-runtime',
    pandocEntry.relativeExecutablePath
  )
  if (!(await pathExists(bundledPandocPath))) {
    throw new Error(`[export-runtime] bundled pandoc executable missing: ${bundledPandocPath}`)
  }

  if (pandocEntry.version !== expectedPandocVersion) {
    throw new Error(
      `[export-runtime] bundled pandoc version mismatch: expected ${expectedPandocVersion}, found ${pandocEntry.version}`
    )
  }

  const vendorMetadataPath = path.join(
    vendorRoot,
    path.dirname(targetConfig.vendorBinaryRelativePath),
    'metadata.json'
  )
  if (!(await pathExists(vendorMetadataPath))) {
    throw new Error(`[export-runtime] vendor metadata missing: ${vendorMetadataPath}`)
  }

  const vendorMetadata = JSON.parse(await readFile(vendorMetadataPath, 'utf8'))
  if (vendorMetadata.version !== expectedPandocVersion) {
    throw new Error(
      `[export-runtime] vendored pandoc version mismatch: expected ${expectedPandocVersion}, found ${vendorMetadata.version}`
    )
  }

  if (vendorMetadata.archiveSha256 !== targetConfig.sha256) {
    throw new Error('[export-runtime] vendored pandoc archive checksum does not match pinned configuration')
  }

  if (bundledCapabilities.length === 0) {
    console.log('[export-runtime] bundled capabilities: none')
    return
  }

  console.log('[export-runtime] bundled capabilities:')
  for (const capability of bundledCapabilities) {
    console.log(
      `- ${capability.capabilityId} ${capability.version ?? 'unknown'} (${capability.relativeExecutablePath})`
    )
  }

  console.log(
    `[export-runtime] pinned pandoc verified: ${expectedPandocVersion} (${targetConfig.assetName})`
  )
  console.log('[export-runtime] core export is zero-dependency for this target: pandoc is bundled')
  console.log('[export-runtime] weasyprint remains an explicit addon capability unless bundled in the manifest')
}

await main()
