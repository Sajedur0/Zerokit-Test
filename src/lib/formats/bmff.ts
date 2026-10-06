/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ISO-BMFF (ISO base media file format) scrubber: MP4, MOV, M4A, HEIC, HEIF,
 * AVIF. Metadata lives in `uuid` boxes (C2PA / XMP), `udta` atoms and
 * QuickTime `meta` boxes.
 *
 * Removal is done in place — the target box is re-typed to `free` and its
 * payload is zero-filled — so every byte offset (stco/co64/iloc tables) stays
 * valid and the media remains playable.
 */

import { ascii, readU32BE, readU64BE, writeU32BE, toReadable } from '../bytes';
import { C2PA_BMFF_UUID, C2PA_BMFF_UUID_ALT, XMP_BMFF_UUID } from '../aiSignatures';

const CONTAINERS = new Set([
  'moov',
  'trak',
  'mdia',
  'minf',
  'stbl',
  'moof',
  'traf',
  'mvex',
  'edts',
  'dinf',
  'mfra',
  'schi',
  'sinf',
  'wave',
]);

/** Boxes that hold description text rather than media structure. */
const TEXT_ATOMS = new Set(['©too', '©nam', '©cmt', '©des', '©day', '©ART', '©alb', '©gen', '©wrt', '©aut', '©cpy', '©enc']);

export interface BmffResult {
  bytes: Uint8Array;
  removed: string[];
  notes: string[];
  found: string[];
}

interface BoxView {
  offset: number;
  size: number;
  headerSize: number;
  type: string;
  userType?: string;
}

const uuidMatches = (payload: Uint8Array, offset: number, uuid: number[]): boolean => {
  for (let i = 0; i < uuid.length; i += 1) {
    if (payload[offset + i] !== uuid[i]) return false;
  }
  return true;
};

