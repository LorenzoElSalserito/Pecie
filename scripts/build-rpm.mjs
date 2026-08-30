import { execFile, execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { lstat, mkdir, mkdtemp, open, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '..')

// RPM package identity. Must stay in sync with the maker-deb `name` option in
// apps/desktop/forge.config.cjs: the .deb is the only input of this conversion.
const PACKAGE_NAME = 'pecie'
const INSTALL_PREFIX = `/usr/lib/${PACKAGE_NAME}`
const PACKAGE_OWNED_DIRECTORY_ROOTS = [INSTALL_PREFIX, `/usr/share/doc/${PACKAGE_NAME}`]
const SUMMARY = 'Libre & Professional Editorial Studio'
const LICENSE = 'AGPL-3.0-only'
const HOMEPAGE = 'https://github.com/lorenzodm/pecie'
const PACKAGER = 'Lorenzo DM'

const elfMagic = Buffer.from([0x7f, 0x45, 0x4c, 0x46])

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'pipe', ...options })?.toString() ?? ''
}

async function isElfFile(filePath) {
  const stats = await lstat(filePath)
  if (!stats.isFile() || stats.size < elfMagic.length) {
    return false
  }

  const handle = await open(filePath, 'r')
  try {
    const header = Buffer.alloc(elfMagic.length)
    await handle.read(header, 0, elfMagic.length, 0)
    return header.equals(elfMagic)
  } finally {
    await handle.close()
  }
}

async function collectSharedObjects(root) {
  const found = []
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile() && /\.so($|\.)/.test(entry.name) && (await isElfFile(full))) {
        found.push(full)
      }
    }
  }
  await walk(root)
  return found
}

async function readSoname(filePath) {
  try {
    const { stdout } = await execFileAsync('objdump', ['-p', filePath], {
      maxBuffer: 8 * 1024 * 1024
    })
    return /^\s*SONAME\s+(\S+)$/m.exec(stdout)?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * Every library name the payload carries itself, as the dependency generator would
 * spell it: the DT_SONAME when there is one, plus the on-disk file name.
 *
 * The bundled WeasyPrint sidecar ships auditwheel-mangled copies of its native
 * dependencies (libjpeg-8296d2fa.so.62.4.0, liblzma-…, libtiff-…). rpmbuild derives
 * Requires from those names but derives the versioned Provides from the ELF verdef,
 * which still carries the *original* soname (libjpeg.so.62). The two never meet, so
 * a package built with the default generator asks the distribution for libraries
 * that exist nowhere but inside the package itself:
 *
 *   nothing provides libjpeg-8296d2fa.so.62.4.0(LIBJPEG_6.2)(64bit)
 *
 * Both sides are dropped instead of reconciled: the app resolves these through
 * PyInstaller's own loader paths, so RPM has no business tracking them.
 */
async function collectBundledLibraryNames(buildRoot) {
  const names = new Set()
  for (const sharedObject of await collectSharedObjects(buildRoot)) {
    names.add(path.basename(sharedObject))
    const soname = await readSoname(sharedObject)
    if (soname) {
      names.add(soname)
    }
  }
  return [...names].sort()
}

// Regex metacharacters are neutralised with bracket expressions rather than
// backslashes: these regexes live in a spec file, and the rpm macro parser eats
// backslashes before the regex ever reaches regcomp ("Ignoring invalid regex").
// Only characters a library name may legitimately hold are accepted, so no escape
// that cannot be written as a bracket expression is ever needed.
function escapeForRpmRegex(value) {
  if (!/^[A-Za-z0-9._+-]+$/.test(value)) {
    throw new Error(`build-rpm: unexpected characters in library name ${value}`)
  }
  return value.replace(/[.+-]/g, (character) => `[${character}]`)
}

/**
 * Macros injected into the alien-generated spec, above %description.
 *
 * - __requires_exclude drops the auto-generated Requires on bundled libraries; the
 *   Requires left over are the real system ones (libc, libgtk-3, libX11, …), which
 *   distributions do provide.
 * - __provides_exclude_from stops the package from advertising its private copies of
 *   libcrypto/libpython/libjpeg to the rest of the system.
 * - __os_install_post is cleared so rpmbuild does not strip, re-compress or
 *   shebang-mangle an already-built payload extracted from the .deb.
 * - _build_id_links none keeps /usr/lib/.build-id out of the package: alien does not
 *   list those files in %files.
 */
function buildDependencyMacros(bundledLibraryNames) {
  const alternatives = bundledLibraryNames.map(escapeForRpmRegex).join('|')
  return [
    '%global __os_install_post %{nil}',
    '%global _build_id_links none',
    `%global __provides_exclude_from ^${INSTALL_PREFIX.replace(/[.]/g, '[.]')}/`,
    `%global __requires_exclude ^(${alternatives})([(]|$)`
  ]
}

const METADATA_REWRITES = [
  [/^Summary:.*$/m, `Summary: ${SUMMARY}`],
  [/^License:.*$/m, `License: ${LICENSE}`],
  [/^Group:.*$/m, 'Group: Applications/Productivity'],
  [/^Distribution:.*$/m, `Vendor: ${PACKAGER}`]
]

function rewriteSpec(spec, bundledLibraryNames, rpmDir) {
  let updated = spec
  for (const [pattern, replacement] of METADATA_REWRITES) {
    if (!pattern.test(updated)) {
      throw new Error(`build-rpm: alien spec has no field matching ${pattern}`)
    }
    updated = updated.replace(pattern, replacement)
  }

  // alien hardcodes `%define _rpmdir ../`, and a %define in the spec wins over
  // --define on the rpmbuild command line, so the output directory is set here.
  if (!/^%define _rpmdir .*$/m.test(updated)) {
    throw new Error('build-rpm: alien spec no longer defines _rpmdir')
  }
  updated = updated.replace(/^%define _rpmdir .*$/m, `%define _rpmdir ${rpmDir}`)

  updated = updated.replace(/^(Vendor:.*)$/m, `$1\nPackager: ${PACKAGER}\nURL: ${HOMEPAGE}`)

  // alien emits every directory from the Debian archive as `%dir`. That makes the
  // RPM own shared FHS directories such as /usr/share/applications and
  // /usr/share/pixmaps, causing file conflicts with the distribution's filesystem
  // package and every application that also (incorrectly) owns them. Keep directory
  // ownership only below package-private roots; individual desktop/icon files remain
  // explicitly listed and therefore stay in the payload.
  updated = updated
    .split('\n')
    .filter((line) => {
      if (!line.startsWith('%dir ')) return true
      const match = /^%dir "(\/[^"\n]+)"$/.exec(line)
      if (!match) {
        throw new Error(`build-rpm: cannot parse alien directory entry: ${line}`)
      }
      const directory = match[1].replace(/\/+$/, '')
      return PACKAGE_OWNED_DIRECTORY_ROOTS.some(
        (root) => directory === root || directory.startsWith(`${root}/`)
      )
    })
    .join('\n')

  const macros = buildDependencyMacros(bundledLibraryNames).join('\n')
  const descriptionIndex = updated.indexOf('%description')
  if (descriptionIndex === -1) {
    throw new Error('build-rpm: alien spec has no %description section')
  }
  return `${updated.slice(0, descriptionIndex)}${macros}\n\n${updated.slice(descriptionIndex)}`
}

