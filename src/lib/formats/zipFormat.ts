/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Minimal ZIP reader/writer used by the Office cleaner. Entries are read
 * lazily; only the parts that carry metadata are rewritten, every other member
 * is copied through untouched (with its original compression method).
 */

import {
  ascii,
  concatBytes,
  crc32,
  rawZipStreams,
  readU16LE,
  readU32LE,
  writeU16LE,
  writeU32LE,
} from '../bytes';

export interface ZipEntry {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  isDirectory: boolean;
  zip64?: boolean;
  zip64Extra?: Uint8Array;
}

export interface ZipArchive {
  bytes: Uint8Array;
  entries: ZipEntry[];
  comment: string;
}

const EMPTY_CRC = 0;

export const isZip = (bytes: Uint8Array): boolean =>
  bytes.length > 4 && (readU32LE(bytes, 0) === 0x04034b50 || readU32LE(bytes, 0) === 0x06054b50);

const findEocd = (bytes: Uint8Array): number => {
  const min = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= min; i -= 1) {
    if (readU32LE(bytes, i) === 0x06054b50) return i;
  }
  return -1;
};

export const readZip = (bytes: Uint8Array): ZipArchive => {
  const eocd = findEocd(bytes);
  if (eocd < 0) throw new Error('This file is not a readable ZIP archive.');

  let entryCount = readU16LE(bytes, eocd + 10);
  let centralOffset = readU32LE(bytes, eocd + 16);
  const commentLength = readU16LE(bytes, eocd + 20);
  const comment = ascii(bytes, eocd + 22, eocd + 22 + commentLength);

  // ZIP64 end-of-central-directory locator
  if (centralOffset === 0xffffffff || entryCount === 0xffff) {
    for (let i = eocd - 20; i >= 0; i -= 1) {
      if (readU32LE(bytes, i) === 0x07064b50) {
        const zip64Eocd = Number(bytes[i + 8]) | (Number(bytes[i + 9]) << 8) | (Number(bytes[i + 10]) << 16) | (Number(bytes[i + 11]) << 24);
        if (readU32LE(bytes, zip64Eocd) === 0x06064b50) {
          entryCount = Number(readU32LE(bytes, zip64Eocd + 32));
          centralOffset = readU32LE(bytes, zip64Eocd + 48);
        }
        break;
      }
    }
  }

  const entries: ZipEntry[] = [];
  let offset = centralOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > bytes.length || readU32LE(bytes, offset) !== 0x02014b50) break;
    const flags = readU16LE(bytes, offset + 8);
    const method = readU16LE(bytes, offset + 10);
    const crc = readU32LE(bytes, offset + 16);
    const compressedSize = readU32LE(bytes, offset + 20);
    const uncompressedSize = readU32LE(bytes, offset + 24);
    const nameLength = readU16LE(bytes, offset + 28);
    const extraLength = readU16LE(bytes, offset + 30);
    const commentLen = readU16LE(bytes, offset + 32);
    const localHeaderOffset = readU32LE(bytes, offset + 42);
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const name = new TextDecoder('utf-8', { fatal: false }).decode(nameBytes);
    const extra = bytes.subarray(offset + 46 + nameLength, offset + 46 + nameLength + extraLength);

    // Locate the real sizes inside the ZIP64 extra field when needed.
    let realUncompressed = uncompressedSize;
    let realCompressed = compressedSize;
    let realOffset = localHeaderOffset;
    let zip64 = false;
    if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      zip64 = true;
      let cursor = 0;
      while (cursor + 4 <= extra.length) {
        const headerId = readU16LE(extra, cursor);
        const dataSize = readU16LE(extra, cursor + 2);
        if (headerId === 0x0001) {
          const data = extra.subarray(cursor + 4, cursor + 4 + dataSize);
          let position = 0;
          const read64 = () => {
            const low = readU32LE(data, position);
            const high = readU32LE(data, position + 4);
            position += 8;
            return high * 0x100000000 + low;
          };
          if (uncompressedSize === 0xffffffff) realUncompressed = read64();
          if (compressedSize === 0xffffffff) realCompressed = read64();
          if (localHeaderOffset === 0xffffffff) realOffset = read64();
          break;
        }
        cursor += 4 + dataSize;
      }
    }

    entries.push({
      name,
      method,
      crc,
      compressedSize: realCompressed,
      uncompressedSize: realUncompressed,
      localHeaderOffset: realOffset,
      isDirectory: name.endsWith('/'),
      zip64,
      zip64Extra: zip64 ? extra : undefined,
    });

    void flags;
    offset += 46 + nameLength + extraLength + commentLen;
  }

  return { bytes, entries, comment };
};

