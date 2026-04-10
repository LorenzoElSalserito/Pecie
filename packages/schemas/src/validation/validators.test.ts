import { describe, expect, it } from 'vitest'

import { invalidManifestFixture, validBinderFixture, validManifestFixture, validProjectFixture } from '../fixtures'
import { SchemaValidationError } from './assertions'
import { validateBinderDocument, validateManifest, validateProjectMetadata } from './validators'

describe('schema validators', () => {
  it('accepts valid manifest/project/binder fixtures', () => {
    expect(validateManifest(validManifestFixture)).toEqual(validManifestFixture)
    expect(validateProjectMetadata(validProjectFixture)).toEqual(validProjectFixture)
    expect(validateBinderDocument(validBinderFixture)).toEqual(validBinderFixture)
  })

  it('rejects invalid manifest fixture', () => {
    expect(() => validateManifest(invalidManifestFixture)).toThrow(SchemaValidationError)
  })
})
