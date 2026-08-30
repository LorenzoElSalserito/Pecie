import fs from 'node:fs'
import path from 'node:path'
import { paths, readJson, repoRoot } from './lib/release-meta.mjs'

const desktop = readJson(paths.desktopPackage)
const expected = desktop.version
const failures = []
const packageFiles = [paths.rootPackage]
for (const dir of ['packages', 'apps']) {
  for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
    const file = path.join(repoRoot, dir, entry.name, 'package.json')
    if (entry.isDirectory() && fs.existsSync(file)) packageFiles.push(file)
  }
}
for (const file of packageFiles) {
  if (readJson(file).version !== expected) failures.push(`${path.relative(repoRoot, file)}: versione divergente`)
}
const lock = readJson(paths.lockfile)
if (lock.version !== expected || lock.packages['']?.version !== expected) failures.push('package-lock.json: versione root divergente')
for (const key of Object.keys(lock.packages).filter((key) => /^(apps|packages)\/[^/]+$/.test(key))) {
  if (lock.packages[key].version !== expected) failures.push(`package-lock.json: ${key} divergente`)
}
const forge = fs.readFileSync(path.join(repoRoot, 'apps/desktop/forge.config.cjs'), 'utf8')
if (/artifactName\s*:/.test(forge)) failures.push('forge: artifactName non va forzato; maker-deb deriva nome, versione e architettura')
const history = readJson(paths.releaseHistory)
if (!history.releases.some((release) => release.version === expected)) failures.push(`release-history.json: manca ${expected}`)
if (!fs.readFileSync(paths.changelog, 'utf8').includes(`## [${expected}]`)) failures.push(`CHANGELOG.md: manca ${expected}`)
if (failures.length) throw new Error(`Verifica packaging fallita:\n- ${failures.join('\n- ')}`)
console.log(`Packaging Pecie coerente: ${expected}`)
