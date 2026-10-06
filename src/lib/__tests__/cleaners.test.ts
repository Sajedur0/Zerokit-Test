/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Fixture-driven tests for the AI metadata cleaner. Each fixture is a
 * hand-built file with real container structure plus AI/C2PA metadata, so the
 * scrubbers are checked against actual bytes rather than mocks.
 */

import { describe, expect, it } from 'vitest';
import { ascii, concatBytes, crc32, indexOfNeedle, readU32LE, writeU32LE } from '../bytes';
import { inspectJpeg, scrubJpeg, inspectPng, scrubPng, scrubWebp, scrubGif, scrubSvg, inspectGif } from '../formats/imageFormats';
import { scrubBmff, inspectBmff } from '../formats/bmff';
import { inspectId3, scrubMp3, scrubWav, inspectWav } from '../formats/audioFormats';
import { scrubPdf, inspectPdf } from '../formats/pdfFormat';
import { scrubOffice, inspectOffice } from '../formats/officeFormat';
import { readEntryText, readZip, writeZip } from '../formats/zipFormat';
import { cleanFile, detectFormat, inspectFile } from '../cleaner';
import { C2PA_BMFF_UUID } from '../aiSignatures';

const bytesOf = (value: string): Uint8Array => new TextEncoder().encode(value);
const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const le32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const u8 = (...parts: Array<number[] | string | Uint8Array>): Uint8Array =>
  concatBytes(parts.map((part) => (typeof part === 'string' ? bytesOf(part) : part)));

const contains = (haystack: Uint8Array, needle: string): boolean => indexOfNeedle(haystack, needle) >= 0;

/* ------------------------------------------------------------------ JPEG -- */

const tiffWithSoftware = (software: string): Uint8Array => {
  const text = `${software}\0`;
  const dataOffset = 8 + 2 + 12 + 4;
  return u8(
    'MM',
    be16(0x002a),
    be32(8),
    be16(1),
    be16(0x0131),
    be16(2),
    be32(text.length),
    be32(dataOffset),
    be32(0),
    text,
  );
};

const jpegSegment = (marker: number, payload: Uint8Array): Uint8Array =>
  u8([0xff, marker], be16(payload.length + 2), payload);

const buildJpeg = (): Uint8Array =>
  u8(
    [0xff, 0xd8],
    jpegSegment(0xe0, u8('JFIF\0', [1, 1, 0], be16(72), be16(72), [0, 0])),
    jpegSegment(0xe1, u8('Exif\0\0', tiffWithSoftware('Stable Diffusion XL'))),
    jpegSegment(
      0xe1,
      u8(
        'http://ns.adobe.com/xap/1.0/\0',
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description digitalSourceType="trainedAlgorithmicMedia" xmp:CreatorTool="Midjourney v6" xmp:prompt="a quiet forest"/></rdf:RDF></x:xmpmeta>',
      ),
    ),
    jpegSegment(0xeb, u8('JP\0\0', 'jumb(c2pa)-0011-0010-800000aa00389b71 manifest signature'))
    ,
    jpegSegment(0xfe, u8('Generated with AI')),
    jpegSegment(0xda, u8([3, 1, 0, 2, 17, 3, 17, 0, 63, 0])),
    u8([0x12, 0x34, 0x56, 0x78, 0xff, 0x00, 0xab]),
    u8([0xff, 0xd9]),
  );

describe('JPEG scrubbing', () => {
  it('finds EXIF, XMP, C2PA and comment segments', () => {
    const inspection = inspectJpeg(buildJpeg());
    expect(inspection.segments.join(' ')).toContain('EXIF');
    expect(inspection.segments.join(' ')).toContain('XMP');
    expect(inspection.segments.join(' ')).toContain('C2PA');
    expect(inspection.c2pa).toBe(true);
    expect(inspection.fields.some((field) => field.label === 'Software' && /Stable Diffusion/.test(field.value))).toBe(true);
    expect(inspection.mentions.map((m) => m.label)).toContain('Stable Diffusion');
  });

  it('removes every metadata segment but keeps JFIF, scan data and EOI', () => {
    const input = buildJpeg();
    const { bytes, removed } = scrubJpeg(input);

    expect(contains(bytes, 'Exif')).toBe(false);
    expect(contains(bytes, 'x:xmpmeta')).toBe(false);
    expect(contains(bytes, 'Generated with AI')).toBe(false);
    expect(contains(bytes, 'manifest signature')).toBe(false);
    expect(contains(bytes, 'JFIF')).toBe(true);
    expect(ascii(bytes, 0, 2)).toBe('\xff\xd8');
    expect(bytes[bytes.length - 2]).toBe(0xff);
    expect(bytes[bytes.length - 1]).toBe(0xd9);
    expect(contains(bytes, 'a quiet forest')).toBe(false);
    expect(removed.length).toBeGreaterThanOrEqual(4);
    expect(bytes.length).toBeLessThan(input.length);
  });
});

