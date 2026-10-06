/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A deliberately small EXIF (TIFF IFD) reader — enough to *report* what a file
 * carries so the cleaner can show it before removing it.
 */

import { ascii, readU16BE, readU32BE, toReadable } from './bytes';

export interface ExifField {
  label: string;
  value: string;
}

const IFD0_TAGS: Record<number, string> = {
  0x0100: 'ImageWidth',
  0x0101: 'ImageHeight',
  0x010e: 'ImageDescription',
  0x010f: 'Make',
  0x0110: 'Model',
  0x0112: 'Orientation',
  0x011a: 'XResolution',
  0x011b: 'YResolution',
  0x0128: 'ResolutionUnit',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x013b: 'Artist',
  0x013e: 'WhitePoint',
  0x013f: 'PrimaryChromaticities',
  0x0201: 'JPEGInterchangeFormat',
  0x0202: 'JPEGInterchangeFormatLength',
  0x0211: 'YCbCrCoefficients',
  0x0213: 'YCbCrPositioning',
  0x8298: 'Copyright',
  0x8769: 'ExifIFDPointer',
  0x8825: 'GPSInfoIFDPointer',
  0x9003: 'DateTimeOriginal',
  0x9c9b: 'XPTitle',
  0x9c9c: 'XPComment',
  0x9c9d: 'XPAuthor',
  0x9c9e: 'XPKeywords',
  0x9c9f: 'XPSubject',
  0xc4a5: 'PrintImageMatching',
  0x9286: 'UserComment',
  0xa430: 'CameraOwnerName',
  0xa431: 'BodySerialNumber',
  0xa432: 'LensSpecification',
  0xa433: 'LensMake',
  0xa434: 'LensModel',
  0xa435: 'LensSerialNumber',
};

const EXIF_TAGS: Record<number, string> = {
  0x829a: 'ExposureTime',
  0x829d: 'FNumber',
  0x8822: 'ExposureProgram',
  0x8827: 'ISOSpeedRatings',
  0x9000: 'ExifVersion',
  0x9003: 'DateTimeOriginal',
  0x9004: 'DateTimeDigitized',
  0x9101: 'ComponentsConfiguration',
  0x9102: 'CompressedBitsPerPixel',
  0x9201: 'ShutterSpeedValue',
  0x9202: 'ApertureValue',
  0x9204: 'ExposureBiasValue',
  0x9205: 'MaxApertureValue',
  0x9207: 'MeteringMode',
  0x9209: 'Flash',
  0x920a: 'FocalLength',
  0x927c: 'MakerNote',
  0x9286: 'UserComment',
  0x9290: 'SubSecTime',
  0xa000: 'FlashpixVersion',
  0xa001: 'ColorSpace',
  0xa002: 'PixelXDimension',
  0xa003: 'PixelYDimension',
  0xa004: 'RelatedSoundFile',
  0xa005: 'InteroperabilityOffset',
  0xa402: 'ExposureMode',
  0xa403: 'WhiteBalance',
  0xa406: 'SceneCaptureType',
  0xa420: 'ImageUniqueID',
  0xa433: 'LensMake',
  0xa434: 'LensModel',
  0xa435: 'LensSerialNumber',
  0xa460: 'CompositeImage',
};

const GPS_TAGS: Record<number, string> = {
  0x0000: 'GPSVersionID',
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
  0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude',
  0x0007: 'GPSTimeStamp',
  0x0012: 'GPSMapDatum',
  0x001b: 'GPSProcessingMethod',
  0x001d: 'GPSDateStamp',
};

const TYPE_SIZES: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  6: 1, // SBYTE
  7: 1, // UNDEFINED
  8: 2, // SSHORT
  9: 4, // SLONG
  10: 8, // SRATIONAL
  11: 4, // FLOAT
  12: 8, // DOUBLE
};

