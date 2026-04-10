export class SchemaValidationError extends Error {
  constructor(
    public readonly schemaName: string,
    public readonly details: string
  ) {
    super(`[${schemaName}] ${details}`)
    this.name = 'SchemaValidationError'
  }
}

export function assertRecord(value: unknown, schemaName: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SchemaValidationError(schemaName, 'Expected an object')
  }
}

export function assertString(
  value: unknown,
  fieldName: string,
  schemaName: string
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SchemaValidationError(schemaName, `Field "${fieldName}" must be a non-empty string`)
  }
}

export function assertBoolean(
  value: unknown,
  fieldName: string,
  schemaName: string
): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new SchemaValidationError(schemaName, `Field "${fieldName}" must be a boolean`)
  }
}

export function assertArray(
  value: unknown,
  fieldName: string,
  schemaName: string
): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new SchemaValidationError(schemaName, `Field "${fieldName}" must be an array`)
  }
}
