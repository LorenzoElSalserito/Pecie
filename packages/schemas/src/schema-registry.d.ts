export declare const schemaRegistry: {
    readonly manifest: "schemas/manifest.schema.json";
    readonly project: "schemas/project.schema.json";
    readonly binder: "schemas/binder.schema.json";
};
export type SchemaName = keyof typeof schemaRegistry;