/* ------------------------------------------------------------------- PNG -- */

const pngChunk = (type: string, data: Uint8Array): Uint8Array => {
  const body = u8(type, data);
  return u8(be32(data.length), body, be32(crc32(body)));
};

const buildPng = (): Uint8Array =>
  u8(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    pngChunk('IHDR', u8(be32(4), be32(4), [8, 6, 0, 0, 0])),
    pngChunk('tEXt', u8('Software\0ComfyUI + Flux.1 workflow seed:42')),
    pngChunk('iTXt', u8('XML:com.adobe.xmp\0\0\0\0\0<t:xmpmeta>digitalSourceType trainedAlgorithmicMedia</t:xmpmeta>')),
    pngChunk('eXIf', tiffWithSoftware('Automatic1111')),
    pngChunk('caBX', u8('jumbf c2pa manifest')),
    pngChunk('IDAT', u8([1, 2, 3, 4, 5, 6, 7, 8])),
    pngChunk('IEND', new Uint8Array(0)),
  );

describe('PNG scrubbing', () => {
  it('drops text, EXIF and C2PA chunks while keeping the image chunks', () => {
    const input = buildPng();
    const { bytes, removed } = scrubPng(input);

    expect(removed.join(' ')).toContain('tEXt');
    expect(removed.join(' ')).toContain('eXIf');
    expect(removed.join(' ')).toContain('caBX');
    expect(contains(bytes, 'ComfyUI')).toBe(false);
    expect(contains(bytes, 'jumbf')).toBe(false);
    expect(contains(bytes, 'IHDR')).toBe(true);
    expect(contains(bytes, 'IDAT')).toBe(true);
    expect(contains(bytes, 'IEND')).toBe(true);
    expect(bytes.length).toBeLessThan(input.length);
    // The PNG signature must survive.
    expect(readU32LE(bytes, 0)).toBe(0x474e5089);
  });
});

/* ------------------------------------------------------------------ WebP -- */

const buildWebp = (): Uint8Array => {
  const vp8x = u8('VP8X', le32(10), [0x0c, 0, 0, 0], [0, 0, 0], [0, 0, 0]);
  const exif = u8('EXIF', le32(4), [1, 2, 3, 4]);
  const xmp = u8('XMP ', le32(6), u8('prompt'));
  const body = u8(vp8x, exif, xmp, u8('VP8 ', le32(4), [9, 9, 9, 9]));
  return u8('RIFF', le32(4 + body.length), 'WEBP', body);
};

describe('WebP scrubbing', () => {
  it('removes EXIF/XMP chunks, clears the feature flags and fixes the RIFF size', () => {
    const input = buildWebp();
    const { bytes, removed } = scrubWebp(input);

    expect(removed.join(' ')).toMatch(/EXIF/);
    expect(removed.join(' ')).toMatch(/XMP/);
    expect(contains(bytes, 'EXIF')).toBe(false);
    expect(contains(bytes, 'prompt')).toBe(false);
    expect(contains(bytes, 'VP8 ')).toBe(true);
    expect(readU32LE(bytes, 4)).toBe(bytes.length - 8);
    expect(bytes[20] & 0x0c).toBe(0); // EXIF + XMP flags cleared in VP8X
  });
});

/* ------------------------------------------------------------------- GIF -- */

const buildGif = (): Uint8Array =>
  u8(
    'GIF89a',
    le16(2),
    le16(2),
    [0x80, 0, 0],
    [0, 0, 0, 255, 255, 255],
    [0x21, 0xfe, 5],
    'hello',
    [0],
    [0x21, 0xff, 11],
    'XMP DataXMP',
    [4],
    [0, 0, 0, 0],
    [0],
    [0x2c, 0, 0, 0, 0, 2, 0, 2, 0, 0],
    [2, 0x02, 0x44, 0x01, 0x00],
    [0x3b],
  );

