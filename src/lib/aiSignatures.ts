/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Signatures used to spot AI-generation metadata and C2PA Content Credentials
 * inside arbitrary files. Kept conservative: a hit is reported, never hidden.
 */

export interface AiSignature {
  label: string;
  pattern: RegExp;
}

export const AI_SIGNATURES: AiSignature[] = [
  { label: 'Midjourney', pattern: /midjourney/i },
  { label: 'Stable Diffusion', pattern: /stable[\s_-]*diffusion/i },
  { label: 'Automatic1111 / WebUI', pattern: /automatic1111|stable-diffusion-webui|\ba1111\b/i },
  { label: 'ComfyUI', pattern: /comfy[\s_-]*ui/i },
  { label: 'DALL·E', pattern: /dall[\s._-]*e\b/i },
  { label: 'OpenAI image generation', pattern: /openai[\s_-]*(?:image|dall|gpt)/i },
  { label: 'ChatGPT', pattern: /\bchatgpt\b/i },
  { label: 'Adobe Firefly', pattern: /firefly/i },
  { label: 'Adobe generative fill', pattern: /generative[\s_-]*(?:fill|expand|remove)/i },
  { label: 'Leonardo AI', pattern: /leonardo(?:\.ai)?/i },
  { label: 'Canva AI', pattern: /canva[\s_-]*ai|magic[\s_-]*(?:studio|media)/i },
  { label: 'Runway', pattern: /\brunway\b/i },
  { label: 'DreamStudio', pattern: /dream[\s_-]*studio/i },
  { label: 'NovelAI', pattern: /novel[\s_-]*ai/i },
  { label: 'Google Imagen / Gemini', pattern: /imagen|gemini|synthid/i },
  { label: 'FLUX', pattern: /\bflux(?:\.[0-9])?\b/i },
  { label: 'Krea / Ideogram / Recraft', pattern: /krea|ideogram|recraft/i },
  { label: 'Grok / Aurora', pattern: /\bgrok\b|aurora[\s_-]*image/i },
];

/** Fields that usually carry a generation prompt or model recipe. */
export const AI_FIELD_PATTERN = /\b(?:prompt|negative[\s_-]*prompt|parameters?|workflow|sampler|steps|cfg[\s_-]*scale|model[\s_-]*hash|clip[\s_-]*skip|lora|checkpoint|seed|generation[\s_-]*(?:data|info)|ai[\s_-]*(?:generated|generator|model|tool)|digital[\s_-]*source[\s_-]*type|trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia)\b/i;

export const C2PA_PATTERN = /\bc2pa\b|content[\s_-]*credentials|contentcredentials|jumbf|\bjumd\b|\bjumb\b/i;

/** The BMFF `uuid` box user-type C2PA uses for MP4/MOV/HEIC/AVIF manifests. */
export const C2PA_BMFF_UUID = [
  0xd8, 0xfe, 0xc3, 0xd6, 0x1b, 0x0e, 0x48, 0x3c, 0x92, 0x97, 0x58, 0x28, 0x87, 0x7e, 0xc4, 0x81,
];

/** Legacy/alternate C2PA user-type seen in the wild. */
export const C2PA_BMFF_UUID_ALT = [
  0xd8, 0xfe, 0xc3, 0xd6, 0x1b, 0x0e, 0x4b, 0x1e, 0xa9, 0x7c, 0xad, 0x74, 0x0b, 0xba, 0x8d, 0x4b,
];

/** Adobe XMP `uuid` box user-type inside BMFF containers. */
export const XMP_BMFF_UUID = [
  0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac,
];

export interface TextMention {
  label: string;
  snippet: string;
}

const SNIPPET_RADIUS = 48;

/** Collects AI/C2PA mentions from a text blob, de-duplicated by label. */
export const findTextMentions = (text: string, limit = 6): TextMention[] => {
  const mentions: TextMention[] = [];
  const seen = new Set<string>();

  for (const signature of AI_SIGNATURES) {
    const match = signature.pattern.exec(text);
    if (!match || seen.has(signature.label)) continue;
    seen.add(signature.label);
    const start = Math.max(0, match.index - SNIPPET_RADIUS);
    const snippet = text.slice(start, match.index + match[0].length + SNIPPET_RADIUS).trim();
    mentions.push({ label: signature.label, snippet });
    if (mentions.length >= limit) break;
  }

  return mentions;
};

export const hasC2paMarker = (text: string): boolean => C2PA_PATTERN.test(text);
