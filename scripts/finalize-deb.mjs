import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { assertNoSymlinks, assertNoUnresolvedSharedObjects } from './lib/export-runtime-integrity.mjs'
import { buildDebianChangelog, packageName, paths, readJson } from './lib/release-meta.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(scriptPath), '..')

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe', ...options })
}
function hasCommand(command) {
  return (process.env.PATH || '').split(path.delimiter).some((directory) => {
    try { fs.accessSync(path.join(directory, command), fs.constants.X_OK); return true } catch { return false }
  })
}

export async function finalizeDeb(debPath) {
  const absoluteDeb = path.resolve(debPath)
  if (!fs.existsSync(absoluteDeb)) throw new Error(`finalize-deb: package not found at ${absoluteDeb}`)
  if (!process.env.FAKEROOTKEY) {
    if (!hasCommand('fakeroot')) throw new Error('finalize-deb: fakeroot obbligatorio ma non disponibile')
    run('fakeroot', [process.execPath, scriptPath, '--internal', absoluteDeb], { stdio: 'inherit' })
    return absoluteDeb
  }
  // Large Electron payloads can exceed a small /tmp tmpfs. Stage beside the artifact,
  // where the build filesystem already proved it has enough capacity.
  const workDir = fs.mkdtempSync(path.join(path.dirname(absoluteDeb), '.pecie-deb-'))
  try {
    run('dpkg-deb', ['-R', absoluteDeb, workDir])
    // Repository placeholders are not runtime resources.
    fs.rmSync(path.join(workDir, 'usr/lib/pecie/resources/export-runtime/.gitkeep'), { force: true })
    await assertPackagedRuntimeIsSelfContained(workDir)
    const version = readJson(paths.desktopPackage).version
    installDocumentation(workDir, version)
    installDesktopAssets(workDir)
    refreshInstalledSize(workDir)
    normalizeControl(workDir, version)
    normalizePermissions(workDir)
    refreshMd5sums(workDir)
    verifyTree(workDir, version)
    const release = readJson(paths.releaseHistory).releases.find((item) => item.version === version)
    const epoch = String(Math.floor(new Date(release.date).getTime() / 1000))
    setTreeTimestamp(workDir, Number(epoch))
    run('dpkg-deb', ['-Zgzip', '--build', workDir, absoluteDeb], { env: { ...process.env, SOURCE_DATE_EPOCH: epoch } })
    if (process.env.PECIE_SKIP_LINTIAN !== '1' && hasCommand('lintian')) {
      const lintianTemp = fs.mkdtempSync(path.join(path.dirname(absoluteDeb), '.lintian-'))
      try { run('lintian', [absoluteDeb], { stdio: 'inherit', env: { ...process.env, TMPDIR: lintianTemp } }) } catch { /* informativo */ }
      finally { fs.rmSync(lintianTemp, { recursive: true, force: true }) }
    }
  } finally { fs.rmSync(workDir, { recursive: true, force: true }) }
  return absoluteDeb
}

function installDocumentation(rootDir, version) {
  const docDir = path.join(rootDir, 'usr/share/doc', packageName)
  fs.mkdirSync(docDir, { recursive: true })
  for (const stale of ['LICENSE', 'LICENSE.txt', 'changelog.gz', 'changelog.Debian.gz']) fs.rmSync(path.join(docDir, stale), { force: true })
  fs.writeFileSync(path.join(docDir, 'copyright'), buildCopyright())
  fs.copyFileSync(path.join(repoRoot, 'README.md'), path.join(docDir, 'README.md'))
  const history = readJson(paths.releaseHistory)
  if (!history.releases.some((release) => release.version === version)) throw new Error(`finalize-deb: release-history.json non contiene ${version}`)
  const changelog = buildDebianChangelog(history.releases)
  const scratch = path.join(os.tmpdir(), `pecie-changelog-${process.pid}`)
  try {
    fs.writeFileSync(scratch, changelog)
    if (hasCommand('dpkg-parsechangelog')) {
      const parsed = run('dpkg-parsechangelog', ['-l', scratch, '-S', 'Version']).trim()
      if (parsed !== version) throw new Error(`changelog Debian punta a ${parsed}, attesa ${version}`)
    }
  } finally { fs.rmSync(scratch, { force: true }) }
  const name = version.includes('-') ? 'changelog.Debian.gz' : 'changelog.gz'
  fs.writeFileSync(path.join(docDir, name), gzipSync(Buffer.from(changelog), { level: 9, mtime: 0 }))
}

