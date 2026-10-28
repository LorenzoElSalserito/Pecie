# Chip · ToggleChip

Chip statici (contatori, pill di stato) e chip premibili con `aria-pressed`.

## Uso

```tsx
<Chip>12</Chip>
<Chip kind="status" tone="warning">Bozza</Chip>
<ToggleChip icon="flag" label="Obiettivo parole" pressed={hasGoal} accent onClick={…} />
```

## Tastiera

- ToggleChip è un `button`: Tab, Spazio/Invio alternano.

## Stati

- Chip: `neutral`, `warning`, `danger`. ToggleChip: `default`, `hover`, `focus-visible`, `pressed` (`aria-pressed=true`), `accent`, `disabled`.

## Accessibilità

- Variante icona: nome accessibile da `aria-label` e `title`; l'SVG è `aria-hidden`.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
