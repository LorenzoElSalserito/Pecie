# Checkbox

Casella di controllo nativa avvolta dall'etichetta: l'intera riga è l'area di clic.

## Uso

```tsx
<Checkbox checked={expert} label="Modalità esperto" onChange={…} />
```

## Tastiera

- Tab raggiunge l'input; Spazio alterna lo stato.

## Stati

- `default`, `checked`, `focus-visible`, `disabled` (nativi).

## Accessibilità

- Nome accessibile dall'etichetta; nessuna icona decorativa sostituisce il controllo nativo.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
