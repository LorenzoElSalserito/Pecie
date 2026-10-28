# TextField · TextArea · Select

Campi di testo, area di testo e select nativi con etichetta visibile, suggerimento ed errore.

## Uso

```tsx
<TextField label="Titolo progetto" hint="Breve e chiaro" error={error} value={title} onChange={…} />
<TextArea label="Note" rows={4} />
<Select label="Modalità" value={mode} onChange={…}><option value="a">A</option></Select>
```

## Tastiera

- Tab porta il focus sul controllo; l'etichetta è il `<label>` che lo avvolge (clic sul testo = focus).
- Select: frecce cambiano valore, Alt+Giù apre la tendina (comportamento nativo).

## Stati

- `default`, `hover`, `focus-visible` (anello 3px `--pecie-color-focus`), `disabled` (nativo), `error` (bordo e testo `field-error`, `aria-invalid`).

## Accessibilità

- Etichetta sempre visibile; `hint` ed `error` collegati con `aria-describedby`; l'errore ha `role="alert"`.
- Nessun placeholder usato come etichetta.

## Test

`packages/ui/src/components/primitives.test.tsx` (markup, ruoli e attributi ARIA). Lo stile vive nei moduli `apps/desktop/src/renderer/src/styles/primitives/*.css` e segue i token semantici.
