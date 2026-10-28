import { useId, useMemo, useState } from 'react'

import type { FontCategory, FontDefinition, SupportedLocale } from '@pecie/schemas'
import { FONT_CATALOG, FONT_CATEGORIES, fontFamilyStack, getFontDefinition } from '@pecie/schemas'
import { Button, Icon } from '@pecie/ui'

import { t } from '../i18n'

type FontPickerProps = {
  locale: SupportedLocale
  value: string
  onChange: (fontId: string) => void
  /** Start with the browser expanded (settings) or collapsed behind "Change font" (wizard). */
  defaultExpanded?: boolean
}

function fontMeta(locale: SupportedLocale, font: FontDefinition): string {
  const parts = [t(locale, `fontCategory_${font.category}`)]
  if (!font.italic) {
    parts.push(t(locale, 'fontPickerNoItalic'))
  }
  parts.push(font.license)
  return parts.join(' · ')
}

export function FontPicker({ locale, value, onChange, defaultExpanded = false }: FontPickerProps): React.JSX.Element {
  const current = getFontDefinition(value)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FontCategory | 'all'>('all')
  const groupId = useId()
  const listId = `${groupId}-list`

  const visibleFonts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return FONT_CATALOG.filter((font) => {
      if (category !== 'all' && font.category !== category) {
        return false
      }
      if (!normalizedQuery) {
        return true
      }
      return (
        font.label.toLowerCase().includes(normalizedQuery) ||
        t(locale, `fontCategory_${font.category}`).toLowerCase().includes(normalizedQuery)
      )
    })
  }, [category, locale, query])

  return (
    <div className="font-picker" data-testid="font-picker">
      <div className="font-picker__current" style={{ fontFamily: fontFamilyStack(current) }}>
        <div className="font-picker__current-copy">
          <span className="eyebrow">{t(locale, 'fontPickerCurrent')}</span>
          <strong className="font-picker__current-name" data-testid="font-picker-current">
            {current.label}
          </strong>
          <span className="font-picker__meta">
            {fontMeta(locale, current)}
            {current.ui ? ` · ${t(locale, 'fontPickerAppliesUi')}` : ''}
          </span>
          <p className="font-picker__sample">{t(locale, 'fontPickerSample')}</p>
        </div>
        <Button
          aria-controls={listId}
          aria-expanded={expanded}
          className="font-picker__toggle"
          onClick={() => setExpanded((state) => !state)}
          size="sm"
          type="button"
          variant={expanded ? 'ghost' : 'secondary'}
        >
          <Icon name={expanded ? 'chevron-up' : 'fonts'} />
          {t(locale, expanded ? 'fontPickerClose' : 'fontPickerChange')}
        </Button>
      </div>

      {expanded ? (
        <div className="font-picker__browser" id={listId}>
          <div className="font-picker__toolbar">
            <label className="font-picker__search">
              <Icon name="search" />
              <input
                aria-label={t(locale, 'fontPickerSearch')}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t(locale, 'fontPickerSearch')}
                type="search"
                value={query}
              />
            </label>
            <div className="font-picker__categories">
              <button
                aria-pressed={category === 'all'}
                className="toggle-chip"
                onClick={() => setCategory('all')}
                type="button"
              >
                {t(locale, 'fontPickerAll')}
              </button>
              {FONT_CATEGORIES.map((entry) => (
                <button
                  aria-pressed={category === entry}
                  className="toggle-chip"
                  key={entry}
                  onClick={() => setCategory(entry)}
                  title={t(locale, `fontCategory_${entry}_hint`)}
                  type="button"
                >
                  {t(locale, `fontCategory_${entry}`)}
                </button>
              ))}
            </div>
          </div>
          {category !== 'all' ? <p className="font-picker__hint">{t(locale, `fontCategory_${category}_hint`)}</p> : null}
          {visibleFonts.length === 0 ? (
            <p className="font-picker__empty" role="status">
              {t(locale, 'fontPickerSearchEmpty')}
            </p>
          ) : (
            <div aria-label={t(locale, 'fontPreference')} className="font-picker__grid" role="radiogroup">
              {visibleFonts.map((font) => {
                const selected = font.id === current.id
                return (
                  <label
                    className={`font-picker__option${selected ? ' font-picker__option--selected' : ''}`}
                    data-font-id={font.id}
                    key={font.id}
                    style={{ fontFamily: fontFamilyStack(font) }}
                  >
                    <input
                      aria-label={font.label}
                      checked={selected}
                      name={`${groupId}-font`}
                      onChange={() => onChange(font.id)}
                      type="radio"
                      value={font.id}
                    />
                    <span className="font-picker__option-name">{font.label}</span>
                    <span aria-hidden="true" className="font-picker__option-glyphs">
                      Aa Qg <em>Italic</em> <strong>Bold</strong> 1234
                    </span>
                    <span className="font-picker__option-meta">
                      {t(locale, `fontCategory_${font.category}`)}
                      {font.ui ? ` · ${t(locale, 'fontPickerAppliesUi')}` : ''}
                    </span>
                    {selected ? <Icon className="font-picker__option-check" name="check-lg" /> : null}
                  </label>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
