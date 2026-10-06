/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The AI-Metadata cleaner: detects AI-generation metadata / C2PA Content
 * Credentials in any supported file and rewrites the file without it.
 *
 * Every step is byte-level and runs locally — nothing is uploaded, and the
 * media payload is never re-encoded.
 */

import { ascii, concatBytes, decodeText, formatBytes, readU32BE, toReadable } from './bytes';
import { findTextMentions, hasC2paMarker, type TextMention } from './aiSignatures';
import {
  inspectGif,
  inspectJpeg,
  inspectPng,
  inspectSvg,
  inspectWebp,
  scrubGif,
  scrubJpeg,
  scrubPng,
  scrubSvg,
  scrubWebp,
  textOfFile,
} from './formats/imageFormats';
import { inspectBmff, scrubBmff } from './formats/bmff';
import { inspectAiff, inspectWav, scrubAiff, scrubWav, inspectId3, scrubMp3 } from './formats/audioFormats';
import { inspectPdf, scrubPdf } from './formats/pdfFormat';
import { inspectOffice, scrubOffice } from './formats/officeFormat';
import { isZip } from './formats/zipFormat';
import type { ExifField } from './exif';

export type CleanFormat =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'gif'
  | 'svg'
  | 'bmff'
  | 'wav'
  | 'aiff'
  | 'mp3'
  | 'flac'
  | 'pdf'
  | 'ooxml'
  | 'zip-other'
  | 'unknown';

export interface InspectionReport {
  format: CleanFormat;
  formatLabel: string;
  extension: string;
  mime: string;
  fields: ExifField[];
  segments: string[];
  containers: string[];
  mentions: TextMention[];
  c2pa: boolean;
  gps: boolean;
  xmp?: string;
  id3?: { version: string; frames: Array<{ id: string; description: string; size: number }> };
  office?: { parts: string[] };
  pdf?: ReturnType<typeof inspectPdf>;
  teaser?: string;
}

export interface CleanReport {
  bytes: Uint8Array;
  removed: string[];
  notes: string[];
  before: number;
  after: number;
}

export interface DetectedFormat {
  format: CleanFormat;
  formatLabel: string;
  extension: string;
  mime: string;
}

const LABELS: Record<CleanFormat, string> = {
  jpeg: 'JPEG image',
  png: 'PNG image',
  webp: 'WebP image',
  gif: 'GIF image',
  svg: 'SVG vector',
  bmff: 'ISO-BMFF media (MP4 / MOV / HEIC / AVIF)',
  wav: 'WAV audio',
  aiff: 'AIFF audio',
  mp3: 'MPEG audio (MP3)',
  flac: 'FLAC audio',
  pdf: 'PDF document',
  ooxml: 'Office document (OOXML)',
  'zip-other': 'ZIP archive',
  unknown: 'Unrecognised file',
};

const EXTENSIONS: Record<CleanFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  svg: 'svg',
  bmff: 'mp4',
  wav: 'wav',
  aiff: 'aiff',
  mp3: 'mp3',
  flac: 'flac',
  pdf: 'pdf',
  ooxml: 'docx',
  'zip-other': 'zip',
  unknown: 'bin',
};

