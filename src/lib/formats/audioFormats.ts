/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Audio container scrubber: RIFF (WAV), AIFF and MPEG audio (MP3) with ID3v2.
 * All edits are byte-exact rewrites of the container chunks — the audio frames
 * themselves are copied unchanged.
 */

import { ascii, concatBytes, decodeText, readU32BE, readU32LE, toReadable, writeU32LE } from '../bytes';
import { findTextMentions, type TextMention } from '../aiSignatures';

export interface AudioInspection {
  chunks: string[];
  mentions: TextMention[];
  fields: Array<{ label: string; value: string }>;
}

export interface AudioScrubResult {
  bytes: Uint8Array;
  removed: string[];
  notes: string[];
}

const chunkLine = (chunks: string[], name: string): void => {
  if (!chunks.includes(name)) chunks.push(name);
};

/* ------------------------------------------------------------------- WAV -- */

const WAV_DROP = new Set(['LIST', 'bext', 'iXML', 'id3 ', 'ID3 ', 'XMP ', 'exif', '_PMX', 'cart', 'uuid']);

export const inspectWav = (bytes: Uint8Array): AudioInspection => {
  const chunks: string[] = [];
  const mentions: TextMention[] = [];
  const fields: Array<{ label: string; value: string }> = [];
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, offset + 4);
    const size = readU32LE(bytes, offset + 4);
    if (offset + 8 + size > bytes.length) break;
    chunkLine(chunks, id.trim());

    const body = toReadable(bytes.subarray(offset + 8, offset + 8 + Math.min(size, 4096)));
    if (id === 'LIST' || id === 'bext' || id === 'iXML' || id.trim() === 'id3' || id === 'XMP ') {
      mentions.push(...findTextMentions(body, 3));
      const chunkTitle = body.match(/\b(INAM|IART|ICMT|ISFT)\b(.{0,90})/);
      if (chunkTitle) fields.push({ label: `${id.trim()} · ${chunkTitle[1]}`, value: chunkTitle[2].trim() || '—' });
    }

    offset += 8 + size + (size % 2);
  }

  return { chunks, mentions, fields };
};

export const scrubWav = (bytes: Uint8Array): AudioScrubResult => {
  const removed: string[] = [];
  const notes: string[] = [];
  const parts: Uint8Array[] = [bytes.subarray(0, 12)];
  let offset = 12;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, offset + 4);
    const size = readU32LE(bytes, offset + 4);
    const total = 8 + size + (size % 2);
    if (offset + 8 + size > bytes.length) {
      notes.push('WAV ended unexpectedly — remaining bytes were preserved.');
      parts.push(bytes.subarray(offset));
      break;
    }

    if (WAV_DROP.has(id)) {
      removed.push(`WAV ${id.trim()} chunk`);
    } else {
      if (id === 'data') dataSize = size;
      parts.push(bytes.subarray(offset, offset + total));
    }
    offset += total;
  }

  if (offset < bytes.length) {
    const trailing = bytes.subarray(offset);
    parts.push(trailing);
    removed.push(`Trailing bytes after the last chunk (${trailing.length} B)`);
  }

  const out = concatBytes(parts);
  writeU32LE(out, 4, out.length - 8); // RIFF size
  if (dataSize) notes.push(`Audio data kept intact (${dataSize} bytes).`);
  return { bytes: out, removed, notes };
};

/* ------------------------------------------------------------------ AIFF -- */

export const inspectAiff = (bytes: Uint8Array): AudioInspection => {
  const chunks: string[] = [];
  const mentions: TextMention[] = [];
  const fields: Array<{ label: string; value: string }> = [];
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, offset + 4);
    const size = readU32BE(bytes, offset + 4);
    if (offset + 8 + size > bytes.length) break;
    chunkLine(chunks, id.trim());
    if (id === 'NAME' || id === 'AUTH' || id === 'ANNO' || id === '(c) ') {
      const text = toReadable(bytes.subarray(offset + 8, offset + 8 + Math.min(size, 2048)));
      if (text) {
        fields.push({ label: id.trim(), value: text.slice(0, 160) });
        mentions.push(...findTextMentions(text, 3));
      }
    }
    offset += 8 + size + (size % 2);
  }

  return { chunks, mentions, fields };
};

export const scrubAiff = (bytes: Uint8Array): AudioScrubResult => {
  const removed: string[] = [];
  const notes: string[] = [];
  const parts: Uint8Array[] = [bytes.subarray(0, 12)];
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, offset + 4);
    const size = readU32BE(bytes, offset + 4);
    const total = 8 + size + (size % 2);
    if (offset + 8 + size > bytes.length) {
      parts.push(bytes.subarray(offset));
      break;
    }

    if (id === 'NAME' || id === 'AUTH' || id === 'ANNO' || id === '(c) ' || id === 'ID3 ') {
      removed.push(`AIFF ${id.trim()} chunk`);
    } else {
      parts.push(bytes.subarray(offset, offset + total));
    }
    offset += total;
  }

  const out = concatBytes(parts);
  const formSize = out.length - 8;
  const header = out.subarray(0, 12);
  header[4] = (formSize >>> 24) & 0xff;
  header[5] = (formSize >>> 16) & 0xff;
  header[6] = (formSize >>> 8) & 0xff;
  header[7] = formSize & 0xff;

  return { bytes: out, removed, notes };
};

/* ------------------------------------------------------------------- MP3 -- */

export interface Id3Frame {
  id: string;
  description: string;
  size: number;
}

