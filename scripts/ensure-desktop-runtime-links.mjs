import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDirectory, '..')
const desktopRoot = path.join(repoRoot, 'apps/desktop')
const desktopPackageJsonPath = path.join(desktopRoot, 'package.json')
const desktopNodeModulesPath = path.join(desktopRoot, 'node_modules')
const rootNodeModulesPath = path.join(repoRoot, 'node_modules')

async function pathExists(targetPath) {
  try {
    await fs.lstat(targetPath)
    return true
  } catch {
    return false
  }
}

async function ensureDirectory(targetPath) {
  await fs.mkdir(targetPath, { recursive: true })
}

async function removeIfExists(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true })
}

async function readJsonFile(targetPath) {
  return JSON.parse(await fs.readFile(targetPath, 'utf8'))
}

function resolveDependencyPackagePath(dependencyName, requesterPackageJsonPath) {
  const requesterRequire = createRequire(requesterPackageJsonPath)
  return requesterRequire.resolve(`${dependencyName}/package.json`)
}

async function ensureLinkedDependency(dependencyName, seenDependencies, requesterPackageJsonPath) {
  if (seenDependencies.has(dependencyName)) {
    return
  }

  seenDependencies.add(dependencyName)

  const workspaceDependencyPath = path.join(desktopNodeModulesPath, dependencyName)
  const workspaceDependencyExists = await pathExists(workspaceDependencyPath)
  let sourceDependencyPath
  let dependencyPackageJsonPath

  try {
    dependencyPackageJsonPath = resolveDependencyPackagePath(dependencyName, requesterPackageJsonPath)
    sourceDependencyPath = path.dirname(dependencyPackageJsonPath)
  } catch {
    const hoistedDependencyPath = path.join(rootNodeModulesPath, dependencyName)
    if (!(await pathExists(hoistedDependencyPath))) {
      throw new Error(
        `Missing runtime dependency "${dependencyName}". ` +
          `Expected it in "${workspaceDependencyPath}" or resolvable from "${requesterPackageJsonPath}". ` +
          `Run a clean install before packaging.`
      )
    }

    sourceDependencyPath = hoistedDependencyPath
    dependencyPackageJsonPath = path.join(sourceDependencyPath, 'package.json')
  }

  if (!workspaceDependencyExists) {
    await ensureDirectory(path.dirname(workspaceDependencyPath))
    await fs.cp(sourceDependencyPath, workspaceDependencyPath, {
      recursive: true,
      dereference: true
    })
  } else {
    const workspaceDependencyStats = await fs.lstat(workspaceDependencyPath)

    if (workspaceDependencyStats.isSymbolicLink()) {
      await removeIfExists(workspaceDependencyPath)
      await fs.cp(sourceDependencyPath, workspaceDependencyPath, {
        recursive: true,
        dereference: true
      })
    }
  }

  if (!(await pathExists(dependencyPackageJsonPath))) {
    return
  }

  const dependencyPackageJson = await readJsonFile(dependencyPackageJsonPath)
  const transitiveRuntimeDependencies = Object.keys(dependencyPackageJson.dependencies ?? {})

  for (const transitiveDependencyName of transitiveRuntimeDependencies) {
    await ensureLinkedDependency(transitiveDependencyName, seenDependencies, dependencyPackageJsonPath)
  }
}

async function main() {
  await ensureDirectory(desktopNodeModulesPath)

  const desktopPackageJson = await readJsonFile(desktopPackageJsonPath)
  const packagingDependencyNames = new Set(Object.keys(desktopPackageJson.dependencies ?? {}))

  if (desktopPackageJson.devDependencies?.electron) {
    packagingDependencyNames.add('electron')
  }

  const seenDependencies = new Set()

  for (const dependencyName of packagingDependencyNames) {
    await ensureLinkedDependency(dependencyName, seenDependencies, desktopPackageJsonPath)
  }
}

await main()
