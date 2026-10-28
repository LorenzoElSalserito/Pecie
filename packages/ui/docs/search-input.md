# SearchInput

Campo di ricerca con lente, dentro un landmark `role="search"`.

## Uso

```tsx
<SearchInput label="Cerca documenti" placeholder="Cerca" value={query} onChange={…} />
```

## Tastiera

- Tab porta sul campo; Esc svuota (nativo `type=search`).

## Stati

- `default`, `focus-within` (bordo accent), `disabled`.

## Accessibilità

- `aria-label` obbligatorio (nessuna etichetta visibile per scelta di design); icona decorativa.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