function buildCopyright() {
  const license = fs.readFileSync(path.join(repoRoot, 'LICENSE'), 'utf8')
  if (!license.includes('GNU AFFERO GENERAL PUBLIC LICENSE') || !license.includes('Version 3')) {
    const body = license.split('\n').map((line) => line ? ` ${line}` : ' .').join('\n')
    return `Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/\nUpstream-Name: Pecie\nUpstream-Contact: Lorenzo DM <commercial.lorenzodm@gmail.com>\nSource: https://github.com/lorenzodm/pecie\n\nFiles: *\nCopyright: 2026 Lorenzo DM <commercial.lorenzodm@gmail.com>\nLicense: Custom\n${body}\n`
  }
  return `Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/\nUpstream-Name: Pecie\nUpstream-Contact: Lorenzo DM <commercial.lorenzodm@gmail.com>\nSource: https://github.com/lorenzodm/pecie\n\nFiles: *\nCopyright: 2026 Lorenzo DM <commercial.lorenzodm@gmail.com>\nLicense: AGPL-3+\n\nLicense: AGPL-3+\n Pecie is free software: you can redistribute it and/or modify it under the\n terms of the GNU Affero General Public License as published by the Free\n Software Foundation, version 3 or any later version.\n .\n On Debian systems, the complete text of the GNU Affero General Public License\n version 3 can be found in /usr/share/common-licenses/AGPL-3.\n`
}

function installDesktopAssets(rootDir) {
  const pixmaps = path.join(rootDir, 'usr/share/pixmaps')
  fs.mkdirSync(pixmaps, { recursive: true })
  const icon = path.join(repoRoot, 'apps/desktop/src/renderer/src/asset/Icon.png')
  if (!fs.existsSync(icon)) throw new Error(`finalize-deb: icona assente: ${icon}`)
  fs.copyFileSync(icon, path.join(pixmaps, `${packageName}.png`))
  const autostart = path.join(rootDir, 'etc/xdg/autostart')
  fs.mkdirSync(autostart, { recursive: true })
  fs.writeFileSync(path.join(autostart, `${packageName}.desktop`), `[Desktop Entry]\nType=Application\nName=Pecie\nExec=/usr/bin/pecie %U\nIcon=pecie\nTerminal=false\nHidden=true\nNoDisplay=true\nX-GNOME-Autostart-enabled=false\n`)
  const conffiles = listFiles(path.join(rootDir, 'etc')).map((file) => `/${path.relative(rootDir, file)}`).sort()
  const target = path.join(rootDir, 'DEBIAN/conffiles')
  if (conffiles.length) fs.writeFileSync(target, `${conffiles.join('\n')}\n`); else fs.rmSync(target, { force: true })
}

const relationAlternatives = {
  'libgtk-3-0': 'libgtk-3-0t64 | libgtk-3-0', 'libatspi2.0-0': 'libatspi2.0-0t64 | libatspi2.0-0',
  libasound2: 'libasound2t64 | libasound2', libuuid1: 'libuuid1t64 | libuuid1', libxss1: 'libxss1t64 | libxss1'
}
function rewriteRelations(value) {
  return value.split(',').map((clause) => {
    const alternatives = clause.split('|').map((item) => item.trim())
    const names = new Set(alternatives.map((item) => /^([\w+.-]+)/.exec(item)?.[1]))
    return alternatives.map((item) => {
      const match = /^([\w+.-]+)(.*)$/.exec(item); const replacement = match && relationAlternatives[match[1]]
      return replacement && !match[2].trim() && !names.has(`${match[1]}t64`) ? replacement : item
    }).join(' | ')
  }).join(', ')
}

function normalizeControl(rootDir, version) {
  const file = path.join(rootDir, 'DEBIAN/control'); const raw = fs.readFileSync(file, 'utf8'); const fields = new Map(); let current = ''
  for (const line of raw.split('\n')) {
    const match = /^([^:]+):\s*(.*)$/.exec(line)
    if (match) { current = match[1]; fields.set(current, match[2]) } else if (/^[ \t]/.test(line) && current) fields.set(current, `${fields.get(current)}\n${line}`)
  }
  fields.delete('License'); fields.delete('Vendor')
  fields.set('Package', packageName); fields.set('Version', version); fields.set('Maintainer', 'Lorenzo DM <commercial.lorenzodm@gmail.com>'); fields.set('Section', 'misc'); fields.set('Priority', 'optional')
  for (const key of ['Depends', 'Pre-Depends', 'Recommends', 'Suggests', 'Enhances']) if (fields.has(key)) {
    if (fields.get(key).includes('\n')) throw new Error(`finalize-deb: control field ${key} è multilinea`)
    fields.set(key, rewriteRelations(fields.get(key)))
  }
  const description = normalizeDescription(fields.get('Description') || 'Pecie editorial writing studio'); fields.delete('Description')
  const order = ['Package', 'Version', 'Architecture', 'Maintainer', 'Installed-Size', 'Depends', 'Pre-Depends', 'Recommends', 'Suggests', 'Enhances', 'Section', 'Priority', 'Homepage']; const lines = []
  for (const key of order) if (fields.has(key)) { lines.push(`${key}: ${fields.get(key)}`); fields.delete(key) }
  for (const [key, value] of fields) lines.push(`${key}: ${value}`)
  lines.push(`Description: ${description}`); fs.writeFileSync(file, `${lines.join('\n')}\n`)
}
function normalizeDescription(value) {
  const sourceLines = value.split('\n')
  let synopsis = sourceLines.shift()?.trim() || 'Editorial writing studio'
  let body = sourceLines.map((line) => line.trim()).filter(Boolean).join(' ')
  if (!body || body === synopsis) body = 'Local-first desktop application for planning, writing and exporting structured long-form projects.'
  if (synopsis.length > 80) {
    body = `${synopsis} ${body}`
    synopsis = 'Editorial writing studio for structured long-form projects'
  }
  const wrapped = ['']
  for (const word of body.split(/\s+/)) {
    const index = wrapped.length - 1
    if (` ${wrapped[index]} ${word}`.length <= 80) wrapped[index] += `${wrapped[index] ? ' ' : ''}${word}`
    else wrapped.push(word)
  }
  return `${synopsis}\n${wrapped.map((line) => ` ${line}`).join('\n')}`
}

