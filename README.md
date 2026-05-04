# Pecie

![Pecie icon](apps/desktop/src/renderer/src/asset/Icon.png)

Pecie is a local-first editorial studio for writers, researchers, students, academics, and teams who work on long documents.

It brings writing, structure, research material, citations, project history, and export tools into one desktop workspace. Pecie is designed for serious writing projects that need more than a folder of loose files.

## Why Pecie

Large writing projects are rarely just text. They include outlines, drafts, references, notes, source documents, images, versions, export settings, and decisions made over time.

Pecie keeps that work together in a portable `.pe` project:

- documents and binder structure
- local notes and research material
- attachments and imported sources
- images copied into the project
- citation data and bibliography support
- export profiles and preview settings
- project history, checkpoints, and milestones

Everything is local-first. Pecie does not require a cloud account to create, edit, search, export, or share your work.

## Best For

- Theses and dissertations
- Academic papers
- Books and essays
- Manuals and technical documentation
- Article collections and journal-style projects
- Research-heavy writing with local source material
- Writers who want structure, privacy, and portability

## Writing Workspace

Pecie gives each project a structured writing environment instead of a single flat document.

- Binder navigation for chapters, sections, notes, and support material
- Markdown editor with source, rendered, split, and output-oriented views
- Focus mode and typewriter mode
- Formatting toolbar for common writing actions
- Word count and session feedback
- Project search
- Outliner and corkboard-style views
- Scrivenings-style aggregation for reading multiple sections together
- Integrated guides and tutorials

## Templates

Start from templates built for different editorial contexts:

- Blank project
- Thesis
- Paper
- Book / Essay
- Manual
- Journal
- Article

Templates include an initial binder, writing hub material, export profiles, and local project structure suited to the type of work.

## Research and Attachments

Pecie treats research material as part of the writing project.

- Keep local notes, scratchpads, and source containers beside the manuscript
- Import local attachments
- Preview supported PDF and DOCX material inside the project
- Link research notes to writing targets
- Insert images with alt text and portable project-relative paths
- Keep project-managed media available during preview and export

## History and Recovery

Pecie includes local project history so you can understand how the work changed over time.

- Create checkpoints and milestones
- Review the project timeline
- Compare historical versions
- Restore selected historical text into the current document
- Keep history local to the project

## Citations and Bibliography

Academic writing workflows are built into the project model.

- Local citation library support
- Citation diagnostics
- Citekey suggestions
- Citation profiles
- Bibliography materialization during export
- Academic export profiles

## Export and Preview

Pecie helps you review before producing final output.

- Export preview before final write
- Page boundary markers
- Preview modes for different performance needs
- Core exports through bundled Pandoc
- Markdown, Plain Text, HTML, DOCX, ODT, RTF, EPUB, JATS, and TEI output paths
- PDF profiles with explicit engine availability checks
- Markdown-style PDF when WeasyPrint is available
- LaTeX-oriented PDF workflows as optional advanced capabilities

Pecie bundles the core Pandoc runtime for supported desktop packages, so common export workflows do not require manually installing Pandoc.

## Sharing and Privacy

Pecie is built around local ownership of the project.

- Create local share packages
- Import shared packages as derived projects
- Review privacy impact before sharing packages with history
- Keep work local by default
- Avoid implicit uploads and background addon downloads
- Use isolated desktop boundaries for renderer and IPC access

## Accessibility and Languages

Pecie is designed for sustained writing sessions.

- Keyboard-oriented workflows
- Visible focus states
- Accessible font preference
- UI zoom
- Guided onboarding and recoverable tutorials
- Localized interface in Italian, English, German, Spanish, French, and Portuguese

## For Developers

Pecie is an Electron, React, TypeScript, and Vite application organized as an npm workspace monorepo.

```text
apps/
  desktop/          Electron desktop application
packages/
  application/      application contracts and IPC typing
  domain/           templates, export profiles, runtime capability policy
  infrastructure/   filesystem, IPC handlers, history, export, preview, privacy, sharing
  schemas/          JSON schemas and generated shared TypeScript types
  ui/               shared UI primitives and views
scripts/            build, type generation, runtime preparation, packaging helpers
```

Requirements:

- Node.js 20
- npm 10+

```bash
npm ci
npm run dev
```

Validation:

```bash
npm run generate:types
npm run lint
npm run typecheck
npm run test:unit
```
