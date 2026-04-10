const path = require('node:path')

const assetIconBasePath = path.resolve(__dirname, 'src/renderer/src/asset/Icon')
const assetPngIconPath = `${assetIconBasePath}.png`
const assetIcoIconPath = `${assetIconBasePath}.ico`
const assetIcnsIconPath = `${assetIconBasePath}.icns`

module.exports = {
  outDir: '../../build/desktop/forge',
  packagerConfig: {
    name: 'Pecie',
    executableName: 'pecie',
    appBundleId: 'com.pecie.desktop',
    appCategoryType: 'public.app-category.productivity',
    appCopyright: 'Copyright © Lorenzo DM',
    asar: true,
    ignore: [],
    icon: assetIconBasePath,
    win32metadata: {
      CompanyName: 'Lorenzo DM',
      FileDescription: 'Pecie desktop writing workspace',
      InternalName: 'Pecie',
      OriginalFilename: 'Pecie.exe',
      ProductName: 'Pecie'
    }
  },
  rebuildConfig: {
    ignoreModules: ['better-sqlite3']
  },
  makers: [
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
      name: '@electron-forge/maker-snap',
      platforms: ['linux'],
      config: {
        name: 'pecie',
        productName: 'Pecie',
        genericName: 'Pecie',
        executableName: 'pecie',
        icon: assetPngIconPath,
        summary: 'Pecie desktop writing workspace',
        description: 'Accessible local-first writing environment for long-form projects.',
        category: 'Office'
      }
    },
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'pecie',
        authors: 'Lorenzo DM',
        description: 'Accessible local-first writing environment for long-form projects.',
        exe: 'Pecie.exe',
        setupExe: 'Pecie-Setup.exe',
        setupIcon: assetIcoIconPath,
        shortcutName: 'Pecie',
        shortcutFolderName: 'Pecie',
        iconUrl:
          'https://raw.githubusercontent.com/lorenzodm/pecie/main/apps/desktop/src/renderer/src/asset/Icon.ico',
      }
    },
    {
      name: '@electron-forge/maker-pkg',
      platforms: ['darwin'],
      config: {
        name: 'Pecie',
        overwrite: true,
        icon: assetIcnsIconPath
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
}
