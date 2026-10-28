# RadioGroup

Gruppo di radio nativi dentro un `fieldset` con `legend`.

## Uso

```tsx
<RadioGroup label="Tema" name="theme" value={theme} onChange={setTheme}
  options={[{ value: 'light', label: 'Chiaro' }, { value: 'dark', label: 'Scuro', description: 'Per la sera' }]} />
```

## Tastiera

- Tab entra nel gruppo sull'opzione selezionata; frecce spostano la selezione (nativo).

## Stati

- `default`, `checked` (`radio-group__option--checked`), `focus-visible`, `disabled`, `error`.

## Accessibilità

- `legend` nomina il gruppo; `hint`/`error` via `aria-describedby` sul fieldset.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
