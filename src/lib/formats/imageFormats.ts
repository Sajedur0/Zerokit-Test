/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lossless, byte-level metadata scrubbers for image containers.
 * Nothing is re-encoded: only metadata segments/chunks are dropped, so the
 * pixels (and the file's quality) stay exactly as they were.
 */

import {
  ascii,
  concatBytes,
  decodeText,
  readU16BE,
  readU32BE,
  readU32LE,
  startsWithBytes,
  toReadable,
  writeU32LE,
} from '../bytes';
import { readExif, type ExifField } from '../exif';
import { findTextMentions, hasC2paMarker, type TextMention } from '../aiSignatures';

export interface ImageInspection {
  fields: ExifField[];
  mentions: TextMention[];
  c2pa: boolean;
  gps: boolean;
  segments: string[];
  xmp?: string;
  iptc?: string;
}

export interface ImageScrubResult {
  bytes: Uint8Array;
  removed: string[];
  notes: string[];
}

/** Latin-1 view of (a slice of) the file, used for signature hunting. */
export const textOfFile = (bytes: Uint8Array, limit = 6 * 1024 * 1024): string => {
  const view = bytes.length > limit ? bytes.subarray(0, limit) : bytes;
  return toReadable(view);
};

const readXmpString = (bytes: Uint8Array, start: number, end: number): string =>
  toReadable(bytes.subarray(start, end)).slice(0, 1400);

/* ------------------------------------------------------------------ JPEG -- */

interface JpegSegment {
  marker: number;
  start: number;
  totalLength: number;
  payloadStart: number;
  payloadLength: number;
}

const readJpegSegments = (bytes: Uint8Array): JpegSegment[] => {
  const segments: JpegSegment[] = [];
  let offset = 2; // skip SOI

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break; // SOS / EOI — entropy data follows
    const length = readU16BE(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    segments.push({
      marker,
      start: offset,
      totalLength: 2 + length,
      payloadStart: offset + 4,
      payloadLength: length - 2,
    });
    offset += 2 + length;
  }

  return segments;
};

/** Last EOI in the file — everything after it is a trailer, not image data. */
const jpegScanEnd = (bytes: Uint8Array, from: number): number => {
  for (let i = bytes.length - 2; i >= from; i -= 1) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return i + 2;
  }
  return bytes.length;
};

const jpegSegmentEnd = (bytes: Uint8Array): number => {
  const segments = readJpegSegments(bytes);
  return segments.length
    ? segments[segments.length - 1].start + segments[segments.length - 1].totalLength
    : 2;
};

export const inspectJpeg = (bytes: Uint8Array): ImageInspection => {
  const inspection: ImageInspection = { fields: [], mentions: [], c2pa: false, gps: false, segments: [] };
  const segments = readJpegSegments(bytes);
  const mentions: TextMention[] = [];

  for (const segment of segments) {
    const payload = bytes.subarray(segment.payloadStart, segment.payloadStart + segment.payloadLength);

    if (segment.marker === 0xe1) {
      if (startsWithBytes(bytes, segment.payloadStart, 'Exif\0\0')) {
        inspection.segments.push('APP1 · EXIF');
        const exif = readExif(bytes, segment.payloadStart + 6);
        inspection.fields.push(...exif.fields);
        inspection.gps = inspection.gps || exif.hasGps;
      } else if (startsWithBytes(bytes, segment.payloadStart, 'http://ns.adobe.com/xap/1.0/\0')) {
        inspection.segments.push('APP1 · XMP');
        inspection.xmp = readXmpString(bytes, segment.payloadStart + 29, segment.payloadStart + segment.payloadLength);
      } else if (startsWithBytes(bytes, segment.payloadStart, 'http://ns.adobe.com/xmp/extension/\0')) {
        inspection.segments.push('APP1 · Extended XMP');
      } else {
        inspection.segments.push('APP1 · other');
      }
    } else if (segment.marker === 0xed) {
      inspection.segments.push('APP13 · IPTC / Photoshop IRB');
      inspection.iptc = readXmpString(bytes, segment.payloadStart, segment.payloadStart + segment.payloadLength);
    } else if (segment.marker === 0xeb) {
      const text = toReadable(payload);
      if (startsWithBytes(bytes, segment.payloadStart, 'JP\0\0') || hasC2paMarker(text)) {
        inspection.segments.push('APP11 · C2PA / JUMBF');
        inspection.c2pa = true;
        mentions.push({
          label: 'C2PA Content Credentials (JUMBF in APP11)',
          snippet: text.slice(0, 180),
        });
      }
    } else if (segment.marker === 0xfe) {
      inspection.segments.push('COM · Comment');
    } else if (segment.marker === 0xe0 && startsWithBytes(bytes, segment.payloadStart, 'JFIF\0')) {
      inspection.segments.push('APP0 · JFIF');
    } else if (segment.marker === 0xe2) {
      inspection.segments.push(
        startsWithBytes(bytes, segment.payloadStart, 'ICC_PROFILE\0') ? 'APP2 · ICC profile' : 'APP2 · FlashPix',
      );
    } else if (segment.marker === 0xee && startsWithBytes(bytes, segment.payloadStart, 'Adobe')) {
      inspection.segments.push('APP14 · Adobe colour transform');
    }
  }

  if (jpegScanEnd(bytes, jpegSegmentEnd(bytes)) < bytes.length) {
    inspection.segments.push('Trailing bytes after EOI');
  }

  inspection.mentions = [...mentions, ...findTextMentions(textOfFile(bytes))];
  return inspection;
};

