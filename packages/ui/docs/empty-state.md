# EmptyState

Stato vuoto con glifo decorativo, titolo, corpo e azioni.

## Uso

```tsx
<EmptyState icon="journal-text" premium title={t('emptyStateTitle')} body={t('emptyStateBody')} titleId="editor-surface-title"
  actions={<Button size="sm">Importa</Button>} />
```

## Tastiera

- Le azioni sono normali bottoni nel tab order.

## Stati

- `default`, `premium` (icona grande, titolo `h2`).

## Accessibilità

- L'icona è `aria-hidden`; `titleId` permette a un `aria-labelledby` esterno di puntare al titolo.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
