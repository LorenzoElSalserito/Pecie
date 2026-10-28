# Pecie Accessibility Audit Matrix

**Version:** 2026-10-16 (Fase 3 UI restructuring update; previous 2026-04-29)  
**Scope:** Fase 4.3 baseline audit for desktop renderer flows.  
**Standard target:** WCAG 2.2 AA, keyboard-first operation, screen-reader readable structure, reduced-motion respect, high-contrast readiness.

## Audit Legend

- `pass`: verified by current implementation or automated regression.
- `partial`: implemented but needs manual assistive-tech pass.
- `todo`: still requires implementation or manual verification.
- `blocked`: cannot be verified in the current environment.

## Screen Matrix

| Surface | Keyboard | Screen Reader | Contrast | Reduced Motion | Focus Restore | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Launcher | pass | partial | pass | pass | partial | partial | Create-first flow, template radiogroup, icon-only actions as `IconButton` + `Tooltip` (visible on focus), one primary CTA. Semantic token contrast verified by `tokens.test.ts` (110 pairs, AA). Manual SR pass still queued. |
| Project creation wizard | pass | partial | pass | pass | partial | partial | Segmented progress, inline validation (`role=alert`), step transitions under reduced-motion guard, celebration state. Manual SR pass queued. |
| Binder tree | pass | partial | partial | pass | n/a | partial | Roving treeitem focus, tree semantics, keyboard navigation present. Manual SR naming pass remains. |
| Editor and toolbar | partial | partial | partial | pass | n/a | partial | Toolbar has role/name; editor Monaco announcements need manual verification. |
| Timeline | partial | partial | partial | pass | n/a | partial | Groups and actions are readable; diff/restore flows need manual pass. |
| Export dialog | partial | partial | partial | pass | partial | partial | Dialog semantics and runtime status messages present; verify focus restore with AT. |
| Settings dialog | partial | partial | partial | pass | partial | partial | Preview and form controls present; cancellation/revert flow needs manual keyboard pass. |
| Privacy dashboard | todo | todo | todo | pass | todo | todo | Planned for the dedicated data/privacy surface. |
| Share package UI | partial | partial | partial | pass | partial | partial | Includes warnings/status messages; milestone selection requires manual SR pass. |
| Tutorial engine | pass | partial | pass | pass | pass | partial | Non-modal coach mark (`role=dialog`, `aria-modal=false`): spotlight on the real control, arrows/Escape on the card, focus stays on the control a step focuses, launcher remains usable. E2E `phase4-tutorials` certifies the first-launch flow. |

## Pattern Matrix

| Pattern | Requirement | Status | Current Check |
| --- | --- | --- | --- |
| Dialogs | Focus trap, Escape close, overlay dismiss, title/name, restore focus | partial | React Aria modal foundation; manual restore-focus pass still required per dialog. |
| Tablist | One tab stop, selected tab tabbable, inactive tabs skipped by Tab | pass | Workspace and editor tablists use roving `tabIndex`. |
| Tree | Arrow navigation, selected item state, no duplicate container tab stop | pass | Binder tree delegates keyboard events from focused treeitems. |
| Toolbar | Named toolbar, named buttons, visible focus | partial | Markdown toolbar is named; visible focus covered by shared CSS tokens. |
| Live regions | Save/export/search status announced without flooding | partial | Status regions exist; duplication/noise needs manual SR pass. |
| Icon-only controls | Accessible name independent from icon glyph | pass | Collapsed binder controls and workspace toggles expose labels. |
| Reduced motion | Nonessential animation disabled under user preference | pass | Global CSS and tutorial scroll behavior use reduced-motion branch. |
| High contrast | Stronger borders/focus/text in `prefers-contrast: more` | partial | Token layer exists; visual audit still required. |

## PRD §13.4 Screen Checklist (Fase 3)

| Screen | Title present | Tab order | Visible focus | Accessible names | Errors as text | No mouse needed | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Launcher | pass (`h1` hero + section headings) | pass (hero → actions → composer → side) | pass (3px focus ring token) | pass (`aria-label` on every icon action, radiogroup named) | pass (`Banner tone="error"`, `role=alert`) | pass | `phase5-project-templates`, `phase4-tutorials` e2e; `primitives.test.tsx` |
| Setup wizard | pass (step `h2`, eyebrow) | pass (progress → fields → actions) | pass | pass (fields labelled, radios in fieldset) | pass (`authorNameRequired` inline) | pass | `phase6-typography-icons` first-run test |

## Automated axe-core audit (Fase 6)

`packages/testing/tests/phase7-a11y-audit.spec.ts` runs axe-core (WCAG 2.x A/AA + best practice, Monaco excluded) on launcher, wizard, workspace, settings, export, guide center and the timeline/research/outliner/corkboard views in light and dark. Report: `docs/a11y/audit/axe-report.json`. Gate: zero serious/critical.

| Remaining moderate finding | Where | Decision |
| --- | --- | --- |
| `page-has-heading-one` | Workspace (document title is an editable field, not an `h1`) | Accepted; revisit when the editor title becomes a heading with an editable region. |
| `heading-order` (`h4` after `h2`) | Guide center cards | Accepted; card titles will become `h3` with the guide redesign (G3–G8). |
| `landmark-complementary-is-top-level` | Timeline and research sidebars (`aside` inside `main`) | Accepted; convert to `section` with `aria-label` in the views restyle. |

## Manual Pass Queue

1. NVDA on Linux/Windows: launcher, project creation, binder navigation, editor toolbar.
2. VoiceOver on macOS: dialog focus trap/restore, export preview, settings revert.
3. Keyboard-only: open/close every modal from its trigger and verify focus returns to the trigger.
4. Contrast inspection: light/dark/high-contrast for secondary text, ghost buttons, disabled states.
5. Tutorial run: resume, replay, reset, skip, and completed states with screen reader announcements.

## Residual Risks

- Monaco editor accessibility depends on embedded editor behavior and must be checked with real assistive tech.
- Electron focus restore can differ by platform, so dialog checks must be repeated on Linux, Windows and macOS.
- Current automated tests cover tutorial runner state and performance, but not full DOM accessibility assertions.
