# Card

Superficie rialzata (`.context-card`) con eyebrow, titolo e riga azioni opzionali.

## Uso

```tsx
<Card eyebrow="Recenti" heading="Progetti" actions={<Button size="sm">Apri</Button>}>…</Card>
<Card variant="soft">…</Card>
```

## Tastiera

- Non interattiva di per sé; le azioni sono controlli normali.

## Stati

- `default`, `soft`, `flush`; `hover` (lieve elevazione, dal foglio esistente).

## Accessibilità

- `as` sceglie l'elemento (`section` di default) per una struttura semantica corretta; il titolo è un `h3`.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
