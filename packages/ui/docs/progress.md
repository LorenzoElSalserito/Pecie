# Progress

Barra di avanzamento indeterminata o determinata.

## Uso

```tsx
<Progress label="Esportazione" />
<Progress label="Esportazione" value={0.42} />
```

## Tastiera

- Non interattivo.

## Stati

- `indeterminate` (shimmer, fermo con reduced-motion), `determinate` (riempimento con `aria-valuenow`).

## Accessibilità

- `role="progressbar"` con `aria-label`; i valori sono percentuali 0–100.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
