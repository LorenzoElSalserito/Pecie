# IconButton

Bottone quadrato 44 px per una sola icona, variante ghost, `aria-label` obbligatorio.

## Uso

```tsx
<IconButton aria-label="Impostazioni" onClick={…}><Icon name="gear" /></IconButton>
```

## Tastiera

- Come un bottone: Tab, Spazio/Invio.

## Stati

- `default`, `hover`, `focus-visible`, `active`, `disabled`.

## Accessibilità

- Senza `aria-label` il componente lancia un errore; `title` ripete il nome come tooltip nativo.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
