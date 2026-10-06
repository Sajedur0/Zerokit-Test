/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Small byte helpers shared by the metadata scrubbers. Everything here works
 * on plain Uint8Array values so it can run inside a worker-less browser tab.
 */

export const ascii = (bytes: Uint8Array, start = 0, end = bytes.length): string => {
  let out = '';
  for (let i = start; i < end; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
};

export const decodeText = (bytes: Uint8Array, start = 0, end = bytes.length): string => {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(start, end));
  } catch {
    return ascii(bytes, start, end);
  }
};

export const readU16BE = (bytes: Uint8Array, offset: number): number => (bytes[offset] << 8) | bytes[offset + 1];

export const readU16LE = (bytes: Uint8Array, offset: number): number => (bytes[offset + 1] << 8) | bytes[offset];

export const readU32BE = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;

export const readU32LE = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset + 3] << 24) | (bytes[offset + 2] << 16) | (bytes[offset + 1] << 8) | bytes[offset]) >>> 0;

export const readI32BE = (bytes: Uint8Array, offset: number): number => (readU32BE(bytes, offset) << 0) as number;

export const readU64BE = (bytes: Uint8Array, offset: number): number => {
  const high = readU32BE(bytes, offset);
  const low = readU32BE(bytes, offset + 4);
  return high * 0x100000000 + low;
};

export const writeU16LE = (bytes: Uint8Array, offset: number, value: number): void => {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
};

export const writeU32LE = (bytes: Uint8Array, offset: number, value: number): void => {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
};

export const writeU32BE = (bytes: Uint8Array, offset: number, value: number): void => {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
};

export const concatBytes = (parts: Array<Uint8Array | number[]>): Uint8Array => {
  const arrays = parts.map((part) => (part instanceof Uint8Array ? part : new Uint8Array(part)));
  const total = arrays.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of arrays) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

/** Case-insensitive-ish search for an ASCII needle inside a byte range. */
export const indexOfNeedle = (
  bytes: Uint8Array,
  needle: string,
  from = 0,
  to = bytes.length,
): number => {
  const limit = Math.max(0, Math.min(to, bytes.length) - needle.length);
  outer: for (let i = from; i <= limit; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (bytes[i + j] !== needle.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
};

export const startsWithBytes = (bytes: Uint8Array, offset: number, needle: string | number[]): boolean => {
  const codes = typeof needle === 'string' ? Array.from(needle).map((c) => c.charCodeAt(0)) : needle;
  if (offset + codes.length > bytes.length) return false;
  for (let i = 0; i < codes.length; i += 1) {
    if (bytes[offset + i] !== codes[i]) return false;
  }
  return true;
};

/** TextDecoder that never throws on binary soup. */
export const toReadable = (bytes: Uint8Array): string =>
  decodeText(bytes)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

export interface StreamSupport {
  inflateRaw?: (data: Uint8Array) => Promise<Uint8Array>;
  deflateRaw?: (data: Uint8Array) => Promise<Uint8Array>;
}

const pipeThrough = async (data: Uint8Array, transform: TransformStream<Uint8Array, Uint8Array>): Promise<Uint8Array> => {
  const source = new Blob([data as unknown as BlobPart]).stream();
  const stream = source.pipeThrough(transform as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
};

export const rawZipStreams = (): StreamSupport => {
  const support: StreamSupport = {};
  const globalScope = globalThis as unknown as {
    DecompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array>;
    CompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array>;
  };

  if (typeof globalScope.DecompressionStream === 'function') {
    support.inflateRaw = (data) => pipeThrough(data, new globalScope.DecompressionStream!('deflate-raw'));
  }
  if (typeof globalScope.CompressionStream === 'function') {
    support.deflateRaw = (data) => pipeThrough(data, new globalScope.CompressionStream!('deflate-raw'));
  }
  return support;
};

export const formatBytes = (size: number): string => {
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};
