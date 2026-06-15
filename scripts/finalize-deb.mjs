import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '..')

// Debian package identity. Must stay in sync with the maker-deb `name` option
// in apps/desktop/forge.config.cjs (the package name, binary and doc dir).
const PACKAGE_NAME = 'pecie'

/**
 * Build the machine-readable (DEP-5) copyright file shipped at
 * /usr/share/doc/<package>/copyright. It reflects the real project license
 * (AGPL-3.0-only) and author instead of the upstream Electron license that
 * electron-installer-debian would otherwise copy from the bundled runtime.
 */
function buildCopyright() {
  const year = new Date().getFullYear()
  return `Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: ${PACKAGE_NAME}
Upstream-Contact: Lorenzo DM
Source: https://github.com/lorenzodm/pecie

Files: *
Copyright: ${year} Lorenzo DM
License: AGPL-3.0-only
 Pecie is free software: you can redistribute it and/or modify it under the
 terms of the GNU Affero General Public License as published by the Free
 Software Foundation, version 3 of the License.
 .
 This program is distributed in the hope that it will be useful, but WITHOUT
 ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 details.
 .
 You should have received a copy of the GNU Affero General Public License
 along with this program. If not, see <https://www.gnu.org/licenses/>.
 .
 On Debian systems, the full text of the GNU Affero General Public License
 version 3 can be found in '/usr/share/common-licenses/AGPL-3'.
`
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'pipe', ...options })
}

/**
 * Re-inject the project copyright and README into the correct Debian doc
 * section of an already-built .deb, then repack it in place (root-owned,
 * with refreshed md5sums and Installed-Size). The .deb filename is left
 * untouched so the maker-deb pattern `<name>_<version>_<arch>.deb` is kept.
 */
export function finalizeDeb(debPath) {
  const absoluteDeb = path.resolve(debPath)
  if (!fs.existsSync(absoluteDeb)) {
    throw new Error(`finalize-deb: package not found at ${absoluteDeb}`)
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecie-deb-'))
  try {
    // Raw extract: control files into DEBIAN/, payload into the tree root.
    run('dpkg-deb', ['-R', absoluteDeb, workDir])

    const docDir = path.join(workDir, 'usr', 'share', 'doc', PACKAGE_NAME)
    fs.mkdirSync(docDir, { recursive: true })

    // copyright -> /usr/share/doc/<package>/copyright
    const copyrightPath = path.join(docDir, 'copyright')
    fs.writeFileSync(copyrightPath, buildCopyright(), { mode: 0o644 })
    fs.chmodSync(copyrightPath, 0o644)

    // README -> /usr/share/doc/<package>/README.md
    const readmeSource = path.join(repoRoot, 'README.md')
    const readmePath = path.join(docDir, 'README.md')
    fs.copyFileSync(readmeSource, readmePath)
    fs.chmodSync(readmePath, 0o644)

    refreshMd5sums(workDir)
    refreshInstalledSize(workDir)

    // Repack in place. --root-owner-group forces root:root ownership without
    // requiring fakeroot, matching what maker-deb produces.
    run('dpkg-deb', ['--root-owner-group', '-b', workDir, absoluteDeb])
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }

  return absoluteDeb
}

function listPayloadFiles(rootDir) {
  const results = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile()) {
        results.push(full)
      }
    }
  }
  // Everything except the control archive (DEBIAN/) is package payload.
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.name === 'DEBIAN') continue
    const full = path.join(rootDir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.isFile()) results.push(full)
  }
  return results
}

function refreshMd5sums(rootDir) {
  const md5Path = path.join(rootDir, 'DEBIAN', 'md5sums')
  const lines = listPayloadFiles(rootDir)
    .map((file) => {
      const relative = path.relative(rootDir, file)
      const hash = createHash('md5').update(fs.readFileSync(file)).digest('hex')
      return `${hash}  ${relative}`
    })
    .sort()
  fs.writeFileSync(md5Path, `${lines.join('\n')}\n`, { mode: 0o644 })
}

function refreshInstalledSize(rootDir) {
  const controlPath = path.join(rootDir, 'DEBIAN', 'control')
  // Installed-Size is the disk usage of the payload in KiB.
  const output = run('du', ['-k', '-s', '--exclude=./DEBIAN', '.'], { cwd: rootDir })
    .toString()
    .trim()
  const sizeKib = output.split(/\s+/)[0]

  const control = fs.readFileSync(controlPath, 'utf8')
  const updated = /^Installed-Size:.*$/m.test(control)
    ? control.replace(/^Installed-Size:.*$/m, `Installed-Size: ${sizeKib}`)
    : control.replace(/^(Architecture:.*)$/m, `$1\nInstalled-Size: ${sizeKib}`)
  fs.writeFileSync(controlPath, updated)
}

// Allow standalone use: `node scripts/finalize-deb.mjs path/to/pkg.deb`
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2]
  if (!target) {
    console.error('Usage: node scripts/finalize-deb.mjs <path-to-deb>')
    process.exit(1)
  }
  const result = finalizeDeb(target)
  console.log(`Finalized Debian package: ${result}`)
}
