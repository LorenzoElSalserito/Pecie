import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '..')
const desktopRoot = path.join(repoRoot, 'apps/desktop')
const forgeCliEntry = path.join(
  repoRoot,
  'node_modules',
  '@electron-forge',
  'cli',
  'dist',
  'electron-forge.js'
)

const forgeArguments = process.argv.slice(2)

const child = spawn(process.execPath, [forgeCliEntry, ...forgeArguments], {
  cwd: desktopRoot,
  stdio: 'inherit'
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
