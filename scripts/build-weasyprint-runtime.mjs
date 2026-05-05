import { access, chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '..')
const configPath = path.join(repoRoot, 'apps/desktop/export-runtime.config.json')
const targetKey = `${process.platform}-${process.arch}`
const buildRoot = path.join(repoRoot, 'build/weasyprint-runtime', targetKey)
const wheelDirectory = process.env.PECIE_WEASYPRINT_WHEEL_DIR
  ? path.resolve(process.env.PECIE_WEASYPRINT_WHEEL_DIR)
  : path.join(buildRoot, 'wheels')
const skipDownload = process.env.PECIE_WEASYPRINT_SKIP_DOWNLOAD === '1'
const venvDirectory = path.join(buildRoot, 'venv')
const distDirectory = path.join(buildRoot, 'dist')
const pyinstallerWorkDirectory = path.join(buildRoot, 'pyinstaller')
const specDirectory = path.join(buildRoot, 'spec')
const smokeHtmlPath = path.join(buildRoot, 'smoke.html')
const smokePdfPath = path.join(buildRoot, 'smoke.pdf')
const requireWeasyprintBundle =
  process.env.PECIE_REQUIRE_WEASYPRINT_BUNDLE === '1' || process.env.PECIE_RELEASE_CHECK === '1'
const forceBuild = process.env.PECIE_FORCE_WEASYPRINT_BUILD === '1'

function commandName(command) {
  return process.platform === 'win32' ? `${command}.exe` : command
}

async function run(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: 'inherit'
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`))
      }
    })
  })
}

async function fileHashSha256(targetPath) {
  const contents = await readFile(targetPath)
  return crypto.createHash('sha256').update(contents).digest('hex')
}

async function pathExists(targetPath) {
  return access(targetPath)
    .then(() => true)
    .catch(() => false)
}

async function main() {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    const message = `[weasyprint-runtime] builder currently supports linux-x64; current target is ${targetKey}`
    if (requireWeasyprintBundle) {
      throw new Error(message)
    }
    console.log(`${message}. Skipping optional sidecar build for this platform.`)
    return
  }

  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const targetConfig = config?.weasyprint?.targets?.[targetKey]
  if (!targetConfig?.vendorBinaryRelativePath) {
    throw new Error(`[weasyprint-runtime] target not configured: ${targetKey}`)
  }

  const vendorExecutablePath = path.join(repoRoot, 'third_party/export-runtime', targetConfig.vendorBinaryRelativePath)
  if (!forceBuild && (await pathExists(vendorExecutablePath))) {
    console.log(`[weasyprint-runtime] existing ${targetKey} sidecar found at ${vendorExecutablePath}`)
    return
  }

  await mkdir(buildRoot, { recursive: true })
  await mkdir(wheelDirectory, { recursive: true })

  if (!skipDownload) {
    await run('python3', ['-m', 'pip', 'download', '--only-binary=:all:', '--dest', wheelDirectory, 'weasyprint', 'pyinstaller'])
  }

  await rm(venvDirectory, { recursive: true, force: true })
  await run('python3', ['-m', 'venv', venvDirectory])

  const python = path.join(venvDirectory, 'bin', commandName('python'))
  await run(python, ['-m', 'pip', 'install', '--no-index', '--find-links', wheelDirectory, 'weasyprint', 'pyinstaller'])

  await rm(distDirectory, { recursive: true, force: true })
  await rm(pyinstallerWorkDirectory, { recursive: true, force: true })
  await mkdir(specDirectory, { recursive: true })
  await run(python, [
    '-m',
    'PyInstaller',
    '--clean',
    '--noconfirm',
    '--name',
    'weasyprint',
    '--collect-all',
    'weasyprint',
    '--collect-all',
    'tinycss2',
    '--collect-all',
    'cssselect2',
    '--collect-all',
    'pyphen',
    '--collect-all',
    'fontTools',
    '--distpath',
    distDirectory,
    '--workpath',
    pyinstallerWorkDirectory,
    '--specpath',
    specDirectory,
    path.join(venvDirectory, 'bin', 'weasyprint')
  ])

  const builtExecutable = path.join(distDirectory, 'weasyprint', 'weasyprint')
  await writeFile(smokeHtmlPath, '<h1>Pecie WeasyPrint smoke</h1><p>Bundled runtime verification.</p>', 'utf8')
  await run(builtExecutable, [smokeHtmlPath, smokePdfPath])

  await rm(path.dirname(vendorExecutablePath), { recursive: true, force: true })
  await mkdir(path.dirname(vendorExecutablePath), { recursive: true })
  await cp(path.join(distDirectory, 'weasyprint'), path.dirname(vendorExecutablePath), {
    recursive: true,
    force: true
  })
  await chmod(vendorExecutablePath, 0o755)

  const metadata = {
    capabilityId: 'weasyprint',
    version: '68.1',
    target: targetKey,
    verification: 'checksummed',
    builder: 'pyinstaller',
    checksumSha256: await fileHashSha256(vendorExecutablePath),
    smokePdfSha256: await fileHashSha256(smokePdfPath)
  }
  await writeFile(path.join(path.dirname(vendorExecutablePath), 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8')

  console.log(`[weasyprint-runtime] bundled ${targetKey} sidecar at ${vendorExecutablePath}`)
}

await main()
