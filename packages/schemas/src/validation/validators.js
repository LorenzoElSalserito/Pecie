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
    assertString(value.schemaUris.timeline, 'schemaUris.timeline', schemaName);
    assertString(value.schemaUris.milestones, 'schemaUris.milestones', schemaName);
    assertString(value.schemaUris.historyRepair, 'schemaUris.historyRepair', schemaName);
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
function validateTimelineAuthorRecord(value, schemaName, path) {
    assertRecord(value, schemaName);
    assertString(value.pecieAuthorId, `${path}.pecieAuthorId`, schemaName);
    assertString(value.pecieDisplayName, `${path}.pecieDisplayName`, schemaName);
    assertString(value.gitName, `${path}.gitName`, schemaName);
    assertString(value.gitEmail, `${path}.gitEmail`, schemaName);
    return value;
}
function validateTimelineEventRecord(value, index) {
    const schemaName = 'timeline';
    assertRecord(value, schemaName);
    assertString(value.timelineEventId, `events[${index}].timelineEventId`, schemaName);
    assertString(value.commitHash, `events[${index}].commitHash`, schemaName);
    assertString(value.kind, `events[${index}].kind`, schemaName);
    assertString(value.label, `events[${index}].label`, schemaName);
    assertString(value.createdAt, `events[${index}].createdAt`, schemaName);
    validateTimelineAuthorRecord(value.author, schemaName, `events[${index}].author`);
    assertArray(value.touchedPaths, `events[${index}].touchedPaths`, schemaName);
    value.touchedPaths.forEach((item, itemIndex) => assertString(item, `events[${index}].touchedPaths[${itemIndex}]`, schemaName));
    assertString(value.integrity, `events[${index}].integrity`, schemaName);
    if (value.noteMarkdown !== undefined) {
        assertString(value.noteMarkdown, `events[${index}].noteMarkdown`, schemaName);
    }
    return value;
}
function validateTimelineGroup(value, index) {
    const schemaName = 'timeline';
    assertRecord(value, schemaName);
    assertString(value.groupId, `groups[${index}].groupId`, schemaName);
    assertString(value.label, `groups[${index}].label`, schemaName);
    assertString(value.dayKey, `groups[${index}].dayKey`, schemaName);
    assertString(value.sessionLabel, `groups[${index}].sessionLabel`, schemaName);
    assertArray(value.eventIds, `groups[${index}].eventIds`, schemaName);
    value.eventIds.forEach((item, itemIndex) => assertString(item, `groups[${index}].eventIds[${itemIndex}]`, schemaName));
    return value;
}
export function validateHistoryRepairResult(value) {
    const schemaName = 'historyRepair';
    assertRecord(value, schemaName);
    for (const field of ['totalCommits', 'eventsOk', 'eventsRepaired', 'eventsMissingCommit', 'eventsMissingMetadata']) {
        if (typeof value[field] !== 'number') {
            throw new SchemaValidationError(schemaName, `Field "${field}" must be a number`);
        }
    }
    assertArray(value.warnings, 'warnings', schemaName);
    value.warnings.forEach((warning, index) => assertString(warning, `warnings[${index}]`, schemaName));
    return value;
}
export function validateTimelineSnapshot(value) {
    const schemaName = 'timeline';
    assertRecord(value, schemaName);
    assertString(value.version, 'version', schemaName);
    assertString(value.generatedAt, 'generatedAt', schemaName);
    assertArray(value.events, 'events', schemaName);
    assertArray(value.groups, 'groups', schemaName);
    const events = value.events.map((event, index) => validateTimelineEventRecord(event, index));
    const groups = value.groups.map((group, index) => validateTimelineGroup(group, index));
    const integrityReport = validateHistoryRepairResult(value.integrityReport);
    return {
        version: value.version,
        generatedAt: value.generatedAt,
        events,
        groups,
        integrityReport
    };
}
function validateMilestoneRecord(value, index) {
    const schemaName = 'milestones';
    assertRecord(value, schemaName);
    assertString(value.timelineEventId, `milestones[${index}].timelineEventId`, schemaName);
    assertString(value.commitHash, `milestones[${index}].commitHash`, schemaName);
    assertString(value.label, `milestones[${index}].label`, schemaName);
    assertString(value.createdAt, `milestones[${index}].createdAt`, schemaName);
    if (value.noteMarkdown !== undefined) {
        assertString(value.noteMarkdown, `milestones[${index}].noteMarkdown`, schemaName);
    }
    return value;
}
export function validateMilestonesSnapshot(value) {
    const schemaName = 'milestones';
    assertRecord(value, schemaName);
    assertString(value.version, 'version', schemaName);
    assertString(value.generatedAt, 'generatedAt', schemaName);
    assertArray(value.milestones, 'milestones', schemaName);
    return {
        version: value.version,
        generatedAt: value.generatedAt,
        milestones: value.milestones.map((milestone, index) => validateMilestoneRecord(milestone, index))
    };
}
