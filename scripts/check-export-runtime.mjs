import { execFile } from 'node:child_process'
import { access, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '..')
const configPath = path.join(repoRoot, 'apps/desktop/export-runtime.config.json')
const manifestPath = path.join(repoRoot, 'apps/desktop/resources/export-runtime/manifest.json')
const vendorRoot = path.join(repoRoot, 'third_party/export-runtime')
const targetKey = `${process.platform}-${process.arch}`
const requireWeasyprintBundle =
  process.env.PECIE_REQUIRE_WEASYPRINT_BUNDLE === '1' || process.env.PECIE_RELEASE_CHECK === '1'

async function pathExists(targetPath) {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

async function runWeasyprintSmoke({ pandocPath, weasyprintPath }) {
  const tempDirectory = await mkdtemp(path.join(tmpdir(), 'pecie-runtime-smoke-'))
  const inputPath = path.join(tempDirectory, 'input.md')
  const outputPath = path.join(tempDirectory, 'output.pdf')

  try {
    await writeFile(inputPath, '# Pecie runtime smoke\n\nBundled WeasyPrint verification.\n', 'utf8')
    await execFileAsync(
      pandocPath,
      [inputPath, '-f', 'markdown', '-o', outputPath, `--pdf-engine=${weasyprintPath}`, '--standalone'],
      {
        env: {
          ...process.env,
          PATH: ''
        }
      }
    )
    const outputStats = await stat(outputPath)
    if (outputStats.size < 1000) {
      throw new Error('[export-runtime] weasyprint smoke PDF is unexpectedly small')
    }
  } finally {
    await rm(tempDirectory, { recursive: true, force: true })
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
  const weasyprintEntry = bundledCapabilities.find((capability) => capability.capabilityId === 'weasyprint')

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

  const weasyprintTargetConfig = config?.weasyprint?.targets?.[targetKey]
  if (requireWeasyprintBundle && !weasyprintTargetConfig) {
    throw new Error(`[export-runtime] weasyprint target not configured for ${targetKey}`)
  }

  let bundledWeasyprintPath = null
  if (weasyprintEntry) {
    bundledWeasyprintPath = path.join(
      repoRoot,
      'apps/desktop/resources/export-runtime',
      weasyprintEntry.relativeExecutablePath
    )
    if (!(await pathExists(bundledWeasyprintPath))) {
      throw new Error(`[export-runtime] bundled weasyprint executable missing: ${bundledWeasyprintPath}`)
    }
    if (weasyprintTargetConfig && weasyprintEntry.relativeExecutablePath !== weasyprintTargetConfig.vendorBinaryRelativePath) {
      throw new Error('[export-runtime] bundled weasyprint executable path does not match pinned configuration')
    }
  } else if (requireWeasyprintBundle) {
    throw new Error('[export-runtime] bundled weasyprint sidecar is required for official release checks')
  }

  if (requireWeasyprintBundle && bundledWeasyprintPath) {
    await runWeasyprintSmoke({
      pandocPath: bundledPandocPath,
      weasyprintPath: bundledWeasyprintPath
    })
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
  if (weasyprintEntry) {
    console.log('[export-runtime] markdown PDF export is zero-dependency for this target: weasyprint is bundled')
  } else {
    console.log('[export-runtime] weasyprint sidecar is not bundled yet; set PECIE_REQUIRE_WEASYPRINT_BUNDLE=1 for release gating')
  }
}

await main()
