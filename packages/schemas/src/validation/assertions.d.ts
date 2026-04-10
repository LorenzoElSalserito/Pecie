export declare class SchemaValidationError extends Error {
    readonly schemaName: string;
    readonly details: string;
    constructor(schemaName: string, details: string);
}
export declare function assertRecord(value: unknown, schemaName: string): asserts value is Record<string, unknown>;
export declare function assertString(value: unknown, fieldName: string, schemaName: string): asserts value is string;
export declare function assertBoolean(value: unknown, fieldName: string, schemaName: string): asserts value is boolean;
export declare function assertArray(value: unknown, fieldName: string, schemaName: string): asserts value is unknown[];
