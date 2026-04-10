import type {
  AuthorProfile,
  ProjectAuthorshipStat,
  ProjectContributor,
  ProjectMetadata,
  SupportedLocale
} from '@pecie/schemas'

export type NormalizedProjectMetadata = ProjectMetadata & {
  authors: ProjectContributor[]
  authorshipStats: ProjectAuthorshipStat[]
  primaryAuthorId?: string
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function contributorFingerprint(input: {
  name: string
  role: string
  institutionName?: string
  department?: string
  preferredLanguage?: string
}): string {
  return [
    input.name.trim().toLowerCase(),
    input.role.trim().toLowerCase(),
    input.institutionName?.trim().toLowerCase() ?? '',
    input.department?.trim().toLowerCase() ?? '',
    input.preferredLanguage?.trim().toLowerCase() ?? ''
  ].join('::')
}

function createContributorId(name: string, existingAuthors: ProjectContributor[]): string {
  const baseId = `author-${slugify(name) || 'contributor'}`
  let candidate = baseId
  let suffix = 1

  while (existingAuthors.some((author) => author.id === candidate)) {
    candidate = `${baseId}-${suffix}`
    suffix += 1
  }

  return candidate
}

export function createProjectContributor(profile: AuthorProfile, timestamp: string, id?: string): ProjectContributor {
  return {
    id: id ?? `author-${slugify(profile.name) || 'primary'}`,
    name: profile.name,
    role: profile.role,
    institutionName: profile.institutionName || undefined,
    department: profile.department || undefined,
    preferredLanguage: profile.preferredLanguage,
    addedAt: timestamp,
    lastModifiedAt: timestamp
  }
}

export function normalizeProjectMetadata(project: ProjectMetadata, fallbackTimestamp: string): NormalizedProjectMetadata {
  if (Array.isArray(project.authors) && project.authors.length > 0) {
    return {
      ...project,
      authors: project.authors,
      authorshipStats: project.authorshipStats ?? [],
      primaryAuthorId: project.primaryAuthorId
    }
  }

  return {
    ...project,
    authors: [
      {
        id: 'author-primary',
        name: project.author.name,
        role: project.author.role,
        institutionName: project.institution?.name,
        department: project.institution?.department,
        preferredLanguage: project.defaultLanguage as SupportedLocale,
        addedAt: fallbackTimestamp,
        lastModifiedAt: fallbackTimestamp
      }
    ],
    authorshipStats: project.authorshipStats ?? [],
    primaryAuthorId: project.primaryAuthorId ?? 'author-primary'
  }
}

export function syncProjectContributor(
  project: ProjectMetadata,
  profile: AuthorProfile,
  timestamp: string
): {
  contributor: ProjectContributor
  project: NormalizedProjectMetadata
  appended: boolean
} {
  const normalizedProject = normalizeProjectMetadata(project, timestamp)
  const fingerprint = contributorFingerprint(profile)
  const existingContributor = normalizedProject.authors.find(
    (author) =>
      contributorFingerprint({
        name: author.name,
        role: author.role,
        institutionName: author.institutionName,
        department: author.department,
        preferredLanguage: author.preferredLanguage
      }) === fingerprint
  )

  if (existingContributor) {
    const updatedContributor = {
      ...existingContributor,
      lastModifiedAt: timestamp
    }

    return {
      contributor: updatedContributor,
      project: {
        ...normalizedProject,
        authors: normalizedProject.authors.map((author) => (author.id === existingContributor.id ? updatedContributor : author))
      },
      appended: false
    }
  }

  const appendedContributor = createProjectContributor(
    profile,
    timestamp,
    createContributorId(profile.name, normalizedProject.authors)
  )

  return {
    contributor: appendedContributor,
    project: {
      ...normalizedProject,
      authors: [...normalizedProject.authors, appendedContributor]
    },
    appended: true
  }
}

export function applyAuthorshipStats(
  project: ProjectMetadata,
  stats: ProjectAuthorshipStat[]
): NormalizedProjectMetadata {
  const normalizedProject = normalizeProjectMetadata(project, new Date().toISOString())
  const leadingStat = [...stats].sort((left, right) => right.wordCount - left.wordCount)[0]
  const leadingAuthor = normalizedProject.authors.find((author) => author.id === leadingStat?.authorId)

  return {
    ...normalizedProject,
    primaryAuthorId: leadingAuthor?.id ?? normalizedProject.primaryAuthorId ?? normalizedProject.authors[0]?.id,
    author: leadingAuthor
      ? {
          name: leadingAuthor.name,
          role: leadingAuthor.role
        }
      : normalizedProject.author,
    authorshipStats: stats
  }
}
