import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { buildDebianChangelog, parseUnreleased, readJson, paths } from '../scripts/lib/release-meta.mjs'
import { finalizeDeb } from '../scripts/finalize-deb.mjs'
import { buildRpm } from '../scripts/build-rpm.mjs'
import { releaseScript } from '../scripts/dist-desktop.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe', ...options })
process.env.PECIE_SKIP_LINTIAN = '1'

test('dist sceglie tutti i formati richiesti per ogni sistema operativo', () => {
  const scripts = readJson(paths.desktopPackage).scripts
  assert.equal(scripts.dist, 'node ../../scripts/dist-desktop.mjs')
  assert.match(scripts[releaseScript('linux')], /make:linux:deb && npm run make:linux:rpm && npm run make:linux:appimage/)
  assert.match(scripts[releaseScript('win32')], /electron-builder.*--win nsis/)
  assert.match(scripts[releaseScript('darwin')], /--platform darwin --targets @electron-forge\/maker-dmg/)
  assert.throws(() => releaseScript('freebsd'), /Unsupported release platform/)
})

function treeSnapshot(dir) {
  const rows = []
  const walk = (current) => fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((entry) => {
    const full = path.join(current, entry.name); const relative = path.relative(dir, full); const mode = fs.statSync(full).mode & 0o7777
    if (entry.isDirectory()) { rows.push(`d ${mode.toString(8)} ${relative}`); walk(full) }
    else if (entry.isFile()) rows.push(`f ${mode.toString(8)} ${createHash('sha256').update(fs.readFileSync(full)).digest('hex')} ${relative}`)
  })
  walk(dir); return rows
}

test('parser Keep a Changelog conserva categorie e continuazioni', () => {
  const source = '## [Unreleased]\n\n### Added\n- Prima riga\n  continuazione.\n\n## [1.0.0]\n'
  assert.deepEqual(parseUnreleased(source).entries, ['Added: Prima riga continuazione.'])
})