const extensionOf = (name: string): string => (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();

const replaceExtension = (name: string, next: string): string => {
  const base = name.replace(/\.[^./\\]+$/, '') || name;
  return `${base}-clean.${next}`;
};

const detectByName = (name: string): DetectedFormat | null => {
  const ext = extensionOf(name);
  const map: Record<string, CleanFormat> = {
    jpg: 'jpeg',
    jpeg: 'jpeg',
    jpe: 'jpeg',
    png: 'png',
    webp: 'webp',
    gif: 'gif',
    svg: 'svg',
    svgz: 'svg',
    mp4: 'bmff',
    m4v: 'bmff',
    mov: 'bmff',
    heic: 'bmff',
    heif: 'bmff',
    avif: 'bmff',
    m4a: 'bmff',
    '3gp': 'bmff',
    wav: 'wav',
    wave: 'wav',
    aif: 'aiff',
    aiff: 'aiff',
    aifc: 'aiff',
    mp3: 'mp3',
    flac: 'flac',
    pdf: 'pdf',
    docx: 'ooxml',
    xlsx: 'ooxml',
    pptx: 'ooxml',
    zip: 'zip-other',
  };
  const format = map[ext];
  if (!format) return null;
  return { format, formatLabel: LABELS[format], extension: ext, mime: '' };
};

export const detectFormat = async (file: File, bytes: Uint8Array): Promise<DetectedFormat> => {
  const declared = detectByName(file.name);
  const sniff = (): CleanFormat => {
    if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
    if (readU32BE(bytes, 0) === 0x89504e47) return 'png';
    if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
    if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WAVE') return 'wav';
    if (ascii(bytes, 0, 4) === 'FORM' && /AIFF|AIFC/.test(ascii(bytes, 8, 12))) return 'aiff';
    if (ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'mp3';
    if (ascii(bytes, 0, 4) === 'fLaC') return 'flac';
    if (ascii(bytes, 0, 4) === 'GIF8') return 'gif';
    if (ascii(bytes, 0, 5) === '%PDF-') return 'pdf';
    if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)?<svg[\s>]/i.test(decodeText(bytes.subarray(0, 512)))) return 'svg';
    if (ascii(bytes, 4, 8) === 'ftyp' && bytes.length >= 12) return 'bmff';
    if (isZip(bytes)) return declared?.format === 'ooxml' ? 'ooxml' : 'zip-other';
    return 'unknown';
  };

  const format = sniff();
  const useDeclared = format === 'unknown' && declared ? declared.format : format;
  const extension = declared?.extension || EXTENSIONS[useDeclared];

  return {
    format: useDeclared,
    formatLabel: LABELS[useDeclared],
    extension: extension || EXTENSIONS[useDeclared],
    mime: file.type,
  };
};