function setTreeTimestamp(dir, epoch) {
  const date = new Date(epoch * 1000)
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) setTreeTimestamp(full, epoch)
    if (!entry.isSymbolicLink()) fs.utimesSync(full, date, date)
  }
  fs.utimesSync(dir, date, date)
}

function normalizePermissions(rootDir) {
  const rows = run('find', [rootDir, '-mindepth', '0', '-printf', '%m %y %p\n']).trimEnd().split('\n')
  for (const row of rows) {
    const match = /^(\d+) ([df]) (.*)$/.exec(row); if (!match) continue
    const [, text, type, file] = match; const special = Number.parseInt(text, 8) & 0o7000; let mode
    if (type === 'd') mode = 0o755
    else if (/\.so(?:\.\d+)*$/.test(file)) mode = 0o644
    else if (file.includes(`${path.sep}DEBIAN${path.sep}`)) mode = /\/(preinst|postinst|prerm|postrm|config)$/.test(file) ? 0o755 : 0o644
    else mode = (Number.parseInt(text, 8) & 0o111) ? 0o755 : 0o644
    fs.chmodSync(file, special | mode)
  }
}
function listFiles(dir) {
  if (!fs.existsSync(dir)) return []; const result = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) result.push(...listFiles(full)); else if (entry.isFile()) result.push(full) }
  return result
}
function refreshMd5sums(rootDir) {
  const controlDir = path.join(rootDir, 'DEBIAN') + path.sep
  const lines = listFiles(rootDir).filter((file) => !file.startsWith(controlDir)).map((file) => `${createHash('md5').update(fs.readFileSync(file)).digest('hex')}  ${path.relative(rootDir, file)}`).sort()
  fs.writeFileSync(path.join(rootDir, 'DEBIAN/md5sums'), `${lines.join('\n')}\n`)
}
function refreshInstalledSize(rootDir) {
  const file = path.join(rootDir, 'DEBIAN/control'); const size = run('du', ['-k', '-s', '--apparent-size', '--exclude=./DEBIAN', '.'], { cwd: rootDir }).trim().split(/\s+/)[0]; let control = fs.readFileSync(file, 'utf8')
  control = /^Installed-Size:/m.test(control) ? control.replace(/^Installed-Size:.*$/m, `Installed-Size: ${size}`) : control.replace(/^Architecture:.*$/m, `$&\nInstalled-Size: ${size}`); fs.writeFileSync(file, control)
}
function verifyTree(rootDir, version) {
  const control = fs.readFileSync(path.join(rootDir, 'DEBIAN/control'), 'utf8')
  for (const expected of [`Version: ${version}`, 'Section: misc', 'Priority: optional']) if (!control.includes(expected)) throw new Error(`finalize-deb: control manca ${expected}`)
  run('md5sum', ['-c', '--quiet', 'DEBIAN/md5sums'], { cwd: rootDir })
  const bad = run('find', [rootDir, '-type', 'd', '!', '-perm', '0755', '-print']).trim(); if (bad) throw new Error(`finalize-deb: directory con permessi errati: ${bad}`)
}
function listDirectories(dir) {
  const result = []; for (const entry of fs.readdirSync(dir, { withFileTypes: true })) if (entry.isDirectory()) { const full = path.join(dir, entry.name); result.push(full, ...listDirectories(full)) }; return result
}
async function assertPackagedRuntimeIsSelfContained(rootDir) {
  const roots = listDirectories(rootDir).filter((dir) => path.basename(dir) === 'bin' && fs.existsSync(path.join(dir, '_internal')) && path.basename(path.dirname(dir)) === 'weasyprint')
  for (const bundleRoot of roots) { await assertNoSymlinks(bundleRoot, 'finalize-deb'); await assertNoUnresolvedSharedObjects(bundleRoot, [path.join(bundleRoot, '_internal'), path.join(bundleRoot, '_internal/pillow.libs')], 'finalize-deb') }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const internal = process.argv[2] === '--internal'; const target = process.argv[internal ? 3 : 2]
  if (!target) { console.error('Usage: node scripts/finalize-deb.mjs <package.deb>'); process.exit(1) }
  const result = await finalizeDeb(target); if (!internal) console.log(`Pacchetto Debian finalizzato: ${result}`)
}
