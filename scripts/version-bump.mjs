import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  artifactName, formatRfc2822, maintainer, parseUnreleased, parseVersion,
  paths, readJson, repoRoot, stringifyJson
} from './lib/release-meta.mjs'

const args = new Set(process.argv.slice(2))
const setArg = process.argv.find((arg) => arg.startsWith('--set='))
const dryRun = args.has('--dry-run')
const noBump = args.has('--no-bump') || Boolean(process.env.CI) || process.env.PECIE_NO_BUMP === '1'
const force = args.has('--force')
if ([args.has('--major'), args.has('--minor'), Boolean(setArg)].filter(Boolean).length > 1) {
  throw new Error('Usare una sola opzione tra --major, --minor e --set=X.Y.Z.')
}

const desktop = readJson(paths.desktopPackage)
parseVersion(desktop.version)
const pending = fs.existsSync(paths.pending) ? readJson(paths.pending) : null
const reusePending = !force && pending?.version === desktop.version
let nextVersion = desktop.version
if (!noBump && !reusePending) {
  const parts = parseVersion(desktop.version)
  if (setArg) nextVersion = setArg.slice('--set='.length)
  else if (args.has('--major')) nextVersion = `${parts[0] + 1}.0.0`
  else if (args.has('--minor')) nextVersion = `${parts[0]}.${parts[1] + 1}.0`
  else nextVersion = `${parts[0]}.${parts[1]}.${parts[2] + 1}`
  parseVersion(nextVersion)
}

const writes = []
const packageFiles = [paths.rootPackage, paths.desktopPackage]
for (const dir of ['packages', 'apps']) {
  for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
    const file = path.join(repoRoot, dir, entry.name, 'package.json')
    if (entry.isDirectory() && fs.existsSync(file) && !packageFiles.includes(file)) packageFiles.push(file)
  }
}
for (const file of packageFiles) {
  const json = readJson(file)
  json.version = nextVersion
  writes.push({ file, content: stringifyJson(json) })
}

const lock = readJson(paths.lockfile)
lock.version = nextVersion
for (const key of ['', ...Object.keys(lock.packages).filter((key) => /^(apps|packages)\/[^/]+$/.test(key))]) {
  if (lock.packages[key]?.version) lock.packages[key].version = nextVersion
}
writes.push({ file: paths.lockfile, content: stringifyJson(lock) })

if (!noBump && !reusePending) {
  const markdown = fs.readFileSync(paths.changelog, 'utf8')
  const { match, entries } = parseUnreleased(markdown)
  const now = new Date()
  const released = `## [Unreleased]\n\n## [${nextVersion}] - ${now.toISOString().slice(0, 10)}\n${match[1].trimEnd()}\n\n`
  writes.push({ file: paths.changelog, content: markdown.replace(match[0], released) })
  const history = readJson(paths.releaseHistory)
  history.releases.unshift({
    version: nextVersion,
    date: formatRfc2822(now),
    distribution: 'unstable',
    urgency: 'medium',
    maintainer,
    entries
  })
  writes.push({ file: paths.releaseHistory, content: stringifyJson(history) })
  writes.push({ file: paths.pending, content: stringifyJson({ version: nextVersion }) })
}

if (dryRun) {
  console.log(`Pecie ${desktop.version} -> ${nextVersion}${reusePending ? ' (pending riusata)' : ''}`)
} else {
  flush(writes)
  console.log(`Versione Pecie sincronizzata: ${nextVersion}${reusePending ? ' (pending riusata)' : ''}`)
}

function flush(items) {
  const backups = []
  try {
    for (const item of items) {
      const existed = fs.existsSync(item.file)
      backups.push({ file: item.file, existed, content: existed ? fs.readFileSync(item.file) : null })
      fs.writeFileSync(item.file, item.content)
    }
  } catch (error) {
    for (const backup of backups.reverse()) {
      if (backup.existed) fs.writeFileSync(backup.file, backup.content)
      else if (fs.existsSync(backup.file)) fs.unlinkSync(backup.file)
    }
    throw error
  }
}