function queryRpmFiles(rpmPath) {
  return run('rpm', [
    '-qp',
    '--qf',
    '[%{FILENAMES}\\t%{FILEMODES:perms}\\n]',
    rpmPath
  ])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const separator = line.lastIndexOf('\t')
      if (separator === -1) {
        throw new Error(`build-rpm: cannot parse RPM file entry: ${line}`)
      }
      return { name: line.slice(0, separator), mode: line.slice(separator + 1) }
    })
}

/** Refuse shared directory ownership even if alien changes its spec format later. */
function assertNoSharedDirectoryOwnership(rpmPath) {
  const offending = queryRpmFiles(rpmPath)
    .filter(({ mode }) => mode.startsWith('d'))
    .map(({ name }) => name.replace(/\/+$/, ''))
    .filter(
      (directory) =>
        !PACKAGE_OWNED_DIRECTORY_ROOTS.some(
          (root) => directory === root || directory.startsWith(`${root}/`)
        )
    )

  if (offending.length > 0) {
    throw new Error(
      `build-rpm: package owns shared directories:\n  ${offending.join('\n  ')}`
    )
  }
}

/**
 * Release gate on the finished package: no Requires may name a library the package
 * itself ships. One surviving entry means an uninstallable RPM, which is the exact
 * failure this script exists to prevent.
 */
function assertNoBundledRequires(rpmPath, bundledLibraryNames) {
  const bundled = new Set(bundledLibraryNames)
  const offending = run('rpm', ['-qp', '--requires', rpmPath])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => bundled.has(/^([^\s(]+)/.exec(line)?.[1] ?? ''))

  if (offending.length > 0) {
    throw new Error(
      `build-rpm: package requires libraries it bundles itself:\n  ${offending.join('\n  ')}`
    )
  }
}

function assertToolchain() {
  const missing = ['alien', 'rpmbuild', 'rpm', 'objdump'].filter((tool) => {
    try {
      run('sh', ['-c', `command -v ${tool}`])
      return false
    } catch {
      return true
    }
  })

  if (missing.length > 0) {
    throw new Error(
      `build-rpm: missing tools: ${missing.join(', ')} (Debian: apt install alien rpm binutils)`
    )
  }
}

/**
 * Convert an already-finalized .deb into an .rpm with `alien`, patching the spec it
 * generates so the dependency generator ignores the bundled runtime. The .rpm is
 * written next to the .deb as <name>-<version>-<release>.<arch>.rpm.
 */
