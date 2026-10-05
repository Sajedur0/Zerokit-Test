# ZeroKit

A quiet, browser-only workspace for fourteen everyday web utilities — image resizing, PDF editing, code
formatting, QR codes, password generation, unit conversion, text analysis, hardware checks and more.

Every tool runs in the tab. Files, text and device streams are decoded and re-written locally, so nothing is
uploaded and no account is ever required.

## Design

The interface follows the "Clearframe" editorial design language: a warm paper canvas with forest-green ink a
coral accent and lime highlights, numbered eyebrow labels, rotated icon tiles, dashed work zones and a dark
forest panel that carries the promise copy.

Two modes share one palette:

| Mode     | Canvas            | Surfaces            | Highlight |
| -------- | ----------------- | ------------------- | --------- |
| `paper`  | warm off-white    | paper-bright sheets | coral     |
| `forest` | deep forest green | dark sheets         | lime      |

Mode tokens live in `src/index.css` (`[data-theme="paper"]` / `[data-theme="forest"]`) and map onto the
`--theme-*` variables that each tool component consumes, so switching the mode restyles the whole app.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Checks

```bash
npm run lint   # tsc --noEmit
npm test       # vitest run
```
