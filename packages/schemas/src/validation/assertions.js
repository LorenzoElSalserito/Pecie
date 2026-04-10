export class SchemaValidationError extends Error {
    schemaName;
    details;
    constructor(schemaName, details) {
        super(`[${schemaName}] ${details}`);
        this.schemaName = schemaName;
        this.details = details;
        this.name = 'SchemaValidationError';
    }
}
export function assertRecord(value, schemaName) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new SchemaValidationError(schemaName, 'Expected an object');
    }
}
export function assertString(value, fieldName, schemaName) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new SchemaValidationError(schemaName, `Field "${fieldName}" must be a non-empty string`);
    }
}
export function assertBoolean(value, fieldName, schemaName) {
    if (typeof value !== 'boolean') {
        throw new SchemaValidationError(schemaName, `Field "${fieldName}" must be a boolean`);
    }
}
export function assertArray(value, fieldName, schemaName) {
    if (!Array.isArray(value)) {
        throw new SchemaValidationError(schemaName, `Field "${fieldName}" must be an array`);
    }
}
