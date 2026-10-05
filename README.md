# ZeroKit

A quiet, browser-only workspace for fifteen everyday web utilities — image resizing, PDF editing, code
formatting, QR codes, password generation, unit conversion, text analysis, hardware checks and more.

Every tool runs in the tab. Files, text and device streams are decoded and re-written locally, so nothing is
uploaded and no account is ever required.

## AI Metadata Cleaner

The `ai-metadata-cleaner` tool strips AI-generation metadata and C2PA Content Credentials from **any**
supported file. It detects the container from the bytes, reports what it found, then rewrites only the
metadata — pixels, audio frames and video frames are never re-encoded.

| Container | Metadata removed | How |
| --------- | ---------------- | --- |
| JPEG | EXIF, XMP / extended XMP, IPTC-IRB, PNG-style comments, COM, vendor APPn, C2PA APP11 (JUMBF) | segments dropped, scan data copied |
| PNG | `tEXt`/`zTXt`/`iTXt`, `eXIf`, `caBX` (C2PA), `tIME`, `sTER`, `dSIG` | chunks dropped, CRCs preserved |
| WebP | `EXIF`, `XMP `, `C2PA` chunks | chunks dropped, VP8X feature flags cleared, RIFF size fixed |
| GIF | comment extensions, XMP application extensions | blocks skipped |
| SVG | `<metadata>`, XMP/RDF packets, comments, editor attributes | text-level rewrite |
| MP4 / MOV / M4A / HEIC / AVIF | C2PA `uuid` box (ContentProvenanceBox), XMP `uuid` box, `udta`/`©xxx` atoms, `meta` (mdta/mdir) | box re-typed to `free` and zero-filled **in place**, so stco/co64/iloc offsets stay valid |
| WAV / AIFF | `LIST`/`INFO`, `bext`, `iXML`, `id3`, `NAME`, `AUTH`, `ANNO` | chunks dropped, container sizes fixed |
| MP3 / FLAC | ID3v2 (all frames), ID3v1, APEv2, Lyrics3, Vorbis comments, pictures | tags stripped, audio frames untouched |
| PDF | XMP metadata streams (emptied), `/Info` dictionary, `/PieceInfo`, embedded files | classic xref table rebuilt after the edits |
| DOCX / XLSX / PPTX | `docProps/core.xml`, `docProps/app.xml`, `docProps/custom.xml`, `customXml/*`, thumbnails | ZIP members rewritten |

Detection covers the usual suspects (Midjourney, Stable Diffusion, Automatic1111, ComfyUI, DALL·E, Firefly,
Leonardo, Runway, FLUX, Imagen/SynthID, …) plus generic generation fields such as `prompt`, `parameters`,
`workflow`, `seed` and `digitalSourceType=trainedAlgorithmicMedia`.

Honest limits, stated in the UI as well: HEIC/AVIF files that keep XMP or C2PA inside their image **item
table** are only flagged (unlinking item data would corrupt the picture), and invisible pixel watermarks such
as SynthID are not file metadata and cannot be removed locally.

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
npm test       # vitest run — includes fixture-driven tests for every scrubber
```