const shorten = (value: string, max = 120): string => {
  const cleaned = toReadable(new TextEncoder().encode(value)).replace(/\u0000/g, ' ').trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trimEnd()}…` : cleaned;
};

export interface ExifResult {
  fields: ExifField[];
  hasGps: boolean;
  hasThumbnail: boolean;
}

/**
 * Reads an EXIF block. `tiffStart` points at the byte-order marker ("II"/"MM").
 */
export const readExif = (bytes: Uint8Array, tiffStart: number, limit = tiffStart + 262144): ExifResult => {
  const fields: ExifField[] = [];
  let hasGps = false;
  let hasThumbnail = false;

  if (tiffStart + 8 > bytes.length) return { fields, hasGps, hasThumbnail };

  const order = ascii(bytes, tiffStart, tiffStart + 2);
  const little = order === 'II';
  if (!little && order !== 'MM') return { fields, hasGps, hasThumbnail };

  const u16 = (offset: number) =>
    little ? bytes[offset] | (bytes[offset + 1] << 8) : readU16BE(bytes, offset);
  const u32 = (offset: number) =>
    little
      ? (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
      : readU32BE(bytes, offset);

  if (u16(tiffStart + 2) !== 0x002a) return { fields, hasGps, hasThumbnail };

  const readValue = (type: number, count: number, valueOffset: number): string => {
    const size = (TYPE_SIZES[type] ?? 1) * count;
    const dataStart = size <= 4 ? valueOffset : tiffStart + u32(valueOffset);
    if (dataStart + size > bytes.length || dataStart < 0) return '';

    if (type === 2) return shorten(ascii(bytes, dataStart, dataStart + count).replace(/\u0000+$/, ''));
    if (type === 7) {
      const raw = ascii(bytes, dataStart, dataStart + count);
      // UserComment carries an 8-byte charset prefix.
      const body = /^(ASCII|UNICODE|JIS)\u0000/.test(raw) ? raw.slice(8) : raw;
      return shorten(body.replace(/[\u0000-\u001f]/g, ' '));
    }

    const values: string[] = [];
    for (let i = 0; i < Math.min(count, 6); i += 1) {
      if (type === 3 || type === 8) {
        const raw = u16(dataStart + i * 2);
        values.push(String(type === 8 && raw > 0x7fff ? raw - 0x10000 : raw));
      } else if (type === 4 || type === 9) {
        const raw = u32(dataStart + i * 4);
        values.push(String(type === 9 && raw > 0x7fffffff ? raw - 0x100000000 : raw));
      } else if (type === 5) {
        const numerator = u32(dataStart + i * 8);
        const denominator = u32(dataStart + i * 8 + 4);
        values.push(denominator ? `${numerator}/${denominator}` : String(numerator));
      } else if (type === 10) {
        const numerator = u32(dataStart + i * 8) | 0;
        const denominator = u32(dataStart + i * 8 + 4) | 0;
        values.push(denominator ? `${numerator}/${denominator}` : String(numerator));
      } else if (type === 1 || type === 6) {
        values.push(String(bytes[dataStart + i]));
      } else if (type === 11) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + dataStart + i * 4, 4);
        values.push(String(view.getFloat32(0, little)));
      } else if (type === 12) {
        const view = new DataView(bytes.buffer, bytes.byteOffset + dataStart + i * 8, 8);
        values.push(String(view.getFloat64(0, little)));
      }
    }
    return shorten(values.join(', '));
  };

  const readIfd = (ifdOffset: number, tags: Record<number, string>, group: string, depth = 0): void => {
    if (depth > 2 || ifdOffset <= 0) return;
    const absolute = tiffStart + ifdOffset;
    if (absolute + 2 > bytes.length || absolute > limit) return;

    const count = u16(absolute);
    if (count > 512) return;

    for (let i = 0; i < count; i += 1) {
      const entry = absolute + 2 + i * 12;
      if (entry + 12 > bytes.length) return;
      const tag = u16(entry);
      const type = u16(entry + 2);
      const valueCount = u32(entry + 4);
      const valueOffset = entry + 8;
      const name = tags[tag];

      if (tag === 0x8769) {
        readIfd(u32(valueOffset), EXIF_TAGS, 'Exif', depth + 1);
        continue;
      }
      if (tag === 0x8825) {
        hasGps = true;
        readIfd(u32(valueOffset), GPS_TAGS, 'GPS', depth + 1);
        continue;
      }
      if (tags === IFD0_TAGS && (tag === 0x0201 || tag === 0x0202)) {
        hasThumbnail = true;
        continue;
      }
      if (!name || name === 'ExifIFDPointer' || name === 'GPSInfoIFDPointer' || name === 'MakerNote') continue;

      const value = readValue(type, valueCount, valueOffset);
      if (!value) continue;

      fields.push({
        label: group === 'GPS' ? `GPS:${name}` : group === 'Exif' ? `Exif:${name}` : name,
        value,
      });
    }

    const next = u32(absolute + 2 + count * 12);
    if (next && tags === IFD0_TAGS) readIfd(next, IFD0_TAGS, 'IFD1', depth + 1);
  };

  readIfd(u32(tiffStart + 4), IFD0_TAGS, 'IFD0');
  return { fields, hasGps, hasThumbnail };
};
