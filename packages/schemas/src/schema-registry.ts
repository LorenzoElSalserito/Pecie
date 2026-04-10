export const schemaRegistry = {
  manifest: 'schemas/manifest.schema.json',
  project: 'schemas/project.schema.json',
  binder: 'schemas/binder.schema.json'
} as const

export type SchemaName = keyof typeof schemaRegistry
