# Pecie

![Pecie icon](apps/desktop/src/renderer/src/asset/Icon.png)

Pecie is a local-first editorial studio for writers, researchers, students, academics, journalists, and writing teams who work on long documents.

It brings writing, structure, research material, citations, visual blocks, project history, privacy controls, sharing, and export tools into one desktop workspace. Pecie is designed for serious writing projects that need more than a folder of loose files.

## What Pecie Is For

Large writing projects are rarely just text. They include outlines, drafts, references, notes, source documents, images, versions, export settings, and decisions made over time.

Pecie keeps that work together in a portable `.pe` project:

- structured documents and binder organization
- local notes, scratchpads, and research material
- imported sources and readable attachments
- images copied into the project with portable links
- visual blocks such as diagrams, mind maps, and charts
- citation data and bibliography support
- export profiles, previews, and output settings
- local history, checkpoints, and milestones
- privacy and sharing choices that remain visible before data leaves the project

Everything is local-first. Pecie does not require a cloud account to create, edit, search, preview, export, or share your work.

## Best For

- Theses and dissertations
- Academic papers
- Books and essays
- Manuals and technical documentation
- Article collections and journal-style projects
- Research-heavy writing with local source material
- Editorial teams who need offline multi-author attribution
- Writers who want structure, privacy, and portability

## Getting Started

On first launch, Pecie guides you through the essentials:

- choose a local workspace folder, with `Documents/Pecie` offered by default
- create a local author profile with name, role, optional institution, optional department, and preferred language
- choose interface language, theme, font preference, and UI zoom
- start a new project first, with opening existing projects available as a secondary action

The app keeps these settings locally and reuses them when creating new projects.

## Project Templates

Start from templates built for different editorial contexts:

- Blank project
- Thesis
- Paper
- Book / Essay
- Manual
- Journal
- Article

Templates include an initial binder, writing hub material, export profiles, and local project structure suited to the type of work.

## Writing Workspace

Pecie gives each project a structured writing environment instead of a single flat document.

- Binder navigation for chapters, sections, writing pages, notes, and support material
- Markdown editor with source, rendered, split, and output-oriented views
- Focus mode and typewriter mode
- Formatting toolbar for headings, emphasis, lists, quotes, links, tables, citations, and footnotes
- Integrated Markdown guide
- Word count and writing continuity feedback
- Global project search across titles, Markdown content, imported filenames, and indexed readable documents
- Outliner and corkboard-style views
- Scrivenings-style aggregation for reading multiple sections together
- Integrated guides, tutorials, and recoverable onboarding

## Research and Attachments

Pecie treats research material as part of the writing project.

- Keep local notes, scratchpads, references, and source containers beside the manuscript
- Import local attachments up to large file sizes without implicit upload
- Preview supported PDF, DOCX, ODT, RTF, EPUB, LaTeX, JATS, TEI, Markdown, and plain-text material inside the project when readable
- Copy text from readable source documents without leaving the workspace
- Drag notes and scratchpads into writing documents when they become manuscript content
- Insert images from the toolbar with preview, alt text, and confirmation
- Store project-managed images inside the `.pe` project with portable relative paths

## Visual Blocks

Pecie supports visual material directly in the Markdown workflow.

- Insert diagrams, mind maps, and charts from the editor toolbar
- Edit visual blocks as readable Markdown-friendly fenced blocks
- Preview visual blocks locally without remote services
- Export visual blocks through local generated assets when the chosen output format needs them

## History and Recovery

Pecie includes local project history so you can understand how the work changed over time.

- Create checkpoints and milestones
- Review a grouped timeline of project activity
- Compare historical versions
- Restore selected historical text into the current document
- Keep every restore traceable in project history
- Keep history local to the project

## Multi-Author Work

Pecie supports offline contribution tracking inside the project.

- Store a local author registry in the `.pe` project
- Add contributors when they actually modify project content
- Track document-level and section-level contribution data
- Show contribution distribution and contributor ranking in the workspace
- Include relevant author metadata during export

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
- Page boundary markers in the writing flow
- Preview modes for different performance needs
- Core exports through bundled Pandoc
- Markdown, Plain Text, HTML, DOCX, ODT, RTF, EPUB, JATS XML, and TEI XML output paths
- PDF profiles with explicit engine availability checks
- Markdown-style PDF through bundled WeasyPrint on supported desktop packages
- LaTeX-oriented PDF workflows as optional advanced capabilities
- Export logs and clear diagnostics when a profile is unavailable

Pecie bundles Pandoc and the WeasyPrint sidecar for supported desktop packages, so common document exports and Markdown-style PDF do not require manual runtime installs.

## Sharing and Privacy

Pecie is built around local ownership of the project.

- Create local share packages
- Import shared packages as derived projects
- Review privacy impact before sharing packages with history
- Inspect local data through the Data & Privacy dashboard
- Run local maintenance for cache, previews, exports, and obsolete runtime files
- Keep work local by default
- Avoid implicit uploads and background addon downloads
- Use isolated desktop boundaries for renderer and system access

## Advanced Controls and Extensions

Pecie includes advanced controls for users who want deeper visibility into the local workspace.

- Expert mode with explicit disclosure before advanced capabilities are shown
- Export runtime status for bundled and optional capabilities
- Local plugin manager for plugins stored in the Pecie data folder
- Manifest validation before a plugin is listed as usable
- Plugin enable and disable controls
- Declared plugin permissions and hook subscriptions shown before use
- Sandboxed plugin execution with timeout, serializable results, and isolated failures

Plugin support is local-first: Pecie does not install remote plugins automatically, and plugins do not receive unrestricted filesystem access.

## Accessibility and Languages

Pecie is designed for sustained writing sessions.

- Keyboard-oriented workflows
- Visible focus states
- Accessible font preference
- UI zoom at common reading sizes
- Light and dark themes
- Reduced-motion and high-contrast support
- Guided onboarding and recoverable tutorials
- Localized interface in Italian, English, German, Spanish, French, and Portuguese

## Local-First Principles

Pecie keeps the core writing workflow on the user device.

- Projects are stored as portable `.pe` folders
- Project content, source material, media, citations, history, and export settings remain under local user control
- Search and indexing are local
- Exports are produced locally
- Sharing is explicit and reviewable
- Plugins are local, permissioned, and sandboxed
