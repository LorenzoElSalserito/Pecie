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
    if (value.schemaUris.exportProfile === undefined) {
        value.schemaUris.exportProfile = 'schemas/export-profile.schema.json';
    }
    if (value.schemaUris.previewProfileBinding === undefined) {
        value.schemaUris.previewProfileBinding = 'schemas/preview-profile-binding.schema.json';
    }
    if (value.schemaUris.paginatedPreview === undefined) {
        value.schemaUris.paginatedPreview = 'schemas/paginated-preview.schema.json';
    }
    if (value.schemaUris.pageBreakMap === undefined) {
        value.schemaUris.pageBreakMap = 'schemas/page-break-map.schema.json';
    }
    if (value.schemaUris.appPreviewSettings === undefined) {
        value.schemaUris.appPreviewSettings = 'schemas/app-preview-settings.schema.json';
    }
    if (value.schemaUris.citationProfile === undefined) {
        value.schemaUris.citationProfile = 'schemas/citation-profile.schema.json';
    }
    if (value.schemaUris.citationLibrary === undefined) {
        value.schemaUris.citationLibrary = 'schemas/citation-library.schema.json';
    }
    if (value.schemaUris.researchNote === undefined) {
        value.schemaUris.researchNote = 'schemas/research-note.schema.json';
    }
    if (value.schemaUris.researchLinkMap === undefined) {
        value.schemaUris.researchLinkMap = 'schemas/research-link-map.schema.json';
    }
    if (value.schemaUris.pdfLibrary === undefined) {
        value.schemaUris.pdfLibrary = 'schemas/pdf-library.schema.json';
    }
    if (value.schemaUris.sharePackageManifest === undefined) {
        value.schemaUris.sharePackageManifest = 'schemas/share-package-manifest.schema.json';
    }
    if (value.schemaUris.privacyInventory === undefined) {
        value.schemaUris.privacyInventory = 'schemas/privacy-inventory.schema.json';
    }
    assertString(value.schemaUris.exportProfile, 'schemaUris.exportProfile', schemaName);
    assertString(value.schemaUris.previewProfileBinding, 'schemaUris.previewProfileBinding', schemaName);
    assertString(value.schemaUris.paginatedPreview, 'schemaUris.paginatedPreview', schemaName);
    assertString(value.schemaUris.pageBreakMap, 'schemaUris.pageBreakMap', schemaName);
    assertString(value.schemaUris.appPreviewSettings, 'schemaUris.appPreviewSettings', schemaName);
    assertString(value.schemaUris.citationProfile, 'schemaUris.citationProfile', schemaName);
    assertString(value.schemaUris.citationLibrary, 'schemaUris.citationLibrary', schemaName);
    assertString(value.schemaUris.researchNote, 'schemaUris.researchNote', schemaName);
    assertString(value.schemaUris.researchLinkMap, 'schemaUris.researchLinkMap', schemaName);
    assertString(value.schemaUris.pdfLibrary, 'schemaUris.pdfLibrary', schemaName);
    assertString(value.schemaUris.sharePackageManifest, 'schemaUris.sharePackageManifest', schemaName);
    assertString(value.schemaUris.privacyInventory, 'schemaUris.privacyInventory', schemaName);
    return value;
}
export function validateProjectMetadata(value) {
    const schemaName = 'project';
    assertRecord(value, schemaName);
    assertString(value.title, 'title', schemaName);
    assertRecord(value.author, schemaName);
    assertString(value.author.name, 'author.name', schemaName);
    assertString(value.author.role, 'author.role', schemaName);
    if (value.defaultCitationProfileId !== undefined) {
        assertString(value.defaultCitationProfileId, 'defaultCitationProfileId', schemaName);
    }
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
export function validateExportProfile(value) {
    const schemaName = 'exportProfile';
    assertRecord(value, schemaName);
    assertString(value.id, 'id', schemaName);
    if (value.schemaVersion !== 1) {
        throw new SchemaValidationError(schemaName, 'Field "schemaVersion" must be 1');
    }
    assertString(value.label, 'label', schemaName);
    assertString(value.format, 'format', schemaName);
    assertRecord(value.include, schemaName);
    if (value.include.binderRoot !== undefined) {
        assertString(value.include.binderRoot, 'include.binderRoot', schemaName);
    }
    if (value.include.excludeTags !== undefined) {
        assertArray(value.include.excludeTags, 'include.excludeTags', schemaName);
        value.include.excludeTags.forEach((tag, index) => assertString(tag, `include.excludeTags[${index}]`, schemaName));
    }
    if (value.include.excludeFrontmatter !== undefined) {
        assertRecord(value.include.excludeFrontmatter, schemaName);
        for (const [key, fieldValue] of Object.entries(value.include.excludeFrontmatter)) {
            if (typeof fieldValue !== 'string' && typeof fieldValue !== 'boolean') {
                throw new SchemaValidationError(schemaName, `Field "include.excludeFrontmatter.${key}" must be a string or boolean`);
            }
        }
    }
    if (value.engine !== undefined) {
        assertString(value.engine, 'engine', schemaName);
    }
    if (value.template !== undefined) {
        assertString(value.template, 'template', schemaName);
    }
    if (value.theme !== undefined) {
        assertString(value.theme, 'theme', schemaName);
    }
    if (value.citationProfile !== undefined) {
        assertString(value.citationProfile, 'citationProfile', schemaName);
    }
    if (value.toc !== undefined) {
        assertBoolean(value.toc, 'toc', schemaName);
    }
    if (value.pageNumbering !== undefined) {
        assertString(value.pageNumbering, 'pageNumbering', schemaName);
    }
    assertRecord(value.output, schemaName);
    assertString(value.output.filenameFrom, 'output.filenameFrom', schemaName);
    assertString(value.output.directory, 'output.directory', schemaName);
    return value;
}
export function validatePreviewProfileBinding(value) {
    const schemaName = 'previewProfileBinding';
    assertRecord(value, schemaName);
    assertString(value.projectId, 'projectId', schemaName);
    assertString(value.profileId, 'profileId', schemaName);
    assertString(value.format, 'format', schemaName);
    assertBoolean(value.supportsPageMarkers, 'supportsPageMarkers', schemaName);
    assertString(value.previewKind, 'previewKind', schemaName);
    return value;
}
export function validatePaginatedPreview(value) {
    const schemaName = 'paginatedPreview';
    assertRecord(value, schemaName);
    assertString(value.profileId, 'profileId', schemaName);
    assertString(value.format, 'format', schemaName);
    assertString(value.mode, 'mode', schemaName);
    assertBoolean(value.paginated, 'paginated', schemaName);
    if (typeof value.totalPages !== 'number') {
        throw new SchemaValidationError(schemaName, 'Field "totalPages" must be a number');
    }
    assertArray(value.pages, 'pages', schemaName);
    value.pages.forEach((page, index) => {
        assertRecord(page, schemaName);
        if (typeof page.pageNumber !== 'number') {
            throw new SchemaValidationError(schemaName, `Field "pages[${index}].pageNumber" must be a number`);
        }
        assertString(page.previewAssetRelPath, `pages[${index}].previewAssetRelPath`, schemaName);
        if (typeof page.sourceOffsetStart !== 'number' || typeof page.sourceOffsetEnd !== 'number') {
            throw new SchemaValidationError(schemaName, `Field "pages[${index}].sourceOffsetStart/End" must be numbers`);
        }
    });
    assertString(value.generatedAt, 'generatedAt', schemaName);
    assertString(value.cacheKey, 'cacheKey', schemaName);
    assertArray(value.warnings, 'warnings', schemaName);
    value.warnings.forEach((warning, index) => assertString(warning, `warnings[${index}]`, schemaName));
    return value;
}
export function validatePageBreakMap(value) {
    const schemaName = 'pageBreakMap';
    assertRecord(value, schemaName);
    assertString(value.profileId, 'profileId', schemaName);
    assertString(value.format, 'format', schemaName);
    assertString(value.mode, 'mode', schemaName);
    assertString(value.pipeline, 'pipeline', schemaName);
    if (typeof value.totalEstimatedPages !== 'number') {
        throw new SchemaValidationError(schemaName, 'Field "totalEstimatedPages" must be a number');
    }
    assertArray(value.breaks, 'breaks', schemaName);
    value.breaks.forEach((entry, index) => {
        assertRecord(entry, schemaName);
        if (typeof entry.sourceOffset !== 'number' || typeof entry.estimatedPageNumber !== 'number') {
            throw new SchemaValidationError(schemaName, `Field "breaks[${index}]" must contain numbers`);
        }
    });
    assertString(value.computedAt, 'computedAt', schemaName);
    assertString(value.cacheKey, 'cacheKey', schemaName);
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
function validateCitationAuthor(value, path, schemaName) {
    assertRecord(value, schemaName);
    if (value.family !== undefined) {
        assertString(value.family, `${path}.family`, schemaName);
    }
    if (value.given !== undefined) {
        assertString(value.given, `${path}.given`, schemaName);
    }
    if (value.literal !== undefined) {
        assertString(value.literal, `${path}.literal`, schemaName);
    }
    return value;
}
export function validateCitationProfile(value) {
    const schemaName = 'citationProfile';
    assertRecord(value, schemaName);
    assertString(value.id, 'id', schemaName);
    if (value.schemaVersion !== 1) {
        throw new SchemaValidationError(schemaName, 'Field "schemaVersion" must be 1');
    }
    assertString(value.label, 'label', schemaName);
    assertArray(value.bibliographySources, 'bibliographySources', schemaName);
    value.bibliographySources.forEach((source, index) => assertString(source, `bibliographySources[${index}]`, schemaName));
    assertString(value.citationStyle, 'citationStyle', schemaName);
    assertString(value.locale, 'locale', schemaName);
    assertBoolean(value.linkCitations, 'linkCitations', schemaName);
    assertBoolean(value.suppressBibliography, 'suppressBibliography', schemaName);
    if (value.bibliographyTitle !== undefined) {
        assertRecord(value.bibliographyTitle, schemaName);
        for (const [locale, label] of Object.entries(value.bibliographyTitle)) {
            assertString(label, `bibliographyTitle.${locale}`, schemaName);
        }
    }
    return value;
}
function validateCitationLibraryEntry(value, index) {
    const schemaName = 'citationLibrary';
    assertRecord(value, schemaName);
    assertString(value.citeKey, `entries[${index}].citeKey`, schemaName);
    assertString(value.sourcePath, `entries[${index}].sourcePath`, schemaName);
    assertString(value.sourceFormat, `entries[${index}].sourceFormat`, schemaName);
    assertString(value.title, `entries[${index}].title`, schemaName);
    assertArray(value.authors, `entries[${index}].authors`, schemaName);
    value.authors.forEach((author, authorIndex) => validateCitationAuthor(author, `entries[${index}].authors[${authorIndex}]`, schemaName));
    assertString(value.authorsShort, `entries[${index}].authorsShort`, schemaName);
    if (value.year !== undefined && typeof value.year !== 'number') {
        throw new SchemaValidationError(schemaName, `Field "entries[${index}].year" must be a number`);
    }
    if (value.containerTitle !== undefined) {
        assertString(value.containerTitle, `entries[${index}].containerTitle`, schemaName);
    }
    return value;
}
function validateCitationLibrarySource(value, index) {
    const schemaName = 'citationLibrary';
    assertRecord(value, schemaName);
    assertString(value.path, `sources[${index}].path`, schemaName);
    assertString(value.format, `sources[${index}].format`, schemaName);
    if (typeof value.entryCount !== 'number') {
        throw new SchemaValidationError(schemaName, `Field "sources[${index}].entryCount" must be a number`);
    }
    return value;
}
function validateCitationLibraryDiagnostic(value, index) {
    const schemaName = 'citationLibrary';
    assertRecord(value, schemaName);
    assertString(value.sourcePath, `diagnostics[${index}].sourcePath`, schemaName);
    assertString(value.severity, `diagnostics[${index}].severity`, schemaName);
    assertString(value.message, `diagnostics[${index}].message`, schemaName);
    return value;
}
export function validateCitationLibrary(value) {
    const schemaName = 'citationLibrary';
    assertRecord(value, schemaName);
    assertString(value.version, 'version', schemaName);
    assertString(value.generatedAt, 'generatedAt', schemaName);
    const profile = validateCitationProfile(value.profile);
    assertArray(value.entries, 'entries', schemaName);
    assertArray(value.sources, 'sources', schemaName);
    assertArray(value.diagnostics, 'diagnostics', schemaName);
    return {
        version: value.version,
        generatedAt: value.generatedAt,
        profile,
        entries: value.entries.map((entry, index) => validateCitationLibraryEntry(entry, index)),
        sources: value.sources.map((source, index) => validateCitationLibrarySource(source, index)),
        diagnostics: value.diagnostics.map((diagnostic, index) => validateCitationLibraryDiagnostic(diagnostic, index))
    };
}
export function validateResearchNote(value) {
    const schemaName = 'researchNote';
    assertRecord(value, schemaName);
    assertString(value.id, 'id', schemaName);
    assertString(value.title, 'title', schemaName);
    assertString(value.kind, 'kind', schemaName);
    assertString(value.path, 'path', schemaName);
    if (value.includeInExport !== false) {
        throw new SchemaValidationError(schemaName, 'Field "includeInExport" must be false');
    }
    assertString(value.createdAt, 'createdAt', schemaName);
    assertString(value.updatedAt, 'updatedAt', schemaName);
    assertString(value.body, 'body', schemaName);
    return value;
}
function validatePdfLibraryItem(value, index) {
    const schemaName = 'pdfLibrary';
    assertRecord(value, schemaName);
    assertString(value.id, `items[${index}].id`, schemaName);
    assertString(value.relativePath, `items[${index}].relativePath`, schemaName);
    assertString(value.originalFilename, `items[${index}].originalFilename`, schemaName);
    assertString(value.displayName, `items[${index}].displayName`, schemaName);
    if (value.mimeType !== 'application/pdf') {
        throw new SchemaValidationError(schemaName, `Field "items[${index}].mimeType" must be application/pdf`);
    }
    if (typeof value.byteSize !== 'number') {
        throw new SchemaValidationError(schemaName, `Field "items[${index}].byteSize" must be a number`);
    }
    assertString(value.sha256, `items[${index}].sha256`, schemaName);
    assertString(value.importedAt, `items[${index}].importedAt`, schemaName);
    return value;
}
export function validatePdfLibrary(value) {
    const schemaName = 'pdfLibrary';
    assertRecord(value, schemaName);
    assertString(value.version, 'version', schemaName);
    assertString(value.generatedAt, 'generatedAt', schemaName);
    assertArray(value.items, 'items', schemaName);
    return {
        version: value.version,
        generatedAt: value.generatedAt,
        items: value.items.map((item, index) => validatePdfLibraryItem(item, index))
    };
}
function validateResearchLinkRecord(value, index) {
    const schemaName = 'researchLinkMap';
    assertRecord(value, schemaName);
    assertString(value.id, `links[${index}].id`, schemaName);
    assertString(value.sourceType, `links[${index}].sourceType`, schemaName);
    assertString(value.sourceId, `links[${index}].sourceId`, schemaName);
    assertString(value.targetType, `links[${index}].targetType`, schemaName);
    assertString(value.targetId, `links[${index}].targetId`, schemaName);
    assertString(value.relation, `links[${index}].relation`, schemaName);
    assertString(value.createdAt, `links[${index}].createdAt`, schemaName);
    return value;
}
export function validateResearchLinkMap(value) {
    const schemaName = 'researchLinkMap';
    assertRecord(value, schemaName);
    assertString(value.version, 'version', schemaName);
    assertString(value.generatedAt, 'generatedAt', schemaName);
    assertArray(value.links, 'links', schemaName);
    return {
        version: value.version,
        generatedAt: value.generatedAt,
        links: value.links.map((link, index) => validateResearchLinkRecord(link, index))
    };
}
function validateSharePrivacyWarning(value, index) {
    const schemaName = 'sharePackageManifest';
    assertRecord(value, schemaName);
    assertString(value.code, `privacyWarnings[${index}].code`, schemaName);
    assertString(value.severity, `privacyWarnings[${index}].severity`, schemaName);
    return value;
}
export function validateSharePackageManifest(value) {
    const schemaName = 'sharePackageManifest';
    assertRecord(value, schemaName);
    assertString(value.sharePackageVersion, 'sharePackageVersion', schemaName);
    assertString(value.projectId, 'projectId', schemaName);
    assertString(value.projectTitle, 'projectTitle', schemaName);
    assertString(value.createdAt, 'createdAt', schemaName);
    assertString(value.include, 'include', schemaName);
    assertArray(value.selectedMilestoneIds, 'selectedMilestoneIds', schemaName);
    value.selectedMilestoneIds.forEach((id, index) => assertString(id, `selectedMilestoneIds[${index}]`, schemaName));
    assertArray(value.privacyWarnings, 'privacyWarnings', schemaName);
    assertArray(value.excludedPaths, 'excludedPaths', schemaName);
    value.excludedPaths.forEach((item, index) => assertString(item, `excludedPaths[${index}]`, schemaName));
    if (value.gitBundlePath !== undefined) {
        assertString(value.gitBundlePath, 'gitBundlePath', schemaName);
    }
    return {
        sharePackageVersion: value.sharePackageVersion,
        projectId: value.projectId,
        projectTitle: value.projectTitle,
        createdAt: value.createdAt,
        include: value.include,
        selectedMilestoneIds: value.selectedMilestoneIds,
        privacyWarnings: value.privacyWarnings.map((warning, index) => validateSharePrivacyWarning(warning, index)),
        excludedPaths: value.excludedPaths,
        gitBundlePath: value.gitBundlePath
    };
}
export function validatePrivacyInventory(value) {
    const schemaName = 'privacyInventory';
    assertRecord(value, schemaName);
    assertString(value.generatedAt, 'generatedAt', schemaName);
    assertArray(value.items, 'items', schemaName);
    value.items.forEach((item, index) => {
        assertRecord(item, schemaName);
        assertString(item.id, `items[${index}].id`, schemaName);
        assertString(item.category, `items[${index}].category`, schemaName);
        assertString(item.label, `items[${index}].label`, schemaName);
        assertString(item.relativePath, `items[${index}].relativePath`, schemaName);
        if (typeof item.sizeBytes !== 'number' || item.sizeBytes < 0) {
            throw new SchemaValidationError(schemaName, `Field "items[${index}].sizeBytes" must be a non-negative number`);
        }
        assertBoolean(item.containsSensitiveData, `items[${index}].containsSensitiveData`, schemaName);
        assertBoolean(item.deletable, `items[${index}].deletable`, schemaName);
        assertString(item.source, `items[${index}].source`, schemaName);
        if (item.maintenanceAction !== undefined) {
            assertString(item.maintenanceAction, `items[${index}].maintenanceAction`, schemaName);
        }
        if (item.descriptionKey !== undefined) {
            assertString(item.descriptionKey, `items[${index}].descriptionKey`, schemaName);
        }
    });
    assertRecord(value.totals, schemaName);
    for (const field of ['sizeBytes', 'sensitiveItems', 'deletableItems']) {
        if (typeof value.totals[field] !== 'number' || value.totals[field] < 0) {
            throw new SchemaValidationError(schemaName, `Field "totals.${field}" must be a non-negative number`);
        }
    }
    return value;
}
export function validateTutorialScript(value) {
    const schemaName = 'tutorialScript';
    assertRecord(value, schemaName);
    assertString(value.id, 'id', schemaName);
    if (value.schemaVersion !== 1) {
        throw new SchemaValidationError(schemaName, 'Field "schemaVersion" must be 1');
    }
    assertString(value.icon, 'icon', schemaName);
    assertString(value.titleKey, 'titleKey', schemaName);
    assertArray(value.steps, 'steps', schemaName);
    value.steps.forEach((step, index) => {
        assertRecord(step, schemaName);
        assertString(step.id, `steps[${index}].id`, schemaName);
        assertString(step.bodyKey, `steps[${index}].bodyKey`, schemaName);
        assertString(step.targetLabelKey, `steps[${index}].targetLabelKey`, schemaName);
        assertString(step.action, `steps[${index}].action`, schemaName);
        if (step.action !== 'click' &&
            step.action !== 'focus' &&
            step.action !== 'wait-visible' &&
            step.action !== 'wait-document-open' &&
            step.action !== 'switch-workspace-view') {
            throw new SchemaValidationError(schemaName, `Field "steps[${index}].action" has an unsupported tutorial action`);
        }
        assertRecord(step.target, schemaName);
        assertString(step.target.kind, `steps[${index}].target.kind`, schemaName);
        if (step.target.kind !== 'selector' && step.target.kind !== 'tutorial-id' && step.target.kind !== 'workspace-view') {
            throw new SchemaValidationError(schemaName, `Field "steps[${index}].target.kind" has an unsupported target kind`);
        }
        assertString(step.target.value, `steps[${index}].target.value`, schemaName);
        if (step.target.kind === 'selector' && !step.target.value.includes('[data-tutorial-id=')) {
            throw new SchemaValidationError(schemaName, `Field "steps[${index}].target.value" must use a stable data-tutorial-id selector`);
        }
    });
    return value;
}
export function validatePluginManifest(value) {
    const schemaName = 'pluginManifest';
    assertRecord(value, schemaName);
    assertString(value.id, 'id', schemaName);
    if (value.schemaVersion !== 1) {
        throw new SchemaValidationError(schemaName, 'Field "schemaVersion" must be 1');
    }
    assertString(value.label, 'label', schemaName);
    assertString(value.version, 'version', schemaName);
    if (value.description !== undefined) {
        assertString(value.description, 'description', schemaName);
    }
    assertString(value.entryPoint, 'entryPoint', schemaName);
    if (value.entryPoint.includes('..') || value.entryPoint.startsWith('/') || value.entryPoint.startsWith('file:')) {
        throw new SchemaValidationError(schemaName, 'Field "entryPoint" must be a project-local relative path');
    }
    assertArray(value.permissions, 'permissions', schemaName);
    value.permissions.forEach((permission, index) => {
        assertString(permission, `permissions[${index}]`, schemaName);
        if (permission !== 'project.read' &&
            permission !== 'project.write' &&
            permission !== 'export.read' &&
            permission !== 'export.write' &&
            permission !== 'citations.write' &&
            permission !== 'logs.read') {
            throw new SchemaValidationError(schemaName, `Field "permissions[${index}]" has an unsupported plugin permission`);
        }
    });
    assertArray(value.hooks, 'hooks', schemaName);
    value.hooks.forEach((hook, index) => {
        assertString(hook, `hooks[${index}]`, schemaName);
        if (hook !== 'onProjectOpen' &&
            hook !== 'onDocumentSave' &&
            hook !== 'onExportProfileLoaded' &&
            hook !== 'onExportBeforeWrite') {
            throw new SchemaValidationError(schemaName, `Field "hooks[${index}]" has an unsupported plugin hook`);
        }
    });
    if (value.enabledByDefault !== undefined) {
        assertBoolean(value.enabledByDefault, 'enabledByDefault', schemaName);
    }
    return value;
}