test('changelog Debian generato è accettato da dpkg-parsechangelog', () => {
  const text = buildDebianChangelog(readJson(paths.releaseHistory).releases)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecie-changelog-test-')); const file = path.join(dir, 'changelog')
  try { fs.writeFileSync(file, text); assert.equal(run('dpkg-parsechangelog', ['-l', file, '-S', 'Version']).trim(), readJson(paths.desktopPackage).version) }
  finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('version:show non modifica file', () => {
  const files = [paths.desktopPackage, paths.rootPackage, paths.lockfile, paths.changelog, paths.releaseHistory]
  const before = files.map((file) => fs.readFileSync(file))
  run(process.execPath, ['scripts/version-bump.mjs', '--no-bump', '--dry-run'], { cwd: root })
  files.forEach((file, index) => assert.deepEqual(fs.readFileSync(file), before[index]))
})

test('finalizzazione .deb è conforme, ripetibile e corregge permessi 0444', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecie-deb-test-')); const tree = path.join(dir, 'tree'); const deb = path.join(dir, 'pecie.deb')
  try {
    fs.mkdirSync(path.join(tree, 'DEBIAN'), { recursive: true }); fs.mkdirSync(path.join(tree, 'usr/bin'), { recursive: true }); fs.mkdirSync(path.join(tree, 'usr/lib/pecie'), { recursive: true })
    fs.writeFileSync(path.join(tree, 'DEBIAN/control'), `Package: specie-vecchia\nVersion: 9.9.9\nArchitecture: amd64\nMaintainer: Lorenzo DM <commercial.lorenzodm@gmail.com>\nSection: default\nPriority: extra\nLicense: AGPL\nVendor: FPM\nDepends: libgtk-3-0, libasound2\nDescription: Libre and professional editorial studio for structured long-form writing projects\n`)
    fs.writeFileSync(path.join(tree, 'usr/bin/pecie'), '#!/bin/sh\nexit 0\n', { mode: 0o755 }); fs.writeFileSync(path.join(tree, 'usr/lib/pecie/read-only.txt'), 'payload', { mode: 0o444 })
    fs.mkdirSync(path.join(tree, 'usr/lib/pecie/resources/export-runtime'), { recursive: true })
    fs.writeFileSync(path.join(tree, 'usr/lib/pecie/resources/export-runtime/.gitkeep'), '')
    run('fakeroot', ['dpkg-deb', '-b', tree, deb]); await finalizeDeb(deb)
    const firstExtract = path.join(dir, 'first'); run('dpkg-deb', ['-R', deb, firstExtract]); const first = treeSnapshot(firstExtract); const firstControl = fs.readFileSync(path.join(firstExtract, 'DEBIAN/control'), 'utf8')
    await finalizeDeb(deb)
    const extract = path.join(dir, 'extract'); run('dpkg-deb', ['-R', deb, extract]); const control = fs.readFileSync(path.join(extract, 'DEBIAN/control'), 'utf8'); assert.equal(control, firstControl); assert.deepEqual(treeSnapshot(extract), first)
    assert.match(control, /^Package: pecie$/m); assert.match(control, /^Section: misc$/m); assert.doesNotMatch(control, /^(License|Vendor):/m)
    assert.equal(fs.readFileSync(path.join(extract, 'DEBIAN/conffiles'), 'utf8'), '/etc/xdg/autostart/pecie.desktop\n')
    assert.equal(fs.statSync(path.join(extract, 'usr/lib/pecie/read-only.txt')).mode & 0o777, 0o644)
    assert.equal(fs.existsSync(path.join(extract, 'usr/lib/pecie/resources/export-runtime/.gitkeep')), false)
    const changelog = gunzipSync(fs.readFileSync(path.join(extract, 'usr/share/doc/pecie/changelog.gz'))).toString(); assert.match(changelog, /^pecie \(/)
    run('md5sum', ['-c', '--quiet', 'DEBIAN/md5sums'], { cwd: extract })
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('conversione RPM senza root conserva file vuoti e proprietari corretti', async (t) => {
  for (const tool of ['alien', 'rpmbuild', 'rpm', 'objdump', 'fakeroot']) {
    try { run('which', [tool]) } catch { t.skip(`toolchain RPM non disponibile: ${tool}`); return }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecie-rpm-test-'))
  const tree = path.join(dir, 'tree')
  const deb = path.join(dir, 'pecie.deb')
  try {
    fs.mkdirSync(path.join(tree, 'DEBIAN'), { recursive: true })
    fs.mkdirSync(path.join(tree, 'usr/lib/pecie/resources/export-runtime'), { recursive: true })
    fs.writeFileSync(path.join(tree, 'DEBIAN/control'), 'Package: pecie\nVersion: 0.1.7\nArchitecture: amd64\nMaintainer: Pecie <local@pecie.app>\nDescription: RPM regression fixture\n')
    fs.writeFileSync(path.join(tree, 'usr/lib/pecie/resources/export-runtime/.gitkeep'), '')
    fs.writeFileSync(path.join(tree, 'usr/lib/pecie/empty.txt'), '')
    fs.writeFileSync(path.join(tree, 'usr/lib/pecie/payload.txt'), 'rpm fixture')
    run('dpkg-deb', ['--root-owner-group', '-b', tree, deb])
    const rpm = await buildRpm(deb)
    const files = run('rpm', ['-qpl', rpm])
    assert.match(files, /\/resources\/export-runtime\/\.gitkeep/)
    assert.match(files, /\/empty\.txt/)
    assert.doesNotMatch(files, /\.spec/)
    const owners = run('rpm', ['-qp', '--qf', '[%{FILEUSERNAME}:%{FILEGROUPNAME}\\n]', rpm]).trim().split('\n')
    assert.ok(owners.every((owner) => owner === 'root:root'))
    assert.equal(run('rpm', ['-qp', '--qf', '%{VERSION}', rpm]), '0.1.7')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
