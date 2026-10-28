# @pecie/ui

Design system di Pecie: token, tema, icone e componenti base condivisi dal renderer desktop.
Nessuna dipendenza runtime esterna oltre a `react-aria-components`; nessun asset caricato da rete o da file: font e icone sono parte del bundle.

## Token

| Livello | File | Variabili CSS | Uso |
|---|---|---|---|
| Primitivi | `src/theme/tokens.ts` | `--pecie-space-*`, `--pecie-radius-*`, `--pecie-shadow-*`, `--pecie-transition-*`, `--pecie-color-*` | Palette e scale di base. Non introdurre nuovi colori nei componenti: aggiungerli qui. |
| Semantici | `src/theme/semantic-tokens.ts` | `--pecie-surface-*`, `--pecie-control-*`, `--pecie-accent-*`, `--pecie-feedback-*`, `--pecie-focus-ring`, `--pecie-scrim` | Ruoli: ciò che i componenti devono leggere. Hanno un valore per tema (chiaro, scuro, alto contrasto chiaro e scuro). |
| Icone | `src/theme/semantic-tokens.ts` | `--pecie-icon-size-{sm,md,lg,xl,hero}` | 14, 16, 20, 28, 40 px. `<Icon size="md">`. |
| Elevazione | `src/theme/semantic-tokens.ts` | `--pecie-elevation-{0,1,2,3}` | 0 piatto, 1 card, 2 pannello flottante, 3 dialogo. |
| Motion | `src/theme/semantic-tokens.ts` | `--pecie-motion-{instant,fast,normal,slow}`, `--pecie-ease-{standard,emphasized,exit}` | Durate ed easing. Ogni transizione sceglie da qui, dentro `@media (prefers-reduced-motion: no-preference)`. |

### Ruoli semantici

- **surface**: `base` (canvas), `raised` (card, pannelli, dialoghi), `overlay` (menu, popover, coach mark), `sunken` (input a riposo, toolbar raggruppate).
- **control**: `bg`, `bgHover`, `bgActive`, `border`, `borderStrong`, `text`, `textMuted`.
- **accent**: `bg`, `bgHover`, `text` (sul fondo accent), `subtle` (tinta per chip e toggle attivi), `onSubtle` (testo sulla tinta).
- **feedback**: `info`, `success`, `warning`, `danger`, ciascuno con `bg`, `border`, `text`.

### Contratto di contrasto

`src/theme/tokens.test.ts` verifica per ogni tema che ogni coppia testo/sfondo semantica raggiunga **WCAG AA** (4.5:1 per il testo, 3:1 per componenti e focus ring). Un token che non supera il test non entra in produzione.

### Regole

1. Un componente legge token semantici. I primitivi `--pecie-color-*` restano per compatibilità e per derivazioni eccezionali documentate.
2. Nessun esadecimale, nessun `px` di spaziatura e nessun `!important` nei fogli di stile dei componenti.
3. Il tema chiaro non è un override del tema scuro: ogni ruolo ha il suo valore in ogni tema.

## Icone

```tsx
import { Icon } from '@pecie/ui'

<Icon name="gear" />                 // decorativa, 1em, eredita il colore
<Icon name="gear" size="lg" />       // 20px dai token
<Icon name="gear" label="Impostazioni" /> // role="img" con etichetta
```

I glifi sono un sottoinsieme di Bootstrap Icons (MIT) incorporato come path SVG in `src/icons/bootstrap-icon-paths.ts`. Per aggiungere un glifo: inserire il nome in `ICONS` di `scripts/vendor-icons.py` e rigenerare. I test unit falliscono se un componente usa un nome non incorporato.

## Componenti

Indice e documenti in [`docs/README.md`](docs/README.md): `Button`, `IconButton`, `Icon`, `Dialog`, `TextField`, `TextArea`, `Select`, `Checkbox`, `RadioGroup`, `SearchInput`, `Chip`, `ToggleChip`, `SegmentedControl`, `Tabs`, `Tooltip`, `Banner`, `Progress`, `ToastViewport`, `Card`, `EmptyState`. Ogni componente entra con documentazione, keyboard spec, stati (default, hover, focus, active, disabled, error, loading), note a11y e test (PRD, Appendice E.3).

## Fogli di stile

Lo stile vive in `apps/desktop/src/renderer/src/styles/` diviso in `base/` (reset, icone, motion, tipografia, a11y), `primitives/` (un modulo per componente) e `surfaces/` (una superficie per modulo). `app.css` è solo l'indice di `@import` in ordine certificato. Budget per modulo: ≤ 400 righe, nessun `!important` fuori da `base/a11y.css`, nessun esadecimale. Per certificare un refactoring: `node tools/style-snapshot.mjs capture <dir>` prima e dopo (da `packages/testing`, sotto `xvfb-run`), poi `compare`.
