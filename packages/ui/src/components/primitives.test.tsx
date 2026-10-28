import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Chip, ToggleChip } from './chip'
import { Banner, Progress, ToastViewport } from './feedback'
import { IconButton } from './icon-button'
import { Card, EmptyState } from './layout'
import { SearchInput } from './search-input'
import { SegmentedControl } from './segmented-control'
import { Tabs } from './tabs'
import { Checkbox, RadioGroup, Select, TextArea, TextField } from './text-field'
import { Tooltip } from './tooltip'

describe('field primitives', () => {
  it('TextField renders the .field chrome with label, hint and error wiring', () => {
    const markup = renderToStaticMarkup(<TextField error="Required" hint="Short and clear" label="Title" name="title" />)
    expect(markup).toMatch(/^<label class="field"><span>Title<\/span><input aria-describedby="[^"]+-hint [^"]+-error" aria-invalid="true" name="title"\/>/)
    expect(markup).toContain('<span class="field-hint" id=')
    expect(markup).toContain('role="alert"')
    expect(renderToStaticMarkup(<TextField compact label="A" wide />)).toContain('class="field field--compact field--wide"')
    expect(renderToStaticMarkup(<TextField label="A" />)).not.toContain('aria-describedby')
  })

  it('TextArea and Select share the chrome', () => {
    expect(renderToStaticMarkup(<TextArea label="Notes" rows={3} />)).toMatch(/^<label class="field"><span>Notes<\/span><textarea rows="3"><\/textarea><\/label>$/)
    const select = renderToStaticMarkup(
      <Select label="Mode" value="a" onChange={() => undefined}>
        <option value="a">A</option>
      </Select>
    )
    expect(select).toMatch(/^<label class="field"><span>Mode<\/span><select>/)
    expect(select).toContain('<option value="a" selected="">A</option>')
  })

  it('Checkbox wraps the native input in its label', () => {
    expect(renderToStaticMarkup(<Checkbox checked label="Expert mode" onChange={() => undefined} />)).toBe(
      '<label class="checkbox-field"><input type="checkbox" checked=""/><span>Expert mode</span></label>'
    )
  })

  it('RadioGroup is a fieldset of native radios with one checked option', () => {
    const markup = renderToStaticMarkup(
      <RadioGroup label="Theme" name="theme" onChange={() => undefined} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark', description: 'Night' }]} value="dark" />
    )
    expect(markup).toMatch(/^<fieldset class="field radio-group"><legend>Theme<\/legend>/)
    expect(markup.match(/type="radio"/g)).toHaveLength(2)
    expect(markup).toContain('radio-group__option radio-group__option--checked')
    expect(markup).toContain('<small>Night</small>')
  })
})

describe('chips, tabs and controls', () => {
  it('Chip renders counts and toned status pills', () => {
    expect(renderToStaticMarkup(<Chip>3</Chip>)).toBe('<span class="count-chip">3</span>')
    expect(renderToStaticMarkup(<Chip kind="status" tone="warning">Draft</Chip>)).toBe('<span class="status-pill status-pill--warning">Draft</span>')
  })

  it('ToggleChip exposes aria-pressed and an icon-only variant with accessible name', () => {
    const icon = renderToStaticMarkup(<ToggleChip accent icon="flag" label="Word goal" pressed />)
    expect(icon).toContain('class="toggle-chip toggle-chip--icon toggle-chip--accent"')
    expect(icon).toContain('aria-label="Word goal"')
    expect(icon).toContain('aria-pressed="true"')
    expect(icon).toContain('data-icon="flag"')
    const text = renderToStaticMarkup(<ToggleChip label="Serif" pressed={false} />)
    expect(text).toContain('>Serif</button>')
    expect(text).not.toContain('aria-label')
  })

  it('SegmentedControl is a tablist with a roving tabindex', () => {
    const markup = renderToStaticMarkup(
      <SegmentedControl label="View" onChange={() => undefined} options={[{ value: 'write', label: 'Write' }, { value: 'preview', label: 'Preview' }]} value="preview" />
    )
    expect(markup).toContain('role="tablist"')
    expect(markup).toContain('aria-label="View"')
    expect(markup).toContain('class="segmented-control__item" role="tab" tabindex="-1"')
    expect(markup).toContain('class="segmented-control__item segmented-control__item--active" role="tab" tabindex="0"')
  })

  it('Tabs keep injected class names and the tutorial hook', () => {
    const markup = renderToStaticMarkup(
      <Tabs activeItemClassName="chip--active" className="switcher" itemClassName="chip" items={[{ value: 'editor', label: 'Editor', tutorialId: 'workspace-view-editor' }, { value: 'timeline', label: 'Timeline' }]} label="Views" onChange={() => undefined} value="editor" />
    )
    expect(markup).toContain('class="pecie-tabs switcher" role="tablist"')
    expect(markup).toContain('class="chip chip--active" data-tutorial-id="workspace-view-editor"')
    expect(markup).toContain('aria-selected="false" class="chip"')
  })

  it('SearchInput pairs the magnifier glyph with a labelled search field', () => {
    const markup = renderToStaticMarkup(<SearchInput label="Search documents" placeholder="Search" />)
    expect(markup).toContain('class="binder-search" role="search"')
    expect(markup).toContain('data-icon="search"')
    expect(markup).toContain('aria-label="Search documents" class="binder-search__input" type="search"')
  })

  it('IconButton is class-based, ghost, titled and requires aria-label', () => {
    const markup = renderToStaticMarkup(<IconButton aria-label="Close">x</IconButton>)
    expect(markup).toContain('class="pecie-btn pecie-btn--ghost pecie-btn--md pecie-icon-button"')
    expect(markup).toContain('title="Close"')
    expect(markup).not.toContain('style=')
    expect(renderToStaticMarkup(<IconButton aria-label="Open" title={undefined} variant="secondary">x</IconButton>)).toMatch(/pecie-btn--secondary[^>]*>x</)
    expect(renderToStaticMarkup(<IconButton aria-label="Open" title={undefined}>x</IconButton>)).not.toContain('title=')
    expect(() => renderToStaticMarkup(<IconButton>x</IconButton>)).toThrow()
  })

  it('Tooltip adds describedby and the data hook to its trigger', () => {
    const markup = renderToStaticMarkup(
      <Tooltip content="Save (Ctrl+S)">
        <button type="button">Save</button>
      </Tooltip>
    )
    expect(markup).toMatch(/<button type="button" aria-describedby="[^"]+" class="pecie-tooltip-trigger" data-tooltip="Save \(Ctrl\+S\)" data-tooltip-placement="top">Save<\/button>/)
    expect(markup).toContain('role="tooltip"')
  })
})