describe('GIF scrubbing', () => {
  it('drops the comment and XMP extensions but keeps frames and trailer', () => {
    const inspection = inspectGif(buildGif());
    expect(inspection.segments.join(' ')).toMatch(/XMP|Comment/);

    const { bytes, removed } = scrubGif(buildGif());
    expect(removed.join(' ')).toMatch(/comment/i);
    expect(removed.join(' ')).toMatch(/xmp/i);
    expect(contains(bytes, 'hello')).toBe(false);
    expect(contains(bytes, 'XMP DataXMP')).toBe(false);
    expect(bytes[bytes.length - 1]).toBe(0x3b);
    expect(contains(bytes, 'GIF89a')).toBe(true);
  });
});

/* ------------------------------------------------------------------- SVG -- */

describe('SVG scrubbing', () => {
  it('removes metadata blocks, XMP and editor attributes', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" sodipodi:docname="ai-art.svg"><!--made with AI--><metadata><rdf:RDF><x:xmpmeta>Midjourney prompt: forest</x:xmpmeta></rdf:RDF></metadata><rect width="10" height="10"/></svg>`;
    const { bytes, removed } = scrubSvg(bytesOf(svg));
    const text = new TextDecoder().decode(bytes);

    expect(removed.length).toBeGreaterThan(0);
    expect(text).not.toContain('Midjourney');
    expect(text).not.toContain('<metadata');
    expect(text).not.toContain('sodipodi:docname');
    expect(text).toContain('<rect');
  });
});

/* ------------------------------------------------------------------ BMFF -- */

const rawBox = (typeBytes: number[], body: Uint8Array): Uint8Array =>
  u8(be32(8 + typeBytes.length + body.length), typeBytes, body);

const beBox = (type: string, body: Uint8Array): Uint8Array =>
  u8(be32(8 + body.length), type, body);

const uuidBox = (uuid: number[], body: Uint8Array): Uint8Array =>
  u8(be32(8 + 16 + body.length), 'uuid', new Uint8Array(uuid), body);

const buildMp4 = (): Uint8Array => {
  const ftyp = beBox('ftyp', u8('isom', be32(512), 'isom', 'iso2', 'avc1', 'mp41'));
  const c2pa = uuidBox(C2PA_BMFF_UUID, u8('manifest\0', 'jumbf c2pa signature'));
  const tool = rawBox([0xa9, 0x74, 0x6f, 0x6f], bytesOf('Midjourney v6')); // ©too
  const udta = beBox('udta', tool);
  const moov = beBox('moov', udta);
  const mdat = beBox('mdat', new Uint8Array([0xde, 0xad, 0xbe, 0xef, 1, 2, 3, 4]));
  return u8(ftyp, c2pa, moov, mdat);
};

describe('BMFF (MP4/HEIC) scrubbing', () => {
  it('finds the C2PA uuid box and the user-data atom', () => {
    const inspection = inspectBmff(buildMp4());
    expect(inspection.c2pa).toBe(true);
    expect(inspection.found.join(' ')).toMatch(/C2PA/);
    expect(inspection.found.join(' ')).toMatch(/udta/);
  });

  it('blanks the C2PA box in place so media offsets stay valid', () => {
    const input = buildMp4();
    const { bytes, removed } = scrubBmff(input);

    expect(removed.join(' ')).toMatch(/C2PA/);
    expect(contains(bytes, 'jumbf')).toBe(false);
    expect(contains(bytes, 'Midjourney')).toBe(false);
    expect(removed.join(' ')).toMatch(/udta/);
    // Same byte length → every stco/iloc offset still points at the same data.
    expect(bytes.length).toBe(input.length);
    expect(contains(bytes, 'isom')).toBe(true);
    expect(contains(bytes, 'mdat')).toBe(true);
    expect(Array.from(bytes.slice(-8))).toEqual([0xde, 0xad, 0xbe, 0xef, 1, 2, 3, 4]);
    // The C2PA box is re-typed to `free`.
    expect(contains(bytes, 'free')).toBe(true);
  });
});

/* ------------------------------------------------------------------- WAV -- */

const buildWav = (): Uint8Array => {
  const fmt = u8('fmt ', le32(16), le16(1), le16(1), le32(44100), le32(44100), le16(1), le16(8));
  const list = u8('LIST', le32(4 + 8 + 12), 'INFO', 'ISFT', le32(13), 'Midjourney v6\0');
  const data = u8('data', le32(8), [1, 2, 3, 4, 5, 6, 7, 8]);
  const body = u8(fmt, list, data);
  return u8('RIFF', le32(4 + body.length), 'WAVE', body);
};

