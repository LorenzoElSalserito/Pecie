import { assertArray, assertBoolean, assertRecord, assertString, SchemaValidationError } from './assertions';
export function validateManifest(value) {
    const schemaName = 'manifest';
    assertRecord(value, schemaName);
    assertString(value.format, 'format', schemaName);
    if (value.format !== 'pecie-project') {
        throw new SchemaValidationError(schemaName, 'Field "format" must be "pecie-project"');
    }
    assertString(value.formatVersion, 'formatVersion', schemaName);
    assertString(value.projectId, 'projectId', schemaName);
    assertString(value.title, 'title', schemaName);
    assertString(value.createdAt, 'createdAt', schemaName);
    assertString(value.appMinVersion, 'appMinVersion', schemaName);
    assertString(value.historyMode, 'historyMode', schemaName);
    assertString(value.contentModel, 'contentModel', schemaName);
    assertString(value.cacheModel, 'cacheModel', schemaName);
    assertString(value.defaultExportProfile, 'defaultExportProfile', schemaName);
    assertString(value.language, 'language', schemaName);
    assertString(value.privacyMode, 'privacyMode', schemaName);
    assertBoolean(value.embeddedHistory, 'embeddedHistory', schemaName);
    assertString(value.a11yProfile, 'a11yProfile', schemaName);
    assertRecord(value.schemaUris, 'schemaUris');
    assertString(value.schemaUris.manifest, 'schemaUris.manifest', schemaName);
    assertString(value.schemaUris.project, 'schemaUris.project', schemaName);
    assertString(value.schemaUris.binder, 'schemaUris.binder', schemaName);
    return value;
}
export function validateProjectMetadata(value) {
    const schemaName = 'project';
    assertRecord(value, schemaName);
    assertString(value.title, 'title', schemaName);
    assertRecord(value.author, schemaName);
    assertString(value.author.name, 'author.name', schemaName);
    assertString(value.author.role, 'author.role', schemaName);
    assertString(value.documentKind, 'documentKind', schemaName);
    assertString(value.defaultLanguage, 'defaultLanguage', schemaName);
    assertString(value.defaultBibliographyStyle, 'defaultBibliographyStyle', schemaName);
    assertString(value.projectVisibility, 'projectVisibility', schemaName);
    assertBoolean(value.containsSensitiveData, 'containsSensitiveData', schemaName);
    if (value.institution !== undefined) {
        assertRecord(value.institution, schemaName);
        assertString(value.institution.name, 'institution.name', schemaName);
        if (value.institution.department !== undefined) {
            assertString(value.institution.department, 'institution.department', schemaName);
        }
    }
    return value;
}
function validateBinderNode(value) {
    const schemaName = 'binder';
    assertRecord(value, schemaName);
    assertString(value.id, 'nodes[].id', schemaName);
    assertString(value.type, 'nodes[].type', schemaName);
    assertString(value.title, 'nodes[].title', schemaName);
    if (value.children !== undefined) {
        assertArray(value.children, 'nodes[].children', schemaName);
        value.children.forEach((childId) => assertString(childId, 'nodes[].children[]', schemaName));
    }
    if (value.path !== undefined) {
        assertString(value.path, 'nodes[].path', schemaName);
    }
    if (value.documentId !== undefined) {
        assertString(value.documentId, 'nodes[].documentId', schemaName);
    }
    return value;
}
export function validateBinderDocument(value) {
    const schemaName = 'binder';
    assertRecord(value, schemaName);
    assertString(value.rootId, 'rootId', schemaName);
    assertArray(value.nodes, 'nodes', schemaName);
    const nodes = value.nodes.map((node) => validateBinderNode(node));
    const rootNode = nodes.find((node) => node.id === value.rootId);
    if (!rootNode) {
        throw new SchemaValidationError(schemaName, 'rootId must reference an existing node');
    }
    return { rootId: value.rootId, nodes };
}
