import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function releaseScript(platform) {
  const scripts = { linux: 'make:linux:release', win32: 'make:win', darwin: 'make:mac:dmg' }
  if (!Object.hasOwn(scripts, platform)) throw new Error(`Unsupported release platform: ${platform}`)
  return scripts[platform]
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const script = releaseScript(process.platform)
  if (!process.env.npm_execpath) throw new Error('Run this script through npm run dist')
  const child = spawn(process.execPath, [process.env.npm_execpath, 'run', script], {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/desktop'),
    stdio: 'inherit'
  })
  child.on('error', (error) => { console.error(error); process.exitCode = 1 })
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else process.exitCode = code ?? 1
  })
}
