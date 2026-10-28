# Icon

Glifo SVG inline dal sottoinsieme Bootstrap Icons incorporato.

## Uso

```tsx
<Icon name="gear" />
<Icon name="gear" size="lg" />
<Icon name="gear" label="Impostazioni" />
```

## Tastiera

- Non interattivo.

## Stati

- `size`: sm 14, md 16, lg 20, xl 28, hero 40 (px); senza `size` è 1em.

## Accessibilità

- Decorativa (`aria-hidden`) salvo `label`, che la rende `role="img"` con `<title>`.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
