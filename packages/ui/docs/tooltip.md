# Tooltip

Tooltip solo CSS: appare su hover e su focus da tastiera, mai solo al tocco.

## Uso

```tsx
<Tooltip content="Salva (Ctrl+S)"><IconButton aria-label="Salva"><Icon name="check2" /></IconButton></Tooltip>
```

## Tastiera

- Si mostra con `:focus-visible` sul trigger; scompare con blur. Nessun focus proprio.

## Stati

- `hidden`, `visible` (hover / focus-visible); `placement` top|bottom.

## Accessibilità

- Il trigger deve essere focusabile; il testo è anche `role="tooltip"` collegato con `aria-describedby`.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
