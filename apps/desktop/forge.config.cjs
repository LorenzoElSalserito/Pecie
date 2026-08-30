const path = require('node:path')
const { pathToFileURL } = require('node:url')

const finalizeDebScript = path.resolve(__dirname, '../../scripts/finalize-deb.mjs')
const buildRpmScript = path.resolve(__dirname, '../../scripts/build-rpm.mjs')
const pendingReleasePath = path.resolve(__dirname, '../../scripts/.release-pending.json')

const assetIconBasePath = path.resolve(__dirname, 'src/renderer/src/asset/Icon')
const assetPngIconPath = `${assetIconBasePath}.png`
const assetIcoIconPath = `${assetIconBasePath}.ico`
const assetIcnsIconPath = `${assetIconBasePath}.icns`
const exportRuntimeResourcePath = path.resolve(__dirname, 'resources/export-runtime')
const macPkgIdentity = process.env.PECIE_MAC_PKG_IDENTITY

const makers = [
  {
    name: '@electron-forge/maker-deb',
    platforms: ['linux'],
    config: {
      options: {
        name: 'pecie',
        bin: 'pecie',
        section: 'misc',
        priority: 'optional',
        productName: 'pecie',
        genericName: 'pecie',
        icon: assetPngIconPath,
        maintainer: 'Lorenzo DM',
        homepage: 'https://github.com/lorenzodm/pecie',
        categories: ['Office']
      }
    }
  },
  {
    name: '@electron-forge/maker-dmg',
    platforms: ['darwin'],
    config: {
      name: 'pecie',
      icon: assetIcnsIconPath
    }
  },
  {
    name: '@electron-forge/maker-zip',
    platforms: ['darwin']
  }
]

if (macPkgIdentity) {
  makers.push({
    name: '@electron-forge/maker-pkg',
    platforms: ['darwin'],
    config: {
      name: 'pecie',
      overwrite: true,
      icon: assetIcnsIconPath,
      identity: macPkgIdentity,
      identityValidation: true
    }
  })
}

module.exports = {
  outDir: '../../build/desktop/forge',
  packagerConfig: {
    name: 'pecie',
    executableName: 'pecie',
    appBundleId: 'com.pecie.desktop',
    appCategoryType: 'public.app-category.productivity',
    appCopyright: 'Copyright © Lorenzo DM',
    asar: true,
    extraResource: [exportRuntimeResourcePath],
    ignore: [],
    icon: assetIconBasePath,
    win32metadata: {
      CompanyName: 'Lorenzo DM',
      FileDescription: 'pecie desktop writing workspace',
      InternalName: 'pecie',
      OriginalFilename: 'pecie.exe',
      ProductName: 'pecie'
    }
  },
  rebuildConfig: {},
  makers,
  hooks: {
    // After the .deb is built, inject the project copyright and README into the
    // correct Debian doc section (/usr/share/doc/pecie/) and repack in place.
    // The filename keeps the maker-deb pattern: pecie_<version>_<arch>.deb.
    //
    // The finalized .deb is then converted to the .rpm shipped for Fedora/openSUSE,
    // so every Linux artifact comes out of a single `make`. Set PECIE_SKIP_RPM=1 to
    // skip it on a machine without the alien/rpmbuild toolchain.
    async postMake(_forgeConfig, makeResults) {
      const { finalizeDeb } = await import(pathToFileURL(finalizeDebScript).href)
      const { buildRpm } = await import(pathToFileURL(buildRpmScript).href)
      for (const result of makeResults) {
        for (const artifact of [...result.artifacts]) {
          if (!artifact.endsWith('.deb')) {
            continue
          }
          await finalizeDeb(artifact)
          if (process.env.PECIE_SKIP_RPM === '1') {
            continue
          }
          // Reported alongside the .deb so forge lists both packages as build output.
          result.artifacts.push(await buildRpm(artifact))
        }
      }
      // Marker removed only after every artifact and post-processing step succeeds.
      require('node:fs').rmSync(pendingReleasePath, { force: true })
      return makeResults
    }
  }
}
