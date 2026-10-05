/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Byte-level PDF metadata scrubber. Works on uncompressed structure directly
 * (XMP metadata streams, /Info dictionaries, embedded files) and keeps the
 * original page objects byte-identical so viewers/printers stay happy.
 */

import { ascii, decodeText, toReadable } from '../bytes';
import { findTextMentions, type TextMention } from '../aiSignatures';

export interface PdfInspection {
  metadataStreams: number;
  infoDictionaries: number;
  embeddedFiles: number;
  pieceInfo: boolean;
  xmp?: string;
  mentions: TextMention[];
  version: string;
}

export interface PdfScrubResult {
  bytes: Uint8Array;
  removed: string[];
  notes: string[];
}

const EMPTY_XMP =
  '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"/><?xpacket end="w"?>';

const latin1 = (text: string): Uint8Array => {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
};

const buildStreamObject = (objectNumber: number, payload: string): Uint8Array => {
  const header = `${objectNumber} 0 obj\n<< /Type /Metadata /Subtype /XML /Length ${payload.length} >>\nstream\n`;
  const footer = `\nendstream\nendobj\n`;
  return latin1(header + payload + footer);
};

const findObjectOffsets = (text: string): Map<number, { start: number; end: number; body: string }> => {
  const objects = new Map<number, { start: number; end: number; body: string }>();
  const pattern = /(\d+)\s+0\s+obj\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const number = Number(match[1]);
    const start = match.index;
    const endMatch = /endobj/g;
    endMatch.lastIndex = pattern.lastIndex;
    const end = endMatch.exec(text);
    if (!end) break;
    objects.set(number, { start, end: end.index + 'endobj'.length, body: text.slice(start, end.index) });
    pattern.lastIndex = end.index + 'endobj'.length;
  }
  return objects;
};

const findStartXref = (text: string): number => {
  const index = text.lastIndexOf('startxref');
  if (index < 0) return -1;
  const match = text.slice(index).match(/startxref\s+(\d+)/);
  return match ? Number(match[1]) : -1;
};