/** Extracts the raw (compressed) payload of a member. */
export const rawEntryData = (archive: ZipArchive, entry: ZipEntry): Uint8Array => {
  const { bytes } = archive;
  const offset = entry.localHeaderOffset;
  if (readU32LE(bytes, offset) !== 0x04034b50) throw new Error(`Corrupt local header for ${entry.name}`);
  const nameLength = readU16LE(bytes, offset + 26);
  const extraLength = readU16LE(bytes, offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  return bytes.subarray(start, start + entry.compressedSize);
};

export const readEntryData = async (archive: ZipArchive, entry: ZipEntry): Promise<Uint8Array> => {
  const raw = rawEntryData(archive, entry);
  if (entry.method === 0) return raw;
  if (entry.method !== 8) throw new Error(`Unsupported compression method (${entry.method}) for ${entry.name}`);

  const streams = rawZipStreams();
  if (!streams.inflateRaw) {
    throw new Error('This browser cannot decompress ZIP members (DecompressionStream is unavailable).');
  }
  return streams.inflateRaw(raw);
};

export const readEntryText = async (archive: ZipArchive, entry: ZipEntry): Promise<string> => {
  const data = await readEntryData(archive, entry);
  return new TextDecoder('utf-8', { fatal: false }).decode(data);
};

export interface ZipWriteEntry {
  /** Original entry when the member is copied through unchanged. */
  source?: { archive: ZipArchive; entry: ZipEntry };
  name: string;
  data?: Uint8Array;
  method?: number;
  modifiedTime?: number;
  modifiedDate?: number;
}

const DOS_TIME = 0x6000; // 12:00:00
const DOS_DATE = 0x5900 + 0x20; // 2025-01-01 (approximate, only affects listing)

const crcOf = (data: Uint8Array): number => crc32(data);

const buildLocalHeader = (name: Uint8Array, method: number, crc: number, compressedSize: number, size: number): Uint8Array => {
  const header = new Uint8Array(30);
  writeU32LE(header, 0, 0x04034b50);
  writeU16LE(header, 4, 20); // version needed
  writeU16LE(header, 6, 0x0800); // UTF-8 names
  writeU16LE(header, 8, method);
  writeU16LE(header, 10, method === 8 ? DOS_TIME : 0);
  writeU16LE(header, 12, DOS_DATE);
  writeU32LE(header, 14, crc);
  writeU32LE(header, 18, compressedSize);
  writeU32LE(header, 22, size);
  writeU16LE(header, 26, name.length);
  writeU16LE(header, 28, 0);
  return header;
};

/**
 * Writes a new ZIP. Unchanged members are copied byte-for-byte; modified ones
 * are re-deflated (falling back to stored when CompressionStream is missing).
 */
export const writeZip = async (entries: ZipWriteEntry[]): Promise<Uint8Array> => {
  const streams = rawZipStreams();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];

  const prepared: Array<{
    name: Uint8Array;
    method: number;
    crc: number;
    compressedSize: number;
    size: number;
    payload: Uint8Array;
    localOffset: number;
  }> = [];

  for (const item of entries) {
    const nameBytes = new TextEncoder().encode(item.name);
    if (item.source) {
      const { archive, entry } = item.source;
      const payload = rawEntryData(archive, entry);
      prepared.push({
        name: nameBytes,
        method: entry.method,
        crc: entry.crc,
        compressedSize: entry.compressedSize,
        size: entry.uncompressedSize,
        payload,
        localOffset: 0,
      });
    } else {
      const data = item.data ?? new Uint8Array(0);
      let method = item.method ?? 8;
      let payload: Uint8Array;
      if (method === 8 && streams.deflateRaw && data.length > 0) {
        payload = await streams.deflateRaw(data);
      } else {
        method = 0;
        payload = data;
      }
      prepared.push({
        name: nameBytes,
        method,
        crc: data.length === 0 ? EMPTY_CRC : crcOf(data),
        compressedSize: payload.length,
        size: data.length,
        payload,
        localOffset: 0,
      });
    }
  }

  let cursor = 0;
  for (const item of prepared) {
    item.localOffset = cursor;
    const header = buildLocalHeader(item.name, item.method, item.crc, item.compressedSize, item.size);
    parts.push(header, item.name, item.payload);
    cursor += header.length + item.name.length + item.payload.length;
  }

  const centralStart = cursor;

  for (const item of prepared) {
    const header = new Uint8Array(46);
    writeU32LE(header, 0, 0x02014b50);
    writeU16LE(header, 4, 20); // version made by
    writeU16LE(header, 6, 20); // version needed
    writeU16LE(header, 8, 0x0800);
    writeU16LE(header, 10, item.method);
    writeU16LE(header, 12, item.method === 8 ? DOS_TIME : 0);
    writeU16LE(header, 14, DOS_DATE);
    writeU32LE(header, 16, item.crc);
    writeU32LE(header, 20, item.compressedSize);
    writeU32LE(header, 24, item.size);
    writeU16LE(header, 28, item.name.length);
    writeU16LE(header, 30, 0);
    writeU16LE(header, 32, 0);
    writeU16LE(header, 34, 0);
    writeU16LE(header, 36, 0);
    writeU32LE(header, 38, 0); // member starts here
    writeU32LE(header, 42, item.localOffset);
    central.push(header, item.name);
    cursor += header.length + item.name.length;
  }

  const centralSize = cursor - centralStart;
  const eocd = new Uint8Array(22);
  writeU32LE(eocd, 0, 0x06054b50);
  writeU16LE(eocd, 4, 0);
  writeU16LE(eocd, 6, 0);
  writeU16LE(eocd, 8, prepared.length);
  writeU16LE(eocd, 10, prepared.length);
  writeU32LE(eocd, 12, centralSize);
  writeU32LE(eocd, 16, centralStart);
  writeU16LE(eocd, 20, 0);

  return concatBytes([...parts, ...central, eocd]);
};

export const zipEntryNames = (archive: ZipArchive): string[] => archive.entries.map((entry) => entry.name);
