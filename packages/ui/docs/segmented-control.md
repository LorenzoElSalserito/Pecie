# SegmentedControl

Scelta esclusiva come `tablist` compatta (es. modalità editor).

## Uso

```tsx
<SegmentedControl label="Vista editor" value={mode} onChange={setMode} iconOnly
  options={[{ value: 'write', label: 'Scrivi', icon: <Icon name="pencil-square" /> }, …]} />
```

## Tastiera

- Solo l'elemento attivo è nel tab order (roving tabindex); ← → ↑ ↓ spostano e selezionano; Home/End agli estremi.

## Stati

- `default`, `hover`, `focus-visible`, `active` (`aria-selected=true`), `disabled`.

## Accessibilità

- `role="tablist"` con `aria-label`; in modalità `iconOnly` ogni tab ha `aria-label` e `title`.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