/** Rebuilds a classic xref table after object lengths have changed. */
const rebuildXref = (
  text: string,
  objects: Map<number, { start: number; end: number }>,
  trailer: { root?: string; info?: string; id?: string },
): string => {
  const numbers = [...objects.keys()].sort((a, b) => a - b);
  const max = numbers.length ? numbers[numbers.length - 1] : 0;
  const entries: string[] = ['0000000000 65535 f \r\n'];
  for (let i = 1; i <= max; i += 1) {
    const object = objects.get(i);
    entries.push(
      object
        ? `${String(object.start).padStart(10, '0')} 00000 n \r\n`
        : `0000000000 65535 f \r\n`,
    );
  }

  // The xref offset depends on where the table itself will start, which depends
  // on the offset string length — a couple of passes converge immediately.
  let xrefOffset = 0;
  let table = '';
  for (let pass = 0; pass < 3; pass += 1) {
    table = `xref\n0 ${max + 1}\n${entries.join('')}trailer\n<< /Size ${max + 1}${
      trailer.root ? ` /Root ${trailer.root}` : ''
    }${trailer.info ? ` /Info ${trailer.info}` : ''}${trailer.id ? ` /ID ${trailer.id}` : ''} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    const next = text.length;
    if (next === xrefOffset) break;
    xrefOffset = next;
  }
  return text + table;
};

export const inspectPdf = (bytes: Uint8Array): PdfInspection => {
  const text = decodeText(bytes);
  const head = ascii(bytes, 0, Math.min(bytes.length, 32));
  const inspection: PdfInspection = {
    metadataStreams: 0,
    infoDictionaries: 0,
    embeddedFiles: 0,
    pieceInfo: false,
    mentions: [],
    version: head.match(/PDF-(\d+\.\d+)/)?.[1] ?? 'unknown',
  };

  inspection.metadataStreams = (text.match(/\/Type\s*\/Metadata/g) ?? []).length;
  inspection.infoDictionaries = (text.match(/\/Info\s+\d+\s+\d+\s+R/g) ?? []).length;
  inspection.embeddedFiles = (text.match(/\/EmbeddedFile/g) ?? []).length;
  inspection.pieceInfo = /\/PieceInfo/.test(text);
  if (/\/Type\s*\/Metadata/.test(text)) {
    const match = text.match(/<x:xmpmeta[\s\S]{0,2000}?<\/x:xmpmeta>/i);
    inspection.xmp = match ? match[0].slice(0, 1400) : undefined;
  }

  inspection.mentions = findTextMentions(text.slice(0, 4 * 1024 * 1024));
  return inspection;
};

export const scrubPdf = (bytes: Uint8Array): PdfScrubResult => {
  const removed: string[] = [];
  const notes: string[] = [];
  let text = decodeText(bytes);

  if (!text.startsWith('%PDF-')) {
    return { bytes, removed, notes: ['This file does not start with a PDF header — left untouched.'] };
  }

  // 1 · XMP metadata streams → emptied, structure kept so the catalog still resolves.
  text = text.replace(
    /(\d+)\s+0\s+obj\s*<<([\s\S]{0,400}?)\/Type\s*\/Metadata([\s\S]{0,400}?)>>\s*stream\r?\n?([\s\S]*?)endstream/g,
    (full: string, numberText: string, before: string, after: string) => {
      const number = Number(numberText);
      if (/FlateDecode/.test(`${before}${after}`)) {
        notes.push(`XMP object ${number} is compressed and was left in place.`);
        return full;
      }
      removed.push(`XMP metadata stream (object ${number})`);
      return decodeText(buildStreamObject(number, EMPTY_XMP));
    },
  );

  // 2 · /Info dictionaries → replaced with a single neutral Producer entry.
  text = text.replace(/(\d+)\s+0\s+obj\s*<<([\s\S]{0,2000}?)>>/g, (full: string, numberText: string, dict: string) => {
    const isInfoDictionary =
      /\/(Title|Author|Creator|Producer|Subject|Keywords|CreationDate|ModDate|Trapped|Copyright)\b/.test(dict) &&
      !/\/Type\s*\/(?!Metadata)/.test(dict);
    if (!isInfoDictionary) return full;
    const number = Number(numberText);
    removed.push(`Document info dictionary (object ${number})`);
    return `${number} 0 obj\n<< /Producer (ZeroKit) >>\nendobj`;
  });

  // 3 · Embedded files / collections (a common home for provenance payloads).
  text = text.replace(/(\d+)\s+0\s+obj\s*<<[^<>]{0,200}\/Type\s*\/Filespec[\s\S]*?endobj/g, (full: string, numberText: string) => {
    const number = Number(numberText);
    removed.push(`Embedded file reference (object ${number})`);
    return `${number} 0 obj\n<< /Type /Filespec /F () >>\nendobj`;
  });

  const attachmentReferences =
    (text.match(/\/Type\s*\/EmbeddedFile/g) ?? []).length + (text.match(/\/EmbeddedFiles\b/g) ?? []).length;
  if (attachmentReferences) {
    text = text.replace(/\/Names\s*<<[\s\S]{0,400}?\/EmbeddedFiles[\s\S]{0,400}?>>/g, '/Names << >>');
    removed.push(`${attachmentReferences} attachment reference(s)`);
    notes.push('Embedded file name trees were emptied; the attachments are no longer referenced.');
  }

  // 4 · /PieceInfo blocks (Illustrator/Adobe private metadata).
  const pieceCount = (text.match(/\/PieceInfo\s*<</g) ?? []).length;
  if (pieceCount) {
    text = text.replace(/\/PieceInfo\s*<<[\s\S]{0,600}?>>/g, '/PieceInfo << >>');
    removed.push(`PieceInfo block(s) ×${pieceCount}`);
  }

  // 5 · Rebuild the cross-reference table against the final byte layout.
  if (removed.length > 0) {
    const trailerMatch = text.match(/trailer\s*<<([\s\S]*?)>>/);
    const trailerText = trailerMatch?.[1] ?? '';
    const root = trailerText.match(/\/Root\s+(\d+\s+\d+\s+R)/)?.[1];
    const id = trailerText.match(/\/ID\s*(\[[^\]]*\])/)?.[1];

    const trailerIndex = text.search(/trailer\s*<</);
    if (trailerIndex > 0) {
      const pdfObjects = text.slice(0, trailerIndex);
      text = rebuildXref(pdfObjects, findObjectOffsets(pdfObjects), { root, id });
      notes.push('The cross-reference table was rebuilt so the emptied objects stay valid.');
    } else {
      notes.push('This PDF uses a cross-reference stream; the original xref stream was kept (viewers rebuild it on save).');
    }
  }

  if (!removed.length) notes.push('No removable PDF metadata was found in this file.');

  return { bytes: latin1(text), removed, notes };
};

