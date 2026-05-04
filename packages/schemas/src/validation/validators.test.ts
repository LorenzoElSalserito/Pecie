import { describe, expect, it } from 'vitest'

import { invalidManifestFixture, validBinderFixture, validManifestFixture, validProjectFixture } from '../fixtures'
import { SchemaValidationError } from './assertions'
import {
  validateBinderDocument,
  validateManifest,
  validatePluginManifest,
  validatePrivacyInventory,
  validateProjectMetadata,
  validateTutorialScript
} from './validators'

describe('schema validators', () => {
  it('accepts valid manifest/project/binder fixtures', () => {
    expect(validateManifest(validManifestFixture)).toEqual(validManifestFixture)
    expect(validateProjectMetadata(validProjectFixture)).toEqual(validProjectFixture)
    expect(validateBinderDocument(validBinderFixture)).toEqual(validBinderFixture)
  })

  it('rejects invalid manifest fixture', () => {
    expect(() => validateManifest(invalidManifestFixture)).toThrow(SchemaValidationError)
  })

  it('accepts privacy inventory DTOs', () => {
    expect(
      validatePrivacyInventory({
        generatedAt: '2026-04-15T00:00:00.000Z',
        items: [
          {
            id: 'cache-preview',
            category: 'cache',
            label: 'Preview cache',
            relativePath: 'cache/preview',
            sizeBytes: 42,
            containsSensitiveData: true,
            deletable: true,
            source: 'project',
            maintenanceAction: 'clearPreviewCache',
            descriptionKey: 'privacy.inventory.previewCache'
          }
        ],
        totals: {
          sizeBytes: 42,
          sensitiveItems: 1,
          deletableItems: 1
        }
      })
    ).toMatchObject({
      totals: {
        sizeBytes: 42
      }
    })
  })

  it('accepts tutorial scripts serialized as data', () => {
    expect(
      validateTutorialScript({
        id: 'workspace-basics',
        schemaVersion: 1,
        icon: 'bi-layout-text-window-reverse',
        titleKey: 'tutorialWorkspaceTitle',
        steps: [
          {
            id: 'open-export',
            bodyKey: 'tutorialWorkspaceStep1',
            targetLabelKey: 'tutorialTargetWorkspaceExport',
            action: 'click',
            target: {
              kind: 'tutorial-id',
              value: 'workspace-open-export'
            }
          }
        ]
      })
    ).toMatchObject({
      id: 'workspace-basics',
      steps: [{ id: 'open-export' }]
    })
  })

  it('rejects tutorial selector targets that do not use stable tutorial ids', () => {
    expect(() =>
      validateTutorialScript({
        id: 'fragile-copy-selector',
        schemaVersion: 1,
        icon: 'bi-compass',
        titleKey: 'tutorialWorkspaceTitle',
        steps: [
          {
            id: 'open-by-copy',
            bodyKey: 'tutorialWorkspaceStep1',
            targetLabelKey: 'tutorialTargetWorkspaceExport',
            action: 'click',
            target: {
              kind: 'selector',
              value: 'button[aria-label="Export"]'
            }
          }
        ]
      })
    ).toThrow(SchemaValidationError)
  })

  it('accepts plugin manifests with declared permissions and hooks', () => {
    expect(
      validatePluginManifest({
        id: 'local-export-helper',
        schemaVersion: 1,
        label: 'Local export helper',
        version: '0.1.0',
        entryPoint: 'index.js',
        permissions: ['project.read', 'export.read'],
        hooks: ['onProjectOpen', 'onExportProfileLoaded']
      })
    ).toMatchObject({
      id: 'local-export-helper',
      permissions: ['project.read', 'export.read']
    })
  })

  it('rejects plugin manifests with unsafe entry points', () => {
    expect(() =>
      validatePluginManifest({
        id: 'unsafe-plugin',
        schemaVersion: 1,
        label: 'Unsafe plugin',
        version: '0.1.0',
        entryPoint: '../escape.js',
        permissions: ['project.read'],
        hooks: ['onProjectOpen']
      })
    ).toThrow(SchemaValidationError)
  })
})