/** Reads everything the report can show, without changing the file. */
export const inspectFile = async (file: File, bytes: Uint8Array, detected: DetectedFormat): Promise<InspectionReport> => {
  const report: InspectionReport = {
    format: detected.format,
    formatLabel: detected.formatLabel,
    extension: detected.extension,
    mime: detected.mime,
    fields: [],
    segments: [],
    containers: [],
    mentions: [],
    c2pa: false,
    gps: false,
  };

  try {
    switch (detected.format) {
      case 'jpeg': {
        const result = inspectJpeg(bytes);
        report.fields = result.fields;
        report.mentions = result.mentions;
        report.c2pa = result.c2pa;
        report.gps = result.gps;
        report.segments = result.segments;
        report.xmp = result.xmp;
        break;
      }
      case 'png': {
        const result = inspectPng(bytes);
        report.fields = result.fields;
        report.mentions = result.mentions;
        report.c2pa = result.c2pa;
        report.gps = result.gps;
        report.segments = result.segments;
        report.xmp = result.xmp;
        break;
      }
      case 'webp': {
        const result = inspectWebp(bytes);
        report.fields = result.fields;
        report.mentions = result.mentions;
        report.c2pa = result.c2pa;
        report.gps = result.gps;
        report.segments = result.segments;
        report.xmp = result.xmp;
        break;
      }
      case 'gif': {
        const result = inspectGif(bytes);
        report.mentions = result.mentions;
        report.segments = result.segments;
        report.c2pa = result.c2pa;
        break;
      }
      case 'svg': {
        const result = inspectSvg(bytes);
        report.mentions = result.mentions;
        report.segments = result.segments;
        report.c2pa = result.c2pa;
        break;
      }
      case 'bmff': {
        const result = inspectBmff(bytes);
        report.containers = result.found;
        report.c2pa = result.c2pa;
        report.mentions = findTextMentions(textOfFile(bytes));
        report.segments = result.brands.length ? [`Brands: ${[...new Set(result.brands)].join(', ')}`] : [];
        break;
      }
      case 'wav': {
        const result = inspectWav(bytes);
        report.containers = result.chunks;
        report.mentions = result.mentions;
        report.fields = result.fields;
        report.c2pa = hasC2paMarker(textOfFile(bytes));
        report.teaser = 'Chunk list is shown above; metadata chunks are listed in the report.';
        break;
      }
      case 'aiff': {
        const result = inspectAiff(bytes);
        report.containers = result.chunks;
        report.fields = result.fields;
        report.mentions = result.mentions;
        report.c2pa = hasC2paMarker(textOfFile(bytes));
        break;
      }
      case 'mp3': {
        const result = inspectId3(bytes);
        report.id3 = { version: result.version, frames: result.frames };
        report.mentions = result.mentions;
        report.c2pa = hasC2paMarker(textOfFile(bytes));
        break;
      }
      case 'flac': {
        const text = textOfFile(bytes);
        report.segments.push('FLAC stream');
        if (/xmp|vorbis|comment/i.test(text)) report.segments.push('FLAC comment blocks present');
        report.mentions = findTextMentions(text);
        report.c2pa = hasC2paMarker(text);
        break;
      }
      case 'pdf': {
        const result = inspectPdf(bytes);
        report.pdf = result;
        report.mentions = result.mentions;
        report.c2pa = result.mentions.some((mention) => /c2pa/i.test(mention.label));
        report.xmp = result.xmp;
        report.segments = [
          `PDF ${result.version}`,
          `${result.metadataStreams} XMP metadata stream(s)`,
          `${result.infoDictionaries} /Info document info reference(s)`,
        ];
        break;
      }
      case 'ooxml': {
        const result = await inspectOffice(bytes);
        report.office = { parts: result.parts };
        report.mentions = result.mentions;
        report.fields = result.fields;
        report.c2pa = result.parts.some((part) => /custom xml/i.test(part));
        break;
      }
      default: {
        const text = toReadable(bytes.subarray(0, Math.min(bytes.length, 2 * 1024 * 1024)));
        report.mentions = findTextMentions(text);
        report.c2pa = hasC2paMarker(text);
        report.segments.push(`${formatBytes(bytes.length)} · raw bytes`);
      }
    }
  } catch (error) {
    report.segments.push(`Inspection failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  return report;
};

export interface CleanResult {
  cleanBytes: Uint8Array;
  outName: string;
  report: CleanReport;
  format: DetectedFormat;
}

/** Rewrites the file with AI/metadata identifiers stripped. */
export const cleanFile = async (file: File, bytes: Uint8Array, detected: DetectedFormat): Promise<CleanResult> => {
  let bytesOut = bytes;
  let removed: string[] = [];
  let notes: string[] = [];

  switch (detected.format) {
    case 'jpeg': {
      const result = scrubJpeg(bytes);
      bytesOut = result.bytes;
      removed = result.removed;
      notes = result.notes;
      break;
    }
    case 'png': {
      const result = scrubPng(bytes);
      bytesOut = result.bytes;
      removed = result.removed;
      notes = result.notes;
      break;
    }
    case 'webp': {
      const result = scrubWebp(bytes);
      bytesOut = result.bytes;
      removed = result.removed;
      notes = result.notes;
      break;
    }
    case 'gif': {
      const result = scrubGif(bytes);
      bytesOut = result.bytes;
      removed = result.removed;
      notes = result.notes;
      break;
    }
    case 'svg': {
      const result = scrubSvg(bytes);
      bytesOut = result.bytes;
      removed = result.removed;
      notes = result.notes;
      break;
    }
    case 'bmff': {
      const result = scrubBmff(bytes);
      bytesOut = result.bytes;
      removed = result.removed;
      notes = result.notes;
      break;
    }
    case 'wav': {
      const result = scrubWav(bytes);
      bytesOut = result.bytes;
      removed = result.removed;
      notes = result.notes;
      break;
    }
    case 'aiff': {
      const result = scrubAiff(bytes);
      bytesOut = result.bytes;
      removed = result.removed;
      notes = result.notes;
      break;
    }
    case 'mp3': {
      const result = scrubMp3(bytes);
      bytesOut = result.bytes;
      removed = result.removed;
      notes = result.notes;
      break;
    }
    case 'flac': {
      const result = stripFlacComments(bytes);
      bytesOut = result.bytes;
      removed = result.removed;
      notes = result.notes;
      break;
    }
    case 'pdf': {
      const result = scrubPdf(bytes);
      bytesOut = result.bytes;
      removed = result.removed;
      notes = result.notes;
      break;
    }
    case 'ooxml': {
      const result = await scrubOffice(bytes);
      bytesOut = result.bytes;
      removed = result.removed;
      notes = result.notes;
      break;
    }
    default: {
      notes.push('This file type has no known metadata container, so the bytes were copied unchanged.');
    }
  }

  // Never emit an empty or unreadable file.
  if (!bytesOut.length) {
    bytesOut = bytes;
    notes.push('The cleaner refused to produce an empty file — the original bytes were kept.');
  }

  if (removed.length) {
    notes.unshift(`Removed ${removed.length} metadata item${removed.length === 1 ? '' : 's'}; media data untouched.`);
  }

  const docxLike = detected.format === 'ooxml' ? extensionOf(file.name) || 'docx' : detected.extension;
  const outName = replaceExtension(file.name, docxLike);

  return {
    cleanBytes: bytesOut,
    outName,
    format: detected,
    report: { bytes: bytesOut, removed, notes, before: bytes.length, after: bytesOut.length },
  };
};

/** FLAC: drops VORBIS_COMMENT + PICTURE + APPLICATION blocks (keeps audio frames). */
const stripFlacComments = (bytes: Uint8Array): { bytes: Uint8Array; removed: string[]; notes: string[] } => {
  const removed: string[] = [];
  const notes: string[] = [];
  const parts: Uint8Array[] = [bytes.subarray(0, 4)];
  let offset = 4;
  let last = false;

  while (!last && offset + 4 <= bytes.length) {
    const type = bytes[offset] & 0x7f;
    last = (bytes[offset] & 0x80) !== 0;
    const size = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const total = 4 + size;
    if (offset + total > bytes.length) break;

    const shouldDrop = type === 4 || type === 6 || type === 2;
    //  4 = VORBIS_COMMENT, 6 = PICTURE, 2 = APPLICATION
    if (shouldDrop) {
      removed.push(type === 4 ? 'FLAC Vorbis comment block' : type === 6 ? 'FLAC picture block' : 'FLAC application block');
    } else {
      parts.push(bytes.subarray(offset, offset + total));
    }
    offset += total;
  }

  if (offset > 0 && offset < bytes.length) {
    parts.push(bytes.subarray(offset)); // audio frames
  }

  // Re-flag the last metadata block in the rewritten header chain.
  const body = concatBytes(parts.slice(1));
  let cursor = 0;
  while (cursor + 4 <= body.length) {
    const isLast = (body[cursor] & 0x80) !== 0;
    const size = (body[cursor + 1] << 16) | (body[cursor + 2] << 8) | body[cursor + 3];
    if (isLast) break;
    cursor += 4 + size;
  }
  if (cursor + 4 <= body.length) {
    body[cursor] |= 0x80;
  } else {
    notes.push('FLAC block chain could not be re-terminated; the file was left unchanged.');
    return { bytes, removed: [], notes };
  }

  if (!removed.length) notes.push('No FLAC comment or picture blocks were found.');
  return { bytes: concatBytes([bytes.subarray(0, 4), body]), removed, notes };
};
