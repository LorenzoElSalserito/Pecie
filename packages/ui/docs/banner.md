# Banner

Messaggio inline (`.message-box`): stato cortese o errore annunciato subito.

## Uso

```tsx
<Banner>Selezione necessaria.</Banner>
<Banner tone="error">{error}</Banner>
```

## Tastiera

- Non interattivo.

## Stati

- `neutral` (`role=status`), `error` (`role=alert`).

## Accessibilità

- Testo sempre esplicito: mai solo colore per distinguere l'errore.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