export const scrubJpeg = (bytes: Uint8Array): ImageScrubResult => {
  const removed: string[] = [];
  const notes: string[] = [];
  const segments = readJpegSegments(bytes);
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];

  for (const segment of segments) {
    const raw = bytes.subarray(segment.start, segment.start + segment.totalLength);
    const payloadText = toReadable(bytes.subarray(segment.payloadStart, segment.payloadStart + segment.payloadLength));

    const isExif = segment.marker === 0xe1 && startsWithBytes(bytes, segment.payloadStart, 'Exif\0\0');
    const isXmp =
      segment.marker === 0xe1 &&
      (startsWithBytes(bytes, segment.payloadStart, 'http://ns.adobe.com/xap/1.0/\0') ||
        startsWithBytes(bytes, segment.payloadStart, 'http://ns.adobe.com/xmp/extension/\0'));
    const isIptc = segment.marker === 0xed;
    const isC2pa = segment.marker === 0xeb && (startsWithBytes(bytes, segment.payloadStart, 'JP\0\0') || hasC2paMarker(payloadText));
    const isComment = segment.marker === 0xfe;
    const isStrayApp0 = segment.marker === 0xe0 && !startsWithBytes(bytes, segment.payloadStart, 'JFIF\0');
    // Vendor-specific APPn segments (the usual home of tool signatures).
    const isVendorApp =
      segment.marker >= 0xe3 &&
      segment.marker <= 0xef &&
      segment.marker !== 0xeb &&
      segment.marker !== 0xed &&
      segment.marker !== 0xee;

    if (isExif) removed.push('EXIF block (APP1)');
    else if (isXmp) removed.push('XMP block (APP1)');
    else if (isIptc) removed.push('IPTC / Photoshop IRB (APP13)');
    else if (isC2pa) removed.push('C2PA Content Credentials (APP11 / JUMBF)');
    else if (isComment) removed.push('JPEG comment (COM)');
    else if (isStrayApp0) removed.push('Non-JFIF APP0 segment');
    else if (isVendorApp) removed.push(`APP${segment.marker - 0xe0} vendor segment`);

    if (isExif || isXmp || isIptc || isC2pa || isComment || isStrayApp0 || isVendorApp) continue;
    parts.push(raw);
  }

  const scanStart = jpegSegmentEnd(bytes);
  const end = jpegScanEnd(bytes, scanStart);
  if (end < bytes.length) {
    notes.push(`Dropped ${bytes.length - end} trailing bytes that followed the image data.`);
  } else if (scanStart >= bytes.length) {
    notes.push('This file has no scan data after its headers — output may not be a valid JPEG.');
  }
  parts.push(bytes.subarray(scanStart, end));

  return { bytes: concatBytes(parts), removed, notes };
};

/* ------------------------------------------------------------------- PNG -- */

/** Ancillary chunks that carry metadata rather than pixels. */
const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'caBX', 'tIME', 'sTER', 'dSIG']);

export const inspectPng = (bytes: Uint8Array): ImageInspection => {
  const inspection: ImageInspection = { fields: [], mentions: [], c2pa: false, gps: false, segments: [] };
  let offset = 8;

  while (offset + 8 <= bytes.length) {
    const length = readU32BE(bytes, offset);
    const type = ascii(bytes, offset + 4, offset + 8);
    if (offset + 12 + length > bytes.length) break;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (PNG_DROP.has(type)) inspection.segments.push(`Chunk · ${type}`);

    if (type === 'eXIf') {
      const exif = readExif(bytes, dataStart);
      inspection.fields.push(...exif.fields);
      inspection.gps = inspection.gps || exif.hasGps;
    }
    if (type === 'caBX') inspection.c2pa = true;
    if ((type === 'iTXt' || type === 'tEXt' || type === 'zTXt') && !inspection.xmp) {
      const text = toReadable(bytes.subarray(dataStart, dataEnd));
      if (/xmp|<rdf|generator|prompt|software/i.test(text)) inspection.xmp = text.slice(0, 1400);
    }

    offset += 12 + length;
    if (type === 'IEND') break;
  }

  inspection.mentions = findTextMentions(textOfFile(bytes));
  return inspection;
};

