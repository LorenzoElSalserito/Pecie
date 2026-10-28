# ToastViewport

Pila di toast non intrusivi, regione live cortese, ogni toast chiudibile.

## Uso

```tsx
<ToastViewport toasts={toasts} dismissLabel="Chiudi" onDismiss={dismiss} />
```

## Tastiera

- Il pulsante di chiusura è nel tab order; la chiusura automatica (3,6 s / 5,2 s errore) è gestita dal chiamante.

## Stati

- `success`, `info`, `error`.

## Accessibilità

- `aria-live="polite"` + `aria-atomic`; ogni toast `role="status"`; chiusura con nome accessibile.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