describe('feedback and layout primitives', () => {
  it('Banner picks the live-region role from its tone', () => {
    expect(renderToStaticMarkup(<Banner>Saved</Banner>)).toBe('<p class="message-box" role="status">Saved</p>')
    expect(renderToStaticMarkup(<Banner tone="error">Failed</Banner>)).toBe('<p class="message-box message-box--error" role="alert">Failed</p>')
  })

  it('Progress is indeterminate by default and exposes values when determinate', () => {
    expect(renderToStaticMarkup(<Progress label="Exporting" />)).toBe('<span role="progressbar" aria-label="Exporting" class="progress-bar"><span class="progress-bar__track"></span></span>')
    expect(renderToStaticMarkup(<Progress decorative />)).toBe('<span aria-hidden="true" class="progress-bar"><span class="progress-bar__track"></span></span>')
    expect(renderToStaticMarkup(<Banner role="alert">Hmm</Banner>)).toContain('role="alert"')
    const determinate = renderToStaticMarkup(<Progress label="Exporting" value={0.42} />)
    expect(determinate).toContain('aria-valuenow="42"')
    expect(determinate).toContain('style="width:42%"')
  })

  it('ToastViewport renders a polite live region with dismissable toasts', () => {
    expect(renderToStaticMarkup(<ToastViewport dismissLabel="Dismiss" onDismiss={() => undefined} toasts={[]} />)).toBe('')
    const markup = renderToStaticMarkup(<ToastViewport dismissLabel="Dismiss" onDismiss={() => undefined} toasts={[{ id: '1', message: 'Project created.', tone: 'success' }]} />)
    expect(markup).toContain('aria-live="polite" class="toast-viewport"')
    expect(markup).toContain('class="toast toast--success" role="status"')
    expect(markup).toContain('aria-label="Dismiss" class="toast__dismiss"')
  })

  it('Card and EmptyState reproduce the existing surface markup', () => {
    expect(renderToStaticMarkup(<Card variant="soft">Body</Card>)).toBe('<section class="context-card context-card--soft">Body</section>')
    const card = renderToStaticMarkup(<Card actions={<button type="button">Go</button>} eyebrow="Recent" heading="Projects">Body</Card>)
    expect(card).toContain('<div class="context-card__heading"><p class="eyebrow">Recent</p><h3>Projects</h3></div>')
    expect(card).toContain('<div class="context-card__actions">')
    const empty = renderToStaticMarkup(<EmptyState body="Pick a document." icon="journal-text" premium title="Nothing open" titleId="t" />)
    expect(empty).toContain('class="empty-state empty-state--premium"')
    expect(empty).toContain('class="empty-state__icon empty-state__icon--large"')
    expect(empty).toContain('<h2 class="empty-state__title" id="t">Nothing open</h2>')
  })
})