export async function buildRpm(debPath) {
  const absoluteDeb = path.resolve(debPath)
  if (!fs.existsSync(absoluteDeb)) {
    throw new Error(`build-rpm: package not found at ${absoluteDeb}`)
  }

  assertToolchain()

  if (!process.env.FAKEROOTKEY) {
    run('fakeroot', [process.execPath, fileURLToPath(import.meta.url), '--internal', absoluteDeb], { stdio: 'inherit' })
    const version = run('dpkg-deb', ['-f', absoluteDeb, 'Version']).trim()
    const candidates = (await readdir(path.dirname(absoluteDeb))).filter(
      (entry) => entry.startsWith(`${PACKAGE_NAME}-${version}-`) && entry.endsWith('.rpm')
    )
    if (candidates.length !== 1) throw new Error(`build-rpm: expected one RPM for ${version}, got ${candidates.length}`)
    return path.join(path.dirname(absoluteDeb), candidates[0])
  }

  const workDir = await mkdtemp(path.join(path.dirname(absoluteDeb), '.pecie-rpm-'))
  try {
    // `alien -g` unpacks the .deb and writes a spec without building anything, which
    // is the only hook available: alien exposes no way to pass macros to rpmbuild.
    run('alien', ['-g', '-r', '--keep-version', absoluteDeb], { cwd: workDir })

    const generatedDirectories = (await readdir(workDir, { withFileTypes: true })).filter((entry) =>
      entry.isDirectory()
    )
    if (generatedDirectories.length !== 1) {
      throw new Error(
        `build-rpm: expected one directory from alien, got ${generatedDirectories.length}`
      )
    }
    const buildRoot = path.join(workDir, generatedDirectories[0].name)

    const specName = (await readdir(buildRoot)).find((entry) => entry.endsWith('.spec'))
    if (!specName) {
      throw new Error(`build-rpm: alien produced no spec file in ${buildRoot}`)
    }
    const specPath = path.join(buildRoot, specName)

    const payloadRoot = path.join(buildRoot, INSTALL_PREFIX.replace(/^\//, ''))
    const bundledLibraryNames = await collectBundledLibraryNames(payloadRoot)
    console.log(`[build-rpm] ${bundledLibraryNames.length} bundled shared libraries excluded`)

    const rpmDir = path.join(workDir, 'rpms')
    await mkdir(rpmDir, { recursive: true })

    await writeFile(
      specPath,
      rewriteSpec(await readFile(specPath, 'utf8'), bundledLibraryNames, rpmDir)
    )

    const build = spawnSync(
      'rpmbuild',
      [
        '--define',
        `_topdir ${workDir}`,
        '--buildroot',
        buildRoot,
        '--target',
        `${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}-unknown-linux`,
        '-bb',
        specPath
      ],
      { cwd: buildRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
    if (build.status !== 0) {
      throw new Error(`build-rpm: rpmbuild failed\n${build.stderr}`)
    }
    // rpm reports a filter it could not compile as a warning and then builds a package
    // with unfiltered dependencies, so the warning is treated as a failure here.
    if (`${build.stdout}${build.stderr}`.includes('Ignoring invalid regex')) {
      throw new Error('build-rpm: rpmbuild rejected the dependency filter regex')
    }

    const [rpmName] = (await readdir(rpmDir)).filter((entry) => entry.endsWith('.rpm'))
    if (!rpmName) {
      throw new Error('build-rpm: rpmbuild produced no package')
    }

    const builtRpm = path.join(rpmDir, rpmName)
    assertNoBundledRequires(builtRpm, bundledLibraryNames)
    assertNoSharedDirectoryOwnership(builtRpm)

    const targetRpm = path.join(path.dirname(absoluteDeb), rpmName)
    await fs.promises.copyFile(builtRpm, targetRpm)
    return targetRpm
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

async function findLatestDeb() {
  const makeRoot = path.join(repoRoot, 'build/desktop/forge/make/deb')
  const candidates = []
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile() && entry.name.endsWith('.deb')) {
        candidates.push(full)
      }
    }
  }
  if (!fs.existsSync(makeRoot)) {
    return null
  }
  await walk(makeRoot)

  const withTimes = await Promise.all(
    candidates.map(async (file) => ({ file, mtime: (await lstat(file)).mtimeMs }))
  )
  return withTimes.sort((a, b) => b.mtime - a.mtime)[0]?.file ?? null
}

// Allow standalone use: `node scripts/build-rpm.mjs [path/to/pkg.deb]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const internal = process.argv[2] === '--internal'
  const target = process.argv[internal ? 3 : 2] ?? (await findLatestDeb())
  if (!target) {
    console.error('Usage: node scripts/build-rpm.mjs <path-to-deb>')
    process.exit(1)
  }
  const result = await buildRpm(target)
  if (!internal) console.log(`Built RPM package: ${result}`)
}