export const scrubPng = (bytes: Uint8Array): ImageScrubResult => {
  const removed: string[] = [];
  const notes: string[] = [];
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let sawIend = false;

  while (offset + 8 <= bytes.length) {
    const length = readU32BE(bytes, offset);
    const type = ascii(bytes, offset + 4, offset + 8);
    const total = 12 + length;
    if (offset + total > bytes.length) {
      notes.push('PNG ended unexpectedly — remaining bytes were preserved as-is.');
      break;
    }

    if (PNG_DROP.has(type)) {
      removed.push(`PNG ${type} chunk`);
    } else {
      parts.push(bytes.subarray(offset, offset + total));
    }

    offset += total;
    if (type === 'IEND') {
      sawIend = true;
      break;
    }
  }

  if (offset < bytes.length) {
    const trailing = bytes.subarray(offset);
    if (sawIend && trailing.length) {
      removed.push(`Trailing bytes after IEND (${trailing.length} B)`);
    } else if (!sawIend) {
      parts.push(trailing);
    }
  }

  return { bytes: concatBytes(parts), removed, notes };
};

/* ------------------------------------------------------------------ WebP -- */

export const inspectWebp = (bytes: Uint8Array): ImageInspection => {
  const inspection: ImageInspection = { fields: [], mentions: [], c2pa: false, gps: false, segments: [] };
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const fourcc = ascii(bytes, offset, offset + 4);
    const size = readU32LE(bytes, offset + 4);
    if (offset + 8 + size > bytes.length) break;

    if (fourcc === 'EXIF') {
      inspection.segments.push('Chunk · EXIF');
      const exif = readExif(bytes, offset + 8);
      inspection.fields.push(...exif.fields);
      inspection.gps = inspection.gps || exif.hasGps;
    } else if (fourcc === 'XMP ') {
      inspection.segments.push('Chunk · XMP');
      inspection.xmp = readXmpString(bytes, offset + 8, offset + 8 + size);
    } else if (fourcc === 'C2PA') {
      inspection.segments.push('Chunk · C2PA');
      inspection.c2pa = true;
    }

    offset += 8 + size + (size % 2);
  }

  inspection.mentions = findTextMentions(textOfFile(bytes));
  return inspection;
};

export const scrubWebp = (bytes: Uint8Array): ImageScrubResult => {
  const removed: string[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const fourcc = ascii(bytes, offset, offset + 4);
    const size = readU32LE(bytes, offset + 4);
    const total = 8 + size + (size % 2);
    if (offset + total > bytes.length) break;
    const chunk = bytes.slice(offset, offset + total);

    if (fourcc === 'EXIF') removed.push('WebP EXIF chunk');
    else if (fourcc === 'XMP ') removed.push('WebP XMP chunk');
    else if (fourcc === 'C2PA') removed.push('WebP C2PA chunk');
    else {
      if (fourcc === 'VP8X' && size >= 1) {
        // Clear the EXIF (0x08) and XMP (0x04) feature flags so readers stop looking.
        chunk[8] &= ~0x0c;
      }
      chunks.push(chunk);
    }

    offset += total;
  }

  const body = concatBytes(chunks);
  const out = new Uint8Array(12 + body.length);
  out.set(bytes.subarray(0, 12), 0);
  out.set(body, 12);
  writeU32LE(out, 4, out.length - 8); // RIFF size

  return { bytes: out, removed, notes: [] };
};

/* ------------------------------------------------------------------- GIF -- */

export const inspectGif = (bytes: Uint8Array): ImageInspection => {
  const inspection: ImageInspection = { fields: [], mentions: [], c2pa: false, gps: false, segments: [] };
  const text = toReadable(bytes.subarray(0, Math.min(bytes.length, 2 * 1024 * 1024)));
  if (/XMP DataXMP/.test(text)) inspection.segments.push('Application extension · XMP');
  if (/\u0021\u00fe/.test(ascii(bytes, 0, Math.min(bytes.length, 4096)))) inspection.segments.push('Comment extension');
  inspection.mentions = findTextMentions(text);
  return inspection;
};

