# Tabs

Lista di tab con tabindex itinerante; classi iniettabili per riusare il chrome esistente.

## Uso

```tsx
<Tabs label="Viste" value={view} onChange={setView} className="workspace-header__view-switcher"
  itemClassName="workspace-view-chip" activeItemClassName="workspace-view-chip--active"
  items={[{ value: 'editor', label: 'Editor', tutorialId: 'workspace-view-editor' }, …]} />
```

## Tastiera

- Tab entra sulla tab attiva; ← → ↑ ↓ spostano e attivano; Home/End agli estremi.

## Stati

- `default`, `hover`, `focus-visible`, `selected` (`aria-selected=true`).

## Accessibilità

- `role="tablist"`/`role="tab"`; `accessibleLabel` quando l'etichetta visibile non basta.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