describe('WAV scrubbing', () => {
  it('drops LIST/INFO metadata, keeps fmt and data, and fixes the RIFF size', () => {
    const inspection = inspectWav(buildWav());
    expect(inspection.chunks).toContain('LIST');

    const { bytes, removed } = scrubWav(buildWav());
    expect(removed.join(' ')).toContain('LIST');
    expect(contains(bytes, 'Midjourney')).toBe(false);
    expect(contains(bytes, 'fmt ')).toBe(true);
    expect(contains(bytes, 'data')).toBe(true);
    expect(readU32LE(bytes, 4)).toBe(bytes.length - 8);
  });
});

/* ------------------------------------------------------------------- MP3 -- */

const buildMp3 = (): Uint8Array => {
  const frameText = 'Stable Diffusion webui\0';
  const body = u8([0], frameText); // encoding byte + text
  const frame = u8('TSSE', be32(body.length), [0, 0], body);
  const tagBody = u8(frame);
  const id3 = u8('ID3', [3, 0, 0], [0, 0, 0, tagBody.length], tagBody);
  const audio = u8([0xff, 0xfb, 0x90, 0x00], [0x11, 0x22, 0x33, 0x44]);
  const id3v1 = u8('TAG', new Array(125).fill(0x41));
  return u8(id3, audio, id3v1);
};

describe('MP3 scrubbing', () => {
  it('reads ID3v2 frames and strips both ID3 tags', () => {
    const inspection = inspectId3(buildMp3());
    expect(inspection.version).toBe('ID3v2.3.0');
    expect(inspection.frames.some((frame) => frame.id === 'TSSE')).toBe(true);
    expect(inspection.mentions.map((m) => m.label)).toContain('Stable Diffusion');

    const { bytes, removed } = scrubMp3(buildMp3());
    expect(removed.join(' ')).toContain('ID3v2');
    expect(removed.join(' ')).toContain('ID3v1');
    expect(contains(bytes, 'TSSE')).toBe(false);
    expect(contains(bytes, 'TAG')).toBe(false);
    expect(bytes[0]).toBe(0xff); // audio now starts the file
    expect(bytes.length).toBe(8);
  });
});

/* ------------------------------------------------------------------- PDF -- */

const buildPdf = (): Uint8Array => {
  const xmp = '<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description xmp:CreatorTool="Midjourney"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>';
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Metadata 4 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n',
    '3 0 obj\n<< /Type /XObject >>\nendobj\n',
    `4 0 obj\n<< /Type /Metadata /Subtype /XML /Length ${xmp.length} >>\nstream\n${xmp}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Title (AI art) /Author (Sajedur) /Creator (Midjourney) /Producer (Adobe Firefly) >>\nendobj\n',
  ];

  let text = '%PDF-1.7\n';
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(text.length);
    text += object;
  }
  const xrefStart = text.length;
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \r\n`;
  for (const offset of offsets) text += `${String(offset).padStart(10, '0')} 00000 n \r\n`;
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return bytesOf(text);
};

describe('PDF scrubbing', () => {
  it('reports metadata streams and info dictionaries', () => {
    const inspection = inspectPdf(buildPdf());
    expect(inspection.version).toBe('1.7');
    expect(inspection.metadataStreams).toBe(1);
    expect(inspection.infoDictionaries).toBe(1);
    expect(inspection.mentions.map((m) => m.label)).toContain('Midjourney');
  });

  it('empties the XMP stream, scrubs /Info and rebuilds the xref', () => {
    const input = buildPdf();
    const { bytes, removed } = scrubPdf(input);
    const text = new TextDecoder().decode(bytes);

    expect(removed.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/Midjourney|Firefly|AI art/);
    expect(text).toContain('/Type /Metadata');
    expect(text).toMatch(/startxref\s+\d+/);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(bytes.length).toBeGreaterThan(0);
  });
});

/* ---------------------------------------------------------------- Office -- */

