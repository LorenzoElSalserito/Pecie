const path = require('node:path')

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
        productName: 'Pecie',
        genericName: 'Pecie',
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
      name: 'Pecie',
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
      name: 'Pecie',
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
    name: 'Pecie',
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
      FileDescription: 'Pecie desktop writing workspace',
      InternalName: 'Pecie',
      OriginalFilename: 'pecie.exe',
      ProductName: 'Pecie'
    }
  },
  rebuildConfig: {
    ignoreModules: ['better-sqlite3']
  },
  makers
}
