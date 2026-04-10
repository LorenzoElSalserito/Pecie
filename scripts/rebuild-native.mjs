import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const rootDirectory = process.cwd()
const desktopDirectory = resolve(rootDirectory, 'apps/desktop')

if (process.env.PECIE_SKIP_NATIVE_REBUILD === '1') {
  process.exit(0)
}

if (process.env.CI === 'true' && process.platform === 'win32') {
  console.log('Skipping native rebuild for CI on Windows.')
  process.exit(0)
}

const requireFromDesktop = createRequire(resolve(desktopDirectory, 'package.json'))
const electronVersion = requireFromDesktop('electron/package.json').version
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const result = spawnSync(
  npmCommand,
  [
    'rebuild',
    'better-sqlite3',
    '--workspace',
    '@pecie/infrastructure',
    `--runtime=electron`,
    `--target=${electronVersion}`,
    '--dist-url=https://electronjs.org/headers',
    '--build-from-source'
  ],
  {
    cwd: rootDirectory,
    stdio: 'inherit'
  }
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
