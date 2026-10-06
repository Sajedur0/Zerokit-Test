/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OOXML cleaner (docx / xlsx / pptx). Only the metadata parts are rewritten:
 * docProps/app.xml, docProps/core.xml, customXml, comments and the thumbnail.
 */

import { findTextMentions, type TextMention } from '../aiSignatures';
import { readZip, readEntryText, writeZip, type ZipArchive, type ZipEntry } from './zipFormat';

export interface OfficeInspection {
  parts: string[];
  mentions: TextMention[];
  fields: Array<{ label: string; value: string }>;
  appXml?: string;
  coreXml?: string;
}

export interface OfficeScrubResult {
  bytes: Uint8Array;
  removed: string[];
  notes: string[];
}

const CORE_KEYS: Array<{ tag: string; label: string }> = [
  { tag: 'dc:title', label: 'Title' },
  { tag: 'dc:subject', label: 'Subject' },
  { tag: 'dc:creator', label: 'Creator' },
  { tag: 'cp:keywords', label: 'Keywords' },
  { tag: 'dc:description', label: 'Description' },
  { tag: 'cp:lastModifiedBy', label: 'Last modified by' },
  { tag: 'cp:revision', label: 'Revision' },
  { tag: 'dcterms:created', label: 'Created' },
  { tag: 'dcterms:modified', label: 'Modified' },
  { tag: 'cp:category', label: 'Category' },
  { tag: 'cp:contentStatus', label: 'Content status' },
];

const tagValue = (xml: string, tag: string): string => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!match) return '';
  return match[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
};

const findEntry = (archive: ZipArchive, name: string): ZipEntry | undefined =>
  archive.entries.find((entry) => entry.name.toLowerCase() === name.toLowerCase());

const PART_LABELS: Record<string, string> = {
  'docprops/app.xml': 'Document properties (docProps/app.xml)',
  'docprops/core.xml': 'Core properties (docProps/core.xml)',
  'docprops/custom.xml': 'Custom properties (docProps/custom.xml)',
  'docprops/thumbnail.jpeg': 'Embedded thumbnail (docProps/thumbnail.jpeg)',
  'docprops/thumbnail.jpg': 'Embedded thumbnail (docProps/thumbnail.jpg)',
  'docprops/thumbnail.wmf': 'Embedded thumbnail (docProps/thumbnail.wmf)',
  'docprops/lastprinted.xml': 'Last-printed record',
  'docprops/people.xml': 'People/comment authors',
};

export const inspectOffice = async (bytes: Uint8Array): Promise<OfficeInspection> => {
  const archive = readZip(bytes);
  const inspection: OfficeInspection = { parts: [], mentions: [], fields: [] };

  for (const entry of archive.entries) {
    const lower = entry.name.toLowerCase();
    const label = PART_LABELS[lower];
    const isCustomXml = lower.startsWith('customxml/');
    const isComments = lower.includes('/comments') || lower.includes('notes') ;

    if (label) inspection.parts.push(label);
    else if (isCustomXml) inspection.parts.push(`Custom XML part (${entry.name})`);
    else if (isComments) inspection.parts.push(`Comment/notes part (${entry.name})`);

    if (lower === 'docprops/app.xml' || lower === 'docprops/core.xml') {
      try {
        const xml = await readEntryText(archive, entry);
        if (lower.endsWith('app.xml')) inspection.appXml = xml.slice(0, 1600);
        else inspection.coreXml = xml.slice(0, 1600);
        inspection.mentions.push(...findTextMentions(xml, 3));
      } catch {
        inspection.mentions.push({ label: 'Metadata part', snippet: `${entry.name} could not be read in this browser.` });
      }
    }
  }

  const xmlText = `${inspection.appXml ?? ''} ${inspection.coreXml ?? ''}`;
  for (const key of CORE_KEYS) {
    const value = tagValue(xmlText, key.tag);
    if (value) inspection.fields.push({ label: key.label, value });
  }
  const application = tagValue(xmlText, 'Application');
  const appVersion = tagValue(xmlText, 'AppVersion');
  const company = tagValue(xmlText, 'Company');
  if (application) inspection.fields.push({ label: 'Application', value: `${application}${appVersion ? ` ${appVersion}` : ''}` });
  if (company) inspection.fields.push({ label: 'Company', value: company });

  return inspection;
};

export const scrubOffice = async (bytes: Uint8Array): Promise<OfficeScrubResult> => {
  const archive = readZip(bytes);
  const removed: string[] = [];
  const notes: string[] = [];
  const entries: Array<Parameters<typeof writeZip>[0][number]> = [];
  const seen = new Set<string>();

  const emptyCore = (original: string): string => {
    const namespaces = original.match(/<cp:coreProperties[^>]*>/i)?.[0] ?? '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n${namespaces}</cp:coreProperties>`;
  };

  const emptyApp = (original: string): string => {
    const header = original.match(/<Properties[^>]*>/i)?.[0] ?? '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n${header}<Application>ZeroKit</Application></Properties>`;
  };

  for (const entry of archive.entries) {
    const lower = entry.name.toLowerCase();
    const skip =
      PART_LABELS[lower] !== undefined ||
      lower.startsWith('customxml/') ||
      lower.includes('/comments') ||
      lower === 'docprops/custom.xml';

    if (skip) {
      removed.push(PART_LABELS[lower] ?? `Metadata part (${entry.name})`);
      seen.add(lower);
      continue;
    }

    entries.push({ source: { archive, entry }, name: entry.name });
  }

  // Re-add minimal, metadata-free core/app parts so the package stays valid.
  const coreEntry = findEntry(archive, 'docProps/core.xml');
  if (coreEntry && seen.has('docprops/core.xml')) {
    const original = await readEntryText(archive, coreEntry).catch(() => '');
    entries.push({ name: coreEntry.name, data: new TextEncoder().encode(emptyCore(original)) });
  }
  const appEntry = findEntry(archive, 'docProps/app.xml');
  if (appEntry && seen.has('docprops/app.xml')) {
    const original = await readEntryText(archive, appEntry).catch(() => '');
    entries.push({ name: appEntry.name, data: new TextEncoder().encode(emptyApp(original)) });
  }

  if (!removed.length) notes.push('This Office file carried no document properties to remove.');
  const out = await writeZip(entries);
  notes.push(`Rewrote ${removed.length ? 'metadata parts' : 'the package'} with ${entries.length} parts; [Content_Types].xml and relationships were preserved.`);
  return { bytes: out, removed, notes };
};
