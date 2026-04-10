import Database from 'better-sqlite3'

export interface IndexedDocumentInput {
  documentId: string
  path: string
  title: string
  body: string
  updatedAt: string
}

export interface IndexedAttachmentInput {
  relativePath: string
  absolutePath: string
  name: string
  extension: string
  content: string
  updatedAt: string
}

export interface SearchNodeIndexResult {
  nodeId: string
  documentId: string
  path: string
  title: string
  snippet: string
}

export interface SearchAttachmentIndexResult {
  relativePath: string
  absolutePath: string
  name: string
  extension: string
  snippet: string
}

function withDatabase<T>(databasePath: string, action: (database: Database.Database) => T): T {
  const database = new Database(databasePath)

  try {
    return action(database)
  } finally {
    database.close()
  }
}

function toFtsQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]+/gu, '').trim())
    .filter(Boolean)
    .map((token) => `${token}*`)
    .join(' ')
}

export function initializeDerivedIndexDatabase(databasePath: string): void {
  withDatabase(databasePath, (database) => {
    database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS documents (
        document_id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        node_id UNINDEXED,
        document_id UNINDEXED,
        title,
        body
      );
      CREATE TABLE IF NOT EXISTS attachments (
        relative_path TEXT PRIMARY KEY,
        absolute_path TEXT NOT NULL,
        name TEXT NOT NULL,
        extension TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS attachments_fts USING fts5(
        relative_path UNINDEXED,
        name,
        content
      );
    `)

    const documentColumns = database.prepare(`PRAGMA table_info(documents)`).all() as Array<{ name: string }>
    if (!documentColumns.some((column) => column.name === 'node_id')) {
      database.exec(`ALTER TABLE documents ADD COLUMN node_id TEXT NOT NULL DEFAULT ''`)
    }
  })
}

export function upsertDerivedIndexDocument(
  databasePath: string,
  input: IndexedDocumentInput & { nodeId: string }
): void {
  withDatabase(databasePath, (database) => {
    database
      .prepare(
        `
          INSERT INTO documents (document_id, node_id, path, title, updated_at)
          VALUES (@documentId, @nodeId, @path, @title, @updatedAt)
          ON CONFLICT(document_id) DO UPDATE SET
            node_id = excluded.node_id,
            path = excluded.path,
            title = excluded.title,
            updated_at = excluded.updated_at
        `
      )
      .run(input)

    database.prepare(`DELETE FROM documents_fts WHERE document_id = ?`).run(input.documentId)
    database
      .prepare(`INSERT INTO documents_fts (node_id, document_id, title, body) VALUES (@nodeId, @documentId, @title, @body)`)
      .run(input)
  })
}

export function removeDerivedIndexDocument(databasePath: string, documentId: string): void {
  withDatabase(databasePath, (database) => {
    database.prepare(`DELETE FROM documents WHERE document_id = ?`).run(documentId)
    database.prepare(`DELETE FROM documents_fts WHERE document_id = ?`).run(documentId)
  })
}

export function upsertDerivedIndexAttachment(databasePath: string, input: IndexedAttachmentInput): void {
  withDatabase(databasePath, (database) => {
    database
      .prepare(
        `
          INSERT INTO attachments (relative_path, absolute_path, name, extension, updated_at)
          VALUES (@relativePath, @absolutePath, @name, @extension, @updatedAt)
          ON CONFLICT(relative_path) DO UPDATE SET
            absolute_path = excluded.absolute_path,
            name = excluded.name,
            extension = excluded.extension,
            updated_at = excluded.updated_at
        `
      )
      .run(input)

    database.prepare(`DELETE FROM attachments_fts WHERE relative_path = ?`).run(input.relativePath)
    database
      .prepare(`INSERT INTO attachments_fts (relative_path, name, content) VALUES (@relativePath, @name, @content)`)
      .run(input)
  })
}

export function removeDerivedIndexAttachment(databasePath: string, relativePath: string): void {
  withDatabase(databasePath, (database) => {
    database.prepare(`DELETE FROM attachments WHERE relative_path = ?`).run(relativePath)
    database.prepare(`DELETE FROM attachments_fts WHERE relative_path = ?`).run(relativePath)
  })
}

export function searchDerivedIndex(
  databasePath: string,
  query: string,
  limit = 8
): {
  nodes: SearchNodeIndexResult[]
  content: SearchNodeIndexResult[]
  attachments: SearchAttachmentIndexResult[]
} {
  if (!query.trim()) {
    return {
      nodes: [],
      content: [],
      attachments: []
    }
  }

  return withDatabase(databasePath, (database) => {
    const ftsQuery = toFtsQuery(query)
    if (!ftsQuery) {
      return {
        nodes: [],
        content: [],
        attachments: []
      }
    }

    const titleStatement = database.prepare(
      `
        SELECT
          documents.node_id AS nodeId,
          documents.document_id AS documentId,
          documents.path AS path,
          documents.title AS title,
          documents.title AS snippet
        FROM documents
        WHERE lower(documents.title) LIKE lower(?)
        ORDER BY documents.updated_at DESC
        LIMIT ?
      `
    )

    const contentStatement = database.prepare(
      `
        SELECT
          documents.node_id AS nodeId,
          documents.document_id AS documentId,
          documents.path AS path,
          documents.title AS title,
          snippet(documents_fts, 2, '<mark>', '</mark>', '…', 12) AS snippet
        FROM documents_fts
        INNER JOIN documents ON documents.document_id = documents_fts.document_id
        WHERE documents_fts.body MATCH ?
        ORDER BY rank
        LIMIT ?
      `
    )

    const attachmentStatement = database.prepare(
      `
        SELECT
          attachments.relative_path AS relativePath,
          attachments.absolute_path AS absolutePath,
          attachments.name AS name,
          attachments.extension AS extension,
          snippet(attachments_fts, 2, '<mark>', '</mark>', '…', 12) AS snippet
        FROM attachments_fts
        INNER JOIN attachments ON attachments.relative_path = attachments_fts.relative_path
        WHERE attachments_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `
    )

    const safeLimit = Math.max(1, Math.min(limit, 20))

    return {
      nodes: titleStatement.all(`%${query.trim()}%`, safeLimit) as SearchNodeIndexResult[],
      content: contentStatement.all(ftsQuery, safeLimit) as SearchNodeIndexResult[],
      attachments: attachmentStatement.all(ftsQuery, safeLimit) as SearchAttachmentIndexResult[]
    }
  })
}
