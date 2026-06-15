const path = require('node:path')
const { pathToFileURL } = require('node:url')

const finalizeDebScript = path.resolve(__dirname, '../../scripts/finalize-deb.mjs')

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
  rebuildConfig: {
    ignoreModules: ['better-sqlite3']
  },
  makers,
  hooks: {
    // After the .deb is built, inject the project copyright and README into the
    // correct Debian doc section (/usr/share/doc/pecie/) and repack in place.
    // The filename keeps the maker-deb pattern: pecie_<version>_<arch>.deb.
    async postMake(_forgeConfig, makeResults) {
      const { finalizeDeb } = await import(pathToFileURL(finalizeDebScript).href)
      for (const result of makeResults) {
        for (const artifact of result.artifacts) {
          if (artifact.endsWith('.deb')) {
            finalizeDeb(artifact)
          }
        }
      }
      return makeResults
    }
  }
}