const formatUuid = (bytes: Uint8Array, offset: number): string => {
  const hex = ascii(bytes, offset, offset + 16)
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Reads the handler type of a `meta` box (FullBox: 4 bytes version/flags first). */
const metaHandlerType = (bytes: Uint8Array, contentStart: number, contentEnd: number): string | null => {
  let offset = contentStart + 4;
  while (offset + 8 <= contentEnd) {
    const size = readU32BE(bytes, offset);
    const type = ascii(bytes, offset + 4, offset + 8);
    const boxSize = size === 0 ? contentEnd - offset : size;
    if (boxSize < 8 || offset + boxSize > contentEnd) break;
    if (type === 'hdlr' && boxSize >= 8 + 12 + 4) {
      // version/flags (4) + pre_defined (4) + handler_type (4)
      return ascii(bytes, offset + 8 + 8, offset + 8 + 12);
    }
    offset += boxSize;
  }
  return null;
};

const labelForBox = (box: BoxView, bytes: Uint8Array): string | null => {
  if (box.type === 'uuid') {
    if (box.userType && uuidMatches(bytes, box.offset + box.headerSize - 16, C2PA_BMFF_UUID)) {
      return 'C2PA Content Credentials (uuid box)';
    }
    if (box.userType && uuidMatches(bytes, box.offset + box.headerSize - 16, C2PA_BMFF_UUID_ALT)) {
      return 'C2PA Content Credentials (uuid box, legacy)';
    }
    if (box.userType && uuidMatches(bytes, box.offset + box.headerSize - 16, XMP_BMFF_UUID)) {
      return 'XMP metadata (uuid box)';
    }
    const payload = toReadable(bytes.subarray(box.offset + box.headerSize, box.offset + box.size));
    if (/\bc2pa\b|jumbf|content credentials/i.test(payload)) return 'C2PA / JUMBF metadata (uuid box)';
    return null;
  }
  if (box.type === 'udta') return 'User-data atom (udta)';
  if (box.type === 'XMP_') return 'XMP atom (XMP_)';
  if (box.type === 'meta') {
    const handler = metaHandlerType(bytes, box.offset + box.headerSize, box.offset + box.size);
    if (handler === 'mdta' || handler === 'mdir') return 'QuickTime metadata (meta)';
    return null;
  }
  if (TEXT_ATOMS.has(box.type)) return `Metadata atom (${box.type})`;
  return null;
};

/**
 * Walks the box tree and blanks the metadata boxes it recognises.
 */
export const scrubBmff = (bytes: Uint8Array): BmffResult => {
  const out = bytes.slice();
  const removed: string[] = [];
  const notes: string[] = [];
  const found: string[] = [];

  const zeroBox = (box: BoxView): void => {
    const usesLargeSize = box.headerSize === 16 || (box.type === 'uuid' && readU32BE(out, box.offset) === 1);
    if (usesLargeSize) {
      writeU32BE(out, box.offset, 1);
      out.set(new TextEncoder().encode('free'), box.offset + 4);
      writeU32BE(out, box.offset + 8, Math.floor(box.size / 0x100000000));
      writeU32BE(out, box.offset + 12, box.size >>> 0);
      out.fill(0, box.offset + 16, box.offset + box.size);
    } else {
      writeU32BE(out, box.offset, box.size);
      out.set(new TextEncoder().encode('free'), box.offset + 4);
      out.fill(0, box.offset + 8, box.offset + box.size);
    }
  };

  const walk = (start: number, end: number, depth: number): void => {
    if (depth > 6) return;
    let offset = start;

    while (offset + 8 <= end) {
      let size = readU32BE(out, offset);
      const type = ascii(out, offset + 4, offset + 8);
      let headerSize = 8;

      if (size === 1) {
        if (offset + 16 > end) break;
        size = readU64BE(out, offset + 8);
        headerSize = 16;
      } else if (size === 0) {
        size = end - offset;
      }

      if (size < headerSize || offset + size > end) break;

      const box: BoxView = { offset, size, headerSize, type };
      if (type === 'uuid') {
        if (headerSize + 16 > size) break;
        box.userType = formatUuid(out, offset + headerSize);
        headerSize += 16;
        box.headerSize = headerSize;
      }

      const label = labelForBox(box, out);
      if (label) {
        zeroBox(box);
        removed.push(label);
        found.push(label);
      } else if (CONTAINERS.has(type)) {
        walk(offset + headerSize, offset + size, depth + 1);
      }

      offset += size;
    }
  };

  walk(0, out.length, 0);

  const leftovers = toReadable(out.subarray(0, Math.min(out.length, 4 * 1024 * 1024)));
  if (/\bc2pa\b|jumbf/i.test(leftovers) && !removed.some((item) => /C2PA/i.test(item))) {
    notes.push('A C2PA/JUMBF marker is still present inside a box this cleaner does not rewrite.');
  }
  if (/application\/rdf\+xml|<x:xmpmeta/i.test(leftovers) && !removed.some((item) => /XMP/i.test(item))) {
    notes.push('XMP data appears to live inside the image item table (HEIC/AVIF), which cannot be unlinked without rebuilding the file.');
  }

  return { bytes: out, removed, notes, found };
};

export interface BmffInspection {
  found: string[];
  c2pa: boolean;
  xmp: boolean;
  brands: string[];
}

export const inspectBmff = (bytes: Uint8Array): BmffInspection => {
  const found: string[] = [];
  const brands: string[] = [];
  let c2pa = false;
  let xmp = false;

  const walk = (start: number, end: number, depth: number): void => {
    if (depth > 5) return;
    let offset = start;
    while (offset + 8 <= end) {
      let size = readU32BE(bytes, offset);
      const type = ascii(bytes, offset + 4, offset + 8);
      let headerSize = 8;
      if (size === 1) {
        if (offset + 16 > end) break;
        size = readU64BE(bytes, offset + 8);
        headerSize = 16;
      } else if (size === 0) size = end - offset;
      if (size < headerSize || offset + size > end) break;

      if (type === 'ftyp') {
        const major = ascii(bytes, offset + 8, offset + 12);
        brands.push(major);
        for (let i = offset + 16; i + 4 <= offset + size; i += 4) {
          const brand = ascii(bytes, i, i + 4);
          if (/^(heic|heix|avif|mif1|msf1|mp4|qt|M4A|M4V|isom)/i.test(brand)) brands.push(brand);
        }
      }

      if (type === 'uuid') {
        const userType = formatUuid(bytes, offset + headerSize);
        const box: BoxView = { offset, size, headerSize: headerSize + 16, type, userType };
        const label = labelForBox(box, bytes);
        if (label) {
          found.push(label);
          if (/C2PA/i.test(label)) c2pa = true;
          if (/XMP/i.test(label)) xmp = true;
        }
      } else if (type === 'udta' || type === 'XMP_') {
        const box: BoxView = { offset, size, headerSize, type };
        const label = labelForBox(box, bytes);
        if (label) found.push(label);
        if (type === 'udta') {
          // List the individual atoms so the report names what is inside.
          let cursor = offset + headerSize;
          while (cursor + 8 <= offset + size) {
            const childSize = readU32BE(bytes, cursor);
            const childType = ascii(bytes, cursor + 4, cursor + 8);
            if (childSize < 8 || cursor + childSize > offset + size) break;
            found.push(`udta · ${childType}`);
            cursor += childSize;
          }
        }
      } else if (type === 'meta') {
        const box: BoxView = { offset, size, headerSize, type };
        const label = labelForBox(box, bytes);
        if (label) found.push(label);
      }

      if (CONTAINERS.has(type) || type === 'meta') {
        walk(offset + (type === 'meta' ? headerSize + 4 : headerSize), offset + size, depth + 1);
      }

      offset += size;
    }
  };

  walk(0, bytes.length, 0);
  return { found, c2pa, xmp, brands };
};