const buildDocx = async (): Promise<Uint8Array> => {
  const core = `<?xml version="1.0"?><cp:coreProperties xmlns:cp="x" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="d"><dc:creator>Midjourney</dc:creator><dc:title>AI Art</dc:title><dcterms:created>2025-01-01</dcterms:created></cp:coreProperties>`;
  const app = `<?xml version="1.0"?><Properties xmlns="x"><Application>Firefly</Application><Company>Adobe</Company></Properties>`;
  return writeZip([
    { name: '[Content_Types].xml', data: bytesOf('<Types/>') },
    { name: '_rels/.rels', data: bytesOf('<Relationships/>') },
    { name: 'word/document.xml', data: bytesOf('<w:document>Hello world</w:document>') },
    { name: 'docProps/core.xml', data: bytesOf(core) },
    { name: 'docProps/app.xml', data: bytesOf(app) },
    { name: 'customXml/item1.xml', data: bytesOf('<ai>generated by DALL-E</ai>') },
  ]);
};

describe('Office (OOXML) scrubbing', () => {
  it('empties document properties and drops customXml', async () => {
    const inspection = await inspectOffice(await buildDocx());
    expect(inspection.fields.some((field) => field.value === 'Midjourney')).toBe(true);
    expect(inspection.parts.join(' ')).toMatch(/core\.xml/);

    const { bytes, removed, notes } = await scrubOffice(await buildDocx());
    const archive = readZip(bytes);
    const names = archive.entries.map((entry) => entry.name);

    expect(removed.join(' ')).toMatch(/core\.xml/);
    expect(names).not.toContain('customXml/item1.xml');
    expect(names).toContain('word/document.xml');
    expect(names).toContain('[Content_Types].xml');

    const byName = (name: string) => archive.entries.find((entry) => entry.name === name)!;
    const coreText = await readEntryText(archive, byName('docProps/core.xml'));
    const documentText = await readEntryText(archive, byName('word/document.xml'));
    const appText = await readEntryText(archive, byName('docProps/app.xml'));

    expect(coreText).not.toContain('Midjourney');
    expect(coreText).not.toContain('AI Art');
    expect(appText).not.toContain('Firefly');
    expect(documentText).toContain('Hello world');
    expect(notes.length).toBeGreaterThan(0);
  });
});

/* --------------------------------------------------- end-to-end pipeline -- */

describe('cleanFile pipeline', () => {
  it('detects, inspects and cleans a JPEG File end to end', async () => {
    const bytes = buildJpeg();
    const file = new File([bytes as unknown as BlobPart], 'artwork.jpg', { type: 'image/jpeg' });
    const detected = await detectFormat(file, bytes);
    expect(detected.format).toBe('jpeg');

    const inspection = await inspectFile(file, bytes, detected);
    expect(inspection.formatLabel).toContain('JPEG');

    const result = await cleanFile(file, bytes, detected);
    expect(result.outName).toBe('artwork-clean.jpg');
    expect(result.report.removed.length).toBeGreaterThan(0);
    expect(contains(result.cleanBytes, 'xmpmeta')).toBe(false);
    expect(result.report.after).toBeLessThan(result.report.before);
  });

  it('refuses to claim work on unknown binary formats', async () => {
    const bytes = u8(new Array(64).fill(0x7f));
    const file = new File([bytes as unknown as BlobPart], 'mystery.xyz', { type: '' });
    const detected = await detectFormat(file, bytes);
    expect(detected.format).toBe('unknown');

    const result = await cleanFile(file, bytes, detected);
    expect(result.report.removed).toHaveLength(0);
    expect(result.report.notes.join(' ')).toMatch(/unchanged/i);
    expect(result.cleanBytes.length).toBe(bytes.length);
  });

  it('sniffs a real MP4 by ftyp even without an extension', async () => {
    const bytes = buildMp4();
    const file = new File([bytes as unknown as BlobPart], 'clip', { type: '' });
    const detected = await detectFormat(file, bytes);
    expect(detected.format).toBe('bmff');
  });

  it('keeps the RIFF size field consistent after cleaning a WAV', async () => {
    const bytes = buildWav();
    const file = new File([bytes as unknown as BlobPart], 'take.wav', { type: 'audio/wav' });
    const detected = await detectFormat(file, bytes);
    const result = await cleanFile(file, bytes, detected);
    expect(result.outName).toBe('take-clean.wav');
    expect(writeU32LE).toBeTypeOf('function');
    const size = result.cleanBytes[4] | (result.cleanBytes[5] << 8) | (result.cleanBytes[6] << 16) | (result.cleanBytes[7] << 24);
    expect(size).toBe(result.cleanBytes.length - 8);
  });
});
