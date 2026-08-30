import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const paths = {
  desktopPackage: path.join(repoRoot, 'apps/desktop/package.json'),
  rootPackage: path.join(repoRoot, 'package.json'),
  lockfile: path.join(repoRoot, 'package-lock.json'),
  changelog: path.join(repoRoot, 'CHANGELOG.md'),
  releaseHistory: path.join(repoRoot, 'release-history.json'),
  pending: path.join(repoRoot, 'scripts/.release-pending.json')
}

export const packageName = 'pecie'
export const artifactName = 'pecie_${version}_${arch}.${ext}'
export const maintainer = 'Lorenzo DM <commercial.lorenzodm@gmail.com>'

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function stringifyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value)
  if (!match) throw new Error(`Versione non valida: ${value}. Richiesta X.Y.Z.`)
  return match.slice(1).map(Number)
}

export function formatRfc2822(date = new Date()) {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const pad = (value) => String(value).padStart(2, '0')
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const offset = `${sign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}${pad(Math.abs(offsetMinutes) % 60)}`
  return `${weekdays[date.getDay()]}, ${pad(date.getDate())} ${months[date.getMonth()]} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${offset}`
}

export function parseUnreleased(markdown) {
  const match = /^## \[Unreleased\][^\n]*\n([\s\S]*?)(?=^## \[|(?![\s\S]))/m.exec(markdown)
  if (!match) throw new Error('CHANGELOG.md non contiene "## [Unreleased]".')
  const entries = []
  let category = ''
  for (const raw of match[1].split('\n')) {
    const line = raw.trim()
    const heading = /^###\s+(.+)$/.exec(line)
    if (heading) {
      category = heading[1]
      continue
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line)
    if (bullet) entries.push(category ? `${category}: ${bullet[1]}` : bullet[1])
    else if (line && entries.length) entries[entries.length - 1] += ` ${line}`
  }
  return { match, entries: entries.length ? entries : ['Maintenance release.'] }
}

export function buildDebianChangelog(releases, name = packageName) {
  return releases.map((release) => {
    const body = release.entries.map((entry) => wrapEntry(entry)).join('\n')
    return `${name} (${release.version}) ${release.distribution}; urgency=${release.urgency}\n\n${body}\n\n -- ${release.maintainer}  ${release.date}\n`
  }).join('\n')
}

function wrapEntry(entry) {
  const words = entry.split(/\s+/)
  const lines = ['  *']
  for (const word of words) {
    const last = lines.length - 1
    if (`${lines[last]} ${word}`.length <= 79) lines[last] += ` ${word}`
    else lines.push(`    ${word}`)
  }
  return lines.join('\n')
}