const ID3_UNSYNC = 0x80;
const ID3_EXTENDED = 0x40;

const synchsafe = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] & 0x7f) << 21) | ((bytes[offset + 1] & 0x7f) << 14) | ((bytes[offset + 2] & 0x7f) << 7) | (bytes[offset + 3] & 0x7f);

const ID3_FRAME_NAMES: Record<string, string> = {
  TIT2: 'Title',
  TPE1: 'Artist',
  TALB: 'Album',
  TCON: 'Genre',
  TSSE: 'Software / encoder',
  TENC: 'Encoded by',
  COMM: 'Comment',
  TXXX: 'User-defined text',
  USLT: 'Lyrics',
  APIC: 'Attached picture',
  PRIV: 'Private data',
  GEOB: 'Encapsulated object',
  WXXX: 'User-defined URL',
  WOAR: 'Artist URL',
  TCMP: 'Compilation',
  CHAP: 'Chapter',
};

export const stripEncoding = (text: string): string => {
  const body = text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return body.length > 160 ? `${body.slice(0, 159)}…` : body;
};

export const inspectId3 = (bytes: Uint8Array): { version: string; frames: Id3Frame[]; mentions: TextMention[] } => {
  const frames: Id3Frame[] = [];
  const mentions: TextMention[] = [];
  if (ascii(bytes, 0, 3) !== 'ID3') return { version: '', frames, mentions };

  const major = bytes[3];
  const minor = bytes[4];
  const flags = bytes[5];
  const tagSize = synchsafe(bytes, 6);
  let offset = 10;

  if (flags & ID3_EXTENDED) {
    if (major >= 4) {
      const extSize = synchsafe(bytes, offset);
      offset += extSize;
    } else {
      const extended = readU32BE(bytes, offset);
      offset += 4 + extended;
    }
  }

  const frameHeader = major === 2 ? 6 : 10;
  const end = Math.min(10 + tagSize, bytes.length);

  while (offset + frameHeader <= end) {
    const idLength = major === 2 ? 3 : 4;
    const id = ascii(bytes, offset, offset + idLength);
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break;

    let size: number;
    if (major === 2) {
      size = (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5];
    } else if (major === 4) {
      size = synchsafe(bytes, offset + 4);
    } else {
      size = readU32BE(bytes, offset + 4);
    }
    if (size <= 0 || offset + frameHeader + size > end) break;

    const frameId = major === 2 ? { TIT2: 'TT2', TPE1: 'TP1', TALB: 'TAL', TCON: 'TCO', TSSE: 'TSS', COMM: 'COM', TXXX: 'TXX' }[id] ?? id : id;
    const body = bytes.subarray(offset + frameHeader, offset + frameHeader + size);
    const encoding = body[0];

    let text = '';
    try {
      if (encoding === 1 || encoding === 2) {
        text = new TextDecoder(encoding === 1 ? 'utf-16le' : 'utf-16be', { fatal: false }).decode(body.subarray(1));
      } else {
        text = decodeText(body.subarray(1));
      }
    } catch {
      text = toReadable(body);
    }

    frames.push({ id: frameId, description: ID3_FRAME_NAMES[frameId] ?? 'Metadata frame', size });
    const clean = stripEncoding(text);
    if (clean) mentions.push(...findTextMentions(clean, 2));
    offset += frameHeader + size;
  }

  const tagText = toReadable(bytes.subarray(0, Math.min(end, 512 * 1024)));
  mentions.push(...findTextMentions(tagText, 4));

  return { version: `ID3v2.${major}.${minor}`, frames, mentions };
};

export const scrubMp3 = (bytes: Uint8Array): AudioScrubResult => {
  const removed: string[] = [];
  const notes: string[] = [];
  let start = 0;

  if (ascii(bytes, 0, 3) === 'ID3') {
    const flags = bytes[5];
    const size = synchsafe(bytes, 6);
    let end = 10 + size;
    if (flags & 0x10) end += 10; // ID3v2.4 footer
    if (end > bytes.length) end = bytes.length;
    removed.push(`ID3v2 tag (${end - start} B)`);
    start = end;
  }

  const end = bytes.length;
  // Trailing ID3v1 (128 B "TAG") and Lyrics3 blocks.
  let trimmedEnd = end;
  if (end - start >= 128 && ascii(bytes, end - 128, end - 125) === 'TAG') {
    trimmedEnd = end - 128;
    removed.push('ID3v1 tag (128 B)');
  }
  const lyricsIndex = ascii(bytes, Math.max(start, trimmedEnd - 5100), trimmedEnd).indexOf('LYRICSBEGIN');
  if (lyricsIndex >= 0) {
    trimmedEnd = Math.max(start, trimmedEnd - 5100) + lyricsIndex;
    removed.push('Lyrics3 tag');
  }
  const apeIndex = ascii(bytes, Math.max(start, trimmedEnd - 64), trimmedEnd).lastIndexOf('APETAGEX');
  if (apeIndex >= 0) {
    // APE tags sit at the very end; keep it simple and drop the tail from the marker.
    const absolute = Math.max(start, trimmedEnd - 64) + apeIndex;
    trimmedEnd = Math.min(trimmedEnd, absolute);
    removed.push('APEv2 tag');
  }

  if (trimmedEnd <= start) {
    notes.push('Every byte of this file was tag data; the output is empty.');
    return { bytes: new Uint8Array(0), removed, notes };
  }

  if (!removed.length) notes.push('No ID3 or APE tags were found in this audio file.');

  return { bytes: bytes.slice(start, trimmedEnd), removed, notes };
};