export const scrubGif = (bytes: Uint8Array): ImageScrubResult => {
  const removed: string[] = [];
  const notes: string[] = [];
  const parts: Uint8Array[] = [];
  let offset = 6;

  parts.push(bytes.subarray(0, 6));
  if (offset + 7 > bytes.length) return { bytes, removed, notes: ['Truncated GIF header — left untouched.'] };

  const packed = bytes[offset + 4];
  let logicalHeaderEnd = offset + 7;
  if (packed & 0x80) logicalHeaderEnd += 3 * 2 ** ((packed & 0x07) + 1);
  parts.push(bytes.subarray(offset, logicalHeaderEnd));
  offset = logicalHeaderEnd;

  const skipSubBlocks = (position: number): number => {
    let cursor = position;
    while (cursor < bytes.length) {
      const size = bytes[cursor];
      cursor += 1 + size;
      if (size === 0) break;
    }
    return cursor;
  };

  while (offset < bytes.length) {
    const introducer = bytes[offset];

    if (introducer === 0x3b) {
      parts.push(bytes.subarray(offset, offset + 1));
      break;
    }

    if (introducer === 0x21) {
      const label = bytes[offset + 1];
      if (label === 0xfe) {
        removed.push('GIF comment extension');
        offset = skipSubBlocks(offset + 2);
        continue;
      }
      if (label === 0xff) {
        const blockSize = bytes[offset + 2];
        const identifier = ascii(bytes, offset + 3, offset + 3 + blockSize).split('\0')[0].trim();
        const end = skipSubBlocks(offset + 3 + blockSize);
        if (/xmp/i.test(identifier)) {
          removed.push(`GIF application extension · ${identifier || 'unknown'}`);
        } else {
          parts.push(bytes.subarray(offset, end));
        }
        offset = end;
        continue;
      }
      const end = skipSubBlocks(offset + 2);
      parts.push(bytes.subarray(offset, end));
      offset = end;
      continue;
    }

    if (introducer === 0x2c) {
      const descriptor = bytes[offset + 9];
      let end = offset + 10;
      if (descriptor & 0x80) end += 3 * 2 ** ((descriptor & 0x07) + 1);
      end = skipSubBlocks(end + 1); // LZW min code size + data sub-blocks
      parts.push(bytes.subarray(offset, end));
      offset = end;
      continue;
    }

    notes.push('Stopped early on an unrecognised GIF block; the rest of the file was copied unchanged.');
    parts.push(bytes.subarray(offset));
    break;
  }

  return { bytes: concatBytes(parts), removed, notes };
};

/* ------------------------------------------------------------------- SVG -- */

export const inspectSvg = (bytes: Uint8Array): ImageInspection => {
  const text = decodeText(bytes);
  const inspection: ImageInspection = { fields: [], mentions: [], c2pa: false, gps: false, segments: [] };
  if (/<metadata[\s>]/i.test(text)) inspection.segments.push('<metadata> element');
  if (/<xmpmeta|<rdf:RDF/i.test(text)) inspection.segments.push('Embedded XMP (RDF)');
  if (/<dc:|<cc:|<xmp:/i.test(text)) inspection.segments.push('Dublin Core / XMP namespaces');
  if (/c2pa|content credentials/i.test(text)) {
    inspection.c2pa = true;
    inspection.segments.push('C2PA marker');
  }
  if (/sodipodi|inkscape:|adobe:ns:meta/i.test(text)) inspection.segments.push('Editor namespace');
  if (/<!--/.test(text)) inspection.segments.push('XML comment(s)');
  inspection.mentions = findTextMentions(text);
  return inspection;
};

export const scrubSvg = (bytes: Uint8Array): ImageScrubResult => {
  const removed: string[] = [];
  const notes: string[] = [];
  let text = decodeText(bytes).replace(/\u0000/g, '');

  const stripAll = (regex: RegExp, label: string): void => {
    const count = (text.match(regex) ?? []).length;
    if (!count) return;
    removed.push(count === 1 ? label : `${label} ×${count}`);
    text = text.replace(regex, '');
  };

  stripAll(/<metadata[\s\S]*?<\/metadata>/gi, '<metadata> block');
  stripAll(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/gi, 'XMP packet (x:xmpmeta)');
  stripAll(/<\?xpacket[\s\S]*?\?>/gi, 'XMP packet wrapper');
  stripAll(/<rdf:RDF[\s\S]*?<\/rdf:RDF>/gi, 'RDF metadata block');
  stripAll(/<!--[\s\S]*?-->/g, 'XML comment');
  stripAll(/\s(?:sodipodi|inkscape):[a-zA-Z-]+="[^"]*"/g, 'editor attribute');
  stripAll(/<sodipodi:namedview[\s\S]*?\/>/gi, 'editor namedview');

  if (!removed.length) notes.push('No removable metadata was found in this SVG.');
  return { bytes: new TextEncoder().encode(text), removed, notes };
};
