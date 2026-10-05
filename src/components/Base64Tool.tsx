/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Binary,
  Copy,
  Check,
  ArrowRightLeft,
  Trash2,
  Download,
  Upload,
  FileCode,
  Image as ImageIcon,
  ShieldAlert,
  RefreshCw,
  Eye,
  FileText,
  FileCheck,
  FileType,
  Music,
  Video,
  FileArchive
} from 'lucide-react';

type ToolMode = 'text-encode' | 'text-decode' | 'file-to-base64' | 'base64-to-file';

interface DetectedFormat {
  mimeType: string;
  extension: string;
  label: string;
  category: 'image' | 'pdf' | 'audio' | 'video' | 'text' | 'archive' | 'binary';
  isDataUri: boolean;
  rawBase64: string;
  dataUri: string;
}

const MIME_MAP: Record<string, { ext: string; label: string; category: DetectedFormat['category'] }> = {
  'image/png': { ext: 'png', label: 'PNG Image', category: 'image' },
  'image/jpeg': { ext: 'jpg', label: 'JPEG Image', category: 'image' },
  'image/jpg': { ext: 'jpg', label: 'JPEG Image', category: 'image' },
  'image/webp': { ext: 'webp', label: 'WebP Image', category: 'image' },
  'image/gif': { ext: 'gif', label: 'GIF Image', category: 'image' },
  'image/svg+xml': { ext: 'svg', label: 'SVG Vector Image', category: 'image' },
  'image/bmp': { ext: 'bmp', label: 'BMP Image', category: 'image' },
  'image/x-icon': { ext: 'ico', label: 'Icon File', category: 'image' },
  'application/pdf': { ext: 'pdf', label: 'PDF Document', category: 'pdf' },
  'text/markdown': { ext: 'md', label: 'Markdown Document (MD)', category: 'text' },
  'text/x-markdown': { ext: 'md', label: 'Markdown Document (MD)', category: 'text' },
  'application/markdown': { ext: 'md', label: 'Markdown Document (MD)', category: 'text' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: 'docx', label: 'Word Document (DOCX)', category: 'text' },
  'application/msword': { ext: 'doc', label: 'Word Document (DOC)', category: 'text' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: 'xlsx', label: 'Excel Spreadsheet (XLSX)', category: 'text' },
  'application/vnd.ms-excel': { ext: 'xls', label: 'Excel Spreadsheet (XLS)', category: 'text' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { ext: 'pptx', label: 'PowerPoint Presentation (PPTX)', category: 'text' },
  'application/vnd.ms-powerpoint': { ext: 'ppt', label: 'PowerPoint Presentation (PPT)', category: 'text' },
  'application/json': { ext: 'json', label: 'JSON Document', category: 'text' },
  'application/xml': { ext: 'xml', label: 'XML File', category: 'text' },
  'text/plain': { ext: 'txt', label: 'Text Document', category: 'text' },
  'text/csv': { ext: 'csv', label: 'CSV Spreadsheet', category: 'text' },
  'text/html': { ext: 'html', label: 'HTML Document', category: 'text' },
  'text/css': { ext: 'css', label: 'CSS Stylesheet', category: 'text' },
  'audio/mpeg': { ext: 'mp3', label: 'MP3 Audio', category: 'audio' },
  'audio/mp3': { ext: 'mp3', label: 'MP3 Audio', category: 'audio' },
  'audio/wav': { ext: 'wav', label: 'WAV Audio', category: 'audio' },
  'audio/ogg': { ext: 'ogg', label: 'OGG Audio', category: 'audio' },
  'audio/aac': { ext: 'aac', label: 'AAC Audio', category: 'audio' },
  'video/mp4': { ext: 'mp4', label: 'MP4 Video', category: 'video' },
  'video/webm': { ext: 'webm', label: 'WebM Video', category: 'video' },
  'video/x-matroska': { ext: 'mkv', label: 'MKV Video', category: 'video' },
  'application/zip': { ext: 'zip', label: 'ZIP Archive', category: 'archive' },
  'application/x-zip-compressed': { ext: 'zip', label: 'ZIP Archive', category: 'archive' },
  'application/x-rar-compressed': { ext: 'rar', label: 'RAR Archive', category: 'archive' },
  'application/x-7z-compressed': { ext: '7z', label: '7z Archive', category: 'archive' },
  'application/gzip': { ext: 'gz', label: 'GZIP Archive', category: 'archive' },
};

function getInfoFromMimeType(mime: string): { ext: string; label: string; category: DetectedFormat['category'] } {
  const norm = mime.toLowerCase().trim();
  if (MIME_MAP[norm]) {
    return MIME_MAP[norm];
  }
  if (norm.includes('markdown') || norm.includes('md')) {
    return { ext: 'md', label: 'Markdown Document (MD)', category: 'text' };
  }
  if (norm.includes('wordprocessingml') || norm.includes('msword')) {
    return { ext: 'docx', label: 'Word Document', category: 'text' };
  }
  if (norm.includes('spreadsheetml') || norm.includes('excel')) {
    return { ext: 'xlsx', label: 'Excel Spreadsheet', category: 'text' };
  }
  if (norm.includes('presentationml') || norm.includes('powerpoint')) {
    return { ext: 'pptx', label: 'PowerPoint Presentation', category: 'text' };
  }
  if (norm.startsWith('image/')) {
    const sub = norm.split('/')[1]?.split('+')[0] || 'jpg';
    return { ext: sub === 'jpeg' ? 'jpg' : sub, label: `${sub.toUpperCase()} Image`, category: 'image' };
  }
  if (norm.startsWith('audio/')) {
    const sub = norm.split('/')[1]?.split('+')[0] || 'mp3';
    return { ext: sub, label: `${sub.toUpperCase()} Audio`, category: 'audio' };
  }
  if (norm.startsWith('video/')) {
    const sub = norm.split('/')[1]?.split('+')[0] || 'mp4';
    return { ext: sub, label: `${sub.toUpperCase()} Video`, category: 'video' };
  }
  if (norm.startsWith('text/')) {
    const sub = norm.split('/')[1]?.split('+')[0] || 'txt';
    return { ext: sub, label: `${sub.toUpperCase()} File`, category: 'text' };
  }
  if (norm.includes('pdf')) {
    return { ext: 'pdf', label: 'PDF Document', category: 'pdf' };
  }
  if (norm.includes('zip') || norm.includes('compressed') || norm.includes('archive')) {
    return { ext: 'zip', label: 'Archive File', category: 'archive' };
  }

  const parts = norm.split('/');
  const cleanExt = parts[1] ? parts[1].replace(/[^a-z0-9]/gi, '') : 'bin';
  return { ext: cleanExt || 'bin', label: 'Binary File', category: 'binary' };
}

/**
  Helper to resolve real MIME type for files (e.g. .md, .docx, .json where browser file.type may be missing or octet-stream)
 */
function getEffectiveMimeType(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'md' || ext === 'markdown') {
    return 'text/markdown';
  }
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type;
  }
  switch (ext) {
    case 'json': return 'application/json';
    case 'svg': return 'image/svg+xml';
    case 'csv': return 'text/csv';
    case 'pdf': return 'application/pdf';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'mp3': return 'audio/mpeg';
    case 'mp4': return 'video/mp4';
    case 'zip': return 'application/zip';
    default: return file.type || 'application/octet-stream';
  }
}

/**
 * Intelligent detector that extracts MIME format & file extension
 * from Data URI prefixes or inspects raw Base64 magic bytes
 */
function detectFileFormatFromBase64(inputStr: string): DetectedFormat & { isValidBase64: boolean } {
  const trimmed = inputStr.trim();
  if (!trimmed) {
    return {
      mimeType: 'application/octet-stream',
      extension: 'bin',
      label: 'Unknown Binary',
      category: 'binary',
      isDataUri: false,
      rawBase64: '',
      dataUri: '',
      isValidBase64: true
    };
  }

  let mimeType = '';
  let isDataUri = false;
  let rawBase64 = trimmed;

  if (trimmed.startsWith('data:')) {
    isDataUri = true;
    const matches = trimmed.match(/^data:(.*?);base64,/i);
    if (matches && matches[1]) {
      mimeType = matches[1].toLowerCase();
      rawBase64 = trimmed.split(';base64,')[1] || '';
    }
  }

  const cleanBase64Data = rawBase64.replace(/\s+/g, '');

  // Check if base64 is syntactically valid
  let isValidBase64 = true;
  if (cleanBase64Data) {
    try {
      atob(cleanBase64Data.slice(0, 512));
    } catch {
      isValidBase64 = false;
    }
  }

  // If MIME type was not embedded in Data URI header, inspect magic signatures in raw Base64
  if (!mimeType) {
    if (cleanBase64Data.startsWith('iVBORw0KGgo')) {
      mimeType = 'image/png';
    } else if (cleanBase64Data.startsWith('/9j/')) {
      mimeType = 'image/jpeg';
    } else if (cleanBase64Data.startsWith('PHN2Zy') || cleanBase64Data.startsWith('PD94bWw')) {
      mimeType = 'image/svg+xml';
    } else if (cleanBase64Data.startsWith('R0lGOD')) {
      mimeType = 'image/gif';
    } else if (cleanBase64Data.startsWith('UklGR')) {
      mimeType = 'image/webp';
    } else if (cleanBase64Data.startsWith('Qk0')) {
      mimeType = 'image/bmp';
    } else if (cleanBase64Data.startsWith('JVBERi')) {
      mimeType = 'application/pdf';
    } else if (cleanBase64Data.startsWith('UEsDB')) {
      mimeType = 'application/zip';
    } else if (cleanBase64Data.startsWith('SUQz') || cleanBase64Data.startsWith('//uQ') || cleanBase64Data.startsWith('//OI')) {
      mimeType = 'audio/mpeg';
    } else if (cleanBase64Data.startsWith('AAAAFGZ0eXA') || cleanBase64Data.startsWith('AAAAIGZ0eXA')) {
      mimeType = 'video/mp4';
    } else if (cleanBase64Data.startsWith('eyJ') || cleanBase64Data.startsWith('ew0')) {
      mimeType = 'application/json';
    } else {
      mimeType = 'application/octet-stream';
    }
  }

  const mapInfo = getInfoFromMimeType(mimeType);
  const finalMime = mimeType || 'application/octet-stream';
  const reconstructedDataUri = `data:${finalMime};base64,${cleanBase64Data}`;

  return {
    mimeType: finalMime,
    extension: mapInfo.ext,
    label: mapInfo.label,
    category: mapInfo.category,
    isDataUri,
    rawBase64: cleanBase64Data,
    dataUri: reconstructedDataUri,
    isValidBase64
  };
}

export default function Base64Tool() {
  const [mode, setMode] = useState<ToolMode>('text-encode');
  
  // Text Mode state
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [urlSafe, setUrlSafe] = useState(false);
  const [lineWrap, setLineWrap] = useState(false);
  const [autoConvert, setAutoConvert] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // File to Base64 state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [includeDataHeader, setIncludeDataHeader] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // Base64 to File state
  const [pastedBase64, setPastedBase64] = useState('');
  const [downloadFileName, setDownloadFileName] = useState('converted_file');

  // Automatically analyze format when pastedBase64 changes
  const detectedFormat = useMemo(() => {
    return detectFileFormatFromBase64(pastedBase64);
  }, [pastedBase64]);

  // UTF-8 safe Base64 Encoder
  const encodeBase64 = (str: string, isUrlSafe = false, isWrapped = false): string => {
    if (!str) return '';
    try {
      const bytes = new TextEncoder().encode(str);
      let binString = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binString += String.fromCharCode(bytes[i]);
      }
      let b64 = btoa(binString);

      if (isUrlSafe) {
        b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }

      if (isWrapped && b64.length > 76) {
        b64 = b64.match(/.{1,76}/g)?.join('\n') || b64;
      }

      return b64;
    } catch (err: any) {
      throw new Error('Encoding error: ' + (err.message || 'Failed to encode input text.'));
    }
  };

  // UTF-8 safe Base64 Decoder
  const decodeBase64 = (b64Str: string, isUrlSafe = false): string => {
    if (!b64Str.trim()) return '';
    try {
      let str = b64Str.replace(/\s+/g, '');
      
      if (str.includes(';base64,')) {
        str = str.split(';base64,')[1];
      }

      if (isUrlSafe || str.includes('-') || str.includes('_')) {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) {
          str += '=';
        }
      }

      const binString = atob(str);
      const bytes = Uint8Array.from(binString, (m) => m.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch (err: any) {
      throw new Error('Invalid Base64 sequence. Please verify that your string is valid Base64 encoded data.');
    }
  };

  // Auto-convert handler for text mode
  useEffect(() => {
    if (!autoConvert) return;

    setErrorMsg(null);
    if (!inputText) {
      setOutputText('');
      return;
    }

    try {
      if (mode === 'text-encode') {
        setOutputText(encodeBase64(inputText, urlSafe, lineWrap));
      } else if (mode === 'text-decode') {
        setOutputText(decodeBase64(inputText, urlSafe));
      }
    } catch (e: any) {
      setErrorMsg(e.message);
      setOutputText('');
    }
  }, [inputText, mode, urlSafe, lineWrap, autoConvert]);

  const handleManualConvert = () => {
    setErrorMsg(null);
    if (!inputText.trim()) {
      setOutputText('');
      return;
    }

    try {
      if (mode === 'text-encode') {
        setOutputText(encodeBase64(inputText, urlSafe, lineWrap));
      } else if (mode === 'text-decode') {
        setOutputText(decodeBase64(inputText, urlSafe));
      }
    } catch (e: any) {
      setErrorMsg(e.message);
      setOutputText('');
    }
  };

  const handleSwap = () => {
    if (mode === 'text-encode') {
      setMode('text-decode');
      setInputText(outputText);
      setOutputText(inputText);
    } else if (mode === 'text-decode') {
      setMode('text-encode');
      setInputText(outputText);
      setOutputText(inputText);
    }
  };

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setInputText('');
    setOutputText('');
    setErrorMsg(null);
    setSelectedFile(null);
    setFileBase64('');
    setPastedBase64('');
    setDownloadFileName('converted_file');
  };

  // File Upload to Base64 handler
  const processFileUpload = (file: File) => {
    setSelectedFile(file);
    const effectiveMime = getEffectiveMimeType(file);
    const reader = new FileReader();
    reader.onload = () => {
      let result = reader.result as string;
      if (result.startsWith('data:')) {
        result = result.replace(/^data:[^;]*/, `data:${effectiveMime}`);
      }
      setFileBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFileUpload(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Base64 to File Download Handler
  const handleDownloadFile = () => {
    if (!pastedBase64.trim()) return;
    try {
      const format = detectedFormat;
      const cleanB64 = format.rawBase64;
      if (!cleanB64) {
        alert('Please paste a valid Base64 string.');
        return;
      }

      const byteCharacters = atob(cleanB64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: format.mimeType });

      // Build target filename ensuring detected extension is applied
      let baseName = downloadFileName.trim();
      if (baseName.includes('.')) {
        // Strip previous extension if user entered something else
        baseName = baseName.substring(0, baseName.lastIndexOf('.'));
      }
      if (!baseName) baseName = 'converted_file';

      const finalFileName = `${baseName}.${format.extension}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to decode Base64 data for file download. Please check your string.');
    }
  };

  // Download Output Text as File
  const handleDownloadTextOutput = () => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'text-encode' ? 'base64_encoded.txt' : 'base64_decoded.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get displayed file base64 string depending on includeDataHeader
  const getFormattedFileBase64 = () => {
    if (!fileBase64) return '';
    if (includeDataHeader) return fileBase64;
    return fileBase64.split(';base64,')[1] || fileBase64;
  };

  // Calculate stats for text mode
  const inputLength = inputText.length;
  const outputLength = outputText.length;
  const inputBytes = new TextEncoder().encode(inputText).length;
  const outputBytes = new TextEncoder().encode(outputText).length;
  const ratio = inputBytes > 0 && outputBytes > 0 ? Number(((outputBytes / inputBytes - 1) * 100).toFixed(1)) : 0;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--theme-card-border)] pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--theme-text)] flex items-center gap-2">
            <Binary className="w-5 h-5 text-[var(--theme-accent)]" />
            <span>Base64 Encoder & Decryptor</span>
          </h2>
          <p className="text-xs text-[var(--theme-text-muted)] mt-1">
            Encode and decode text, strings, and binary files while preserving exact file format metadata (MIME type & extension).
          </p>
        </div>

        {/* Tab switches */}
        <div className="flex flex-wrap gap-1 bg-[var(--theme-bg)] p-1 border border-[var(--theme-card-border)] rounded-lg text-xs font-mono">
          <button
            onClick={() => { setMode('text-encode'); setInputText(''); setOutputText(''); }}
            className={`px-3 py-1.5 rounded transition-all font-semibold cursor-pointer ${
              mode === 'text-encode'
                ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-sm'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
            }`}
          >
            Encode Text
          </button>
          <button
            onClick={() => { setMode('text-decode'); setInputText(''); setOutputText(''); }}
            className={`px-3 py-1.5 rounded transition-all font-semibold cursor-pointer ${
              mode === 'text-decode'
                ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-sm'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
            }`}
          >
            Decode Text
          </button>
          <button
            onClick={() => setMode('file-to-base64')}
            className={`px-3 py-1.5 rounded transition-all font-semibold cursor-pointer ${
              mode === 'file-to-base64'
                ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-sm'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
            }`}
          >
            File → Base64
          </button>
          <button
            onClick={() => setMode('base64-to-file')}
            className={`px-3 py-1.5 rounded transition-all font-semibold cursor-pointer ${
              mode === 'base64-to-file'
                ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-sm'
                : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
            }`}
          >
            Base64 → File
          </button>
        </div>
      </div>

      {/* TEXT ENCODE & DECODE MODES */}
      {(mode === 'text-encode' || mode === 'text-decode') && (
        <div className="space-y-6">
          {/* Controls & Options Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--theme-bg)] p-3 border border-[var(--theme-card-border)] rounded-lg text-xs font-mono">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--theme-text)] font-semibold">
                <input
                  type="checkbox"
                  checked={urlSafe}
                  onChange={(e) => setUrlSafe(e.target.checked)}
                  className="rounded border-[var(--theme-card-border)] text-[var(--theme-accent)] focus:ring-0"
                />
                <span>URL-Safe Base64</span>
              </label>

              {mode === 'text-encode' && (
                <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--theme-text)] font-semibold">
                  <input
                    type="checkbox"
                    checked={lineWrap}
                    onChange={(e) => setLineWrap(e.target.checked)}
                    className="rounded border-[var(--theme-card-border)] text-[var(--theme-accent)] focus:ring-0"
                  />
                  <span>Wrap Lines (76 chars)</span>
                </label>
              )}

              <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--theme-text)] font-semibold">
                <input
                  type="checkbox"
                  checked={autoConvert}
                  onChange={(e) => setAutoConvert(e.target.checked)}
                  className="rounded border-[var(--theme-card-border)] text-[var(--theme-accent)] focus:ring-0"
                />
                <span>Live Auto-Convert</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSwap}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] text-[var(--theme-text)] rounded transition-all font-semibold"
                type="button"
                title="Swap mode and inputs"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
                <span>Swap</span>
              </button>

              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 rounded transition-all font-semibold"
                type="button"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Error notice */}
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 p-3.5 rounded-lg text-xs flex items-center gap-2 font-mono">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Grid layout for Input & Output Textareas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* INPUT PANEL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-[var(--theme-text)] uppercase flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
                  <span>Input {mode === 'text-encode' ? 'Plain Text' : 'Base64 Payload'}</span>
                </span>
                <span className="text-[var(--theme-text-muted)] text-[10px]">
                  {inputLength} chars ({inputBytes} bytes)
                </span>
              </div>

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  mode === 'text-encode'
                    ? 'Type or paste plain text here (supports Unicode UTF-8, Bangla, Emojis)...'
                    : 'Paste Base64 encoded string here (e.g. SGVsbG8gV29ybGQ=)...'
                }
                className="w-full h-64 p-4 font-mono text-xs bg-[var(--theme-bg)] border border-[var(--theme-card-border)] focus:border-[var(--theme-accent)] focus:ring-1 focus:ring-[var(--theme-accent)] rounded-lg outline-none resize-none text-[var(--theme-text)] leading-relaxed"
              />
            </div>

            {/* OUTPUT PANEL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-[var(--theme-text)] uppercase flex items-center gap-1.5">
                  <Binary className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Output {mode === 'text-encode' ? 'Base64 Result' : 'Decoded Text'}</span>
                </span>
                <span className="text-[var(--theme-text-muted)] text-[10px]">
                  {outputLength} chars ({outputBytes} bytes)
                  {mode === 'text-encode' && inputBytes > 0 && (
                    <span className="text-amber-500 ml-1 font-bold">
                      ({ratio > 0 ? `+${ratio}%` : `${ratio}%`})
                    </span>
                  )}
                </span>
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  value={outputText}
                  placeholder={
                    mode === 'text-encode'
                      ? 'Base64 output will appear here...'
                      : 'Decoded text result will appear here...'
                  }
                  className="w-full h-64 p-4 font-mono text-xs bg-[var(--theme-bg)]/80 border border-[var(--theme-card-border)] rounded-lg outline-none resize-none text-[var(--theme-text)] leading-relaxed selection:bg-[var(--theme-accent)] selection:text-[var(--theme-accent-text)]"
                />

                {/* Quick actions on output */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-[var(--theme-panel-bg)] border border-[var(--theme-card-border)] p-1 rounded-md shadow-sm">
                  <button
                    onClick={() => handleCopy(outputText)}
                    disabled={!outputText}
                    className="p-1.5 hover:bg-[var(--theme-bg)] text-[var(--theme-text)] disabled:opacity-30 rounded transition-colors"
                    title="Copy to Clipboard"
                    type="button"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleDownloadTextOutput}
                    disabled={!outputText}
                    className="p-1.5 hover:bg-[var(--theme-bg)] text-[var(--theme-text)] disabled:opacity-30 rounded transition-colors"
                    title="Download as File"
                    type="button"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {!autoConvert && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleManualConvert}
                className="bg-[var(--theme-accent)] text-[var(--theme-accent-text)] px-8 py-3 rounded-lg font-mono text-xs font-bold uppercase tracking-wider shadow-sm hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Execute {mode === 'text-encode' ? 'Base64 Encoding' : 'Base64 Decoding'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* FILE TO BASE64 MODE */}
      {mode === 'file-to-base64' && (
        <div className="space-y-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed p-8 rounded-lg text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/5'
                : 'border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] bg-[var(--theme-bg)]'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
            <Upload className="w-10 h-10 text-[var(--theme-accent)] mx-auto mb-3 opacity-80" />
            <h3 className="text-sm font-bold text-[var(--theme-text)]">
              {selectedFile ? selectedFile.name : 'Drag & Drop Any File Here'}
            </h3>
            <p className="text-xs text-[var(--theme-text-muted)] mt-1">
              {selectedFile
                ? `${(selectedFile.size / 1024).toFixed(1)} KB — Format: ${getEffectiveMimeType(selectedFile)}`
                : 'Supports PNG, JPG, PDF, SVG, MP3, MP4, Markdown (.md), JSON, ZIP, etc.'}
            </p>
          </div>

          {fileBase64 && selectedFile && (
            <div className="space-y-4">
              {/* File Format preservation info banner */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-3.5 rounded-lg text-xs font-mono flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>
                    Original File Format Stored: <b className="underline">{getEffectiveMimeType(selectedFile)}</b>
                  </span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase">
                  .{getInfoFromMimeType(getEffectiveMimeType(selectedFile)).ext} Format Encoded
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--theme-bg)] p-3 border border-[var(--theme-card-border)] rounded-lg text-xs font-mono">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--theme-text)] font-semibold">
                  <input
                    type="checkbox"
                    checked={includeDataHeader}
                    onChange={(e) => setIncludeDataHeader(e.target.checked)}
                    className="rounded border-[var(--theme-card-border)] text-[var(--theme-accent)] focus:ring-0"
                  />
                  <span>Embed Data URI Prefix (data:{getEffectiveMimeType(selectedFile)};base64,)</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(getFormattedFileBase64())}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--theme-accent)] text-[var(--theme-accent-text)] rounded text-xs font-mono font-bold uppercase transition-all shadow-sm"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied Payload!' : 'Copy Base64'}</span>
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-3 py-1.5 border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 rounded text-xs font-mono font-bold uppercase"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Image preview if image file */}
              {selectedFile.type.startsWith('image/') && (
                <div className="border border-[var(--theme-card-border)] p-4 rounded-lg bg-[var(--theme-bg)] space-y-2">
                  <span className="text-xs font-mono font-bold text-[var(--theme-text)] flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-500" />
                    <span>Image Rendered Preview</span>
                  </span>
                  <div className="flex justify-center bg-checkered p-4 rounded border border-[var(--theme-card-border)]">
                    <img src={fileBase64} alt="Uploaded preview" className="max-h-48 object-contain rounded" />
                  </div>
                </div>
              )}

              {/* Audio preview if audio file */}
              {selectedFile.type.startsWith('audio/') && (
                <div className="border border-[var(--theme-card-border)] p-4 rounded-lg bg-[var(--theme-bg)] space-y-2">
                  <span className="text-xs font-mono font-bold text-[var(--theme-text)] flex items-center gap-1.5">
                    <Music className="w-4 h-4 text-emerald-500" />
                    <span>Audio Playback Preview</span>
                  </span>
                  <div className="flex justify-center p-2">
                    <audio controls src={fileBase64} className="w-full max-w-md" />
                  </div>
                </div>
              )}

              {/* Base64 Output Textarea */}
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-[var(--theme-text)] uppercase block">
                  Generated Base64 String ({getFormattedFileBase64().length} chars)
                </span>
                <textarea
                  readOnly
                  value={getFormattedFileBase64()}
                  className="w-full h-48 p-4 font-mono text-xs bg-[var(--theme-bg)] border border-[var(--theme-card-border)] rounded-lg outline-none resize-none text-[var(--theme-text)] leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* BASE64 TO FILE MODE */}
      {mode === 'base64-to-file' && (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[var(--theme-text)] uppercase block">
                Paste Base64 or Data URI Payload
              </span>
              {pastedBase64.trim() && (
                <span className="text-[11px] font-mono font-bold text-emerald-500 flex items-center gap-1">
                  <FileType className="w-3.5 h-3.5" />
                  <span>Detected Format: {detectedFormat.label} (.{detectedFormat.extension})</span>
                </span>
              )}
            </div>

            <textarea
              value={pastedBase64}
              onChange={(e) => setPastedBase64(e.target.value)}
              placeholder="Paste Base64 code or Data URL here (e.g. data:image/png;base64,iVBORw0KGgo... or raw iVBORw0KGgo...)"
              className="w-full h-48 p-4 font-mono text-xs bg-[var(--theme-bg)] border border-[var(--theme-card-border)] focus:border-[var(--theme-accent)] rounded-lg outline-none resize-none text-[var(--theme-text)] leading-relaxed"
            />
          </div>

          {pastedBase64.trim() && (
            <div className="space-y-4">
              {!detectedFormat.isValidBase64 && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 p-4 rounded-lg flex items-center gap-3 text-xs font-mono">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-rose-500" />
                  <div>
                    <span className="font-bold block">Invalid or Corrupted Base64 String</span>
                    <span>The pasted string contains invalid characters. Please ensure it is a valid Base64 payload or Data URI.</span>
                  </div>
                </div>
              )}

              {/* Intelligent Format Auto-Detection Badge */}
              <div className="bg-[var(--theme-bg)] border border-[var(--theme-card-border)] p-4 rounded-lg space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[var(--theme-card-border)] pb-2.5">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-500" />
                    <span className="font-bold text-[var(--theme-text)]">
                      Auto-Detected File Type: <span className="text-emerald-500 underline">{detectedFormat.label}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] px-2 py-0.5 rounded font-bold text-[var(--theme-text-muted)]">
                      MIME: {detectedFormat.mimeType}
                    </span>
                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-bold uppercase">
                      .{detectedFormat.extension} File
                    </span>
                  </div>
                </div>

                {/* Previews based on category */}
                {detectedFormat.category === 'image' && (
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-mono font-bold text-[var(--theme-text)] flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-emerald-500" />
                      <span>Decoded Image Live Render</span>
                    </span>
                    <div className="flex justify-center bg-checkered p-4 rounded border border-[var(--theme-card-border)]">
                      <img src={detectedFormat.dataUri} alt="Base64 preview" className="max-h-48 object-contain rounded" />
                    </div>
                  </div>
                )}

                {detectedFormat.category === 'audio' && (
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-mono font-bold text-[var(--theme-text)] flex items-center gap-1.5">
                      <Music className="w-4 h-4 text-emerald-500" />
                      <span>Decoded Audio Live Playback</span>
                    </span>
                    <div className="flex justify-center p-2">
                      <audio controls src={detectedFormat.dataUri} className="w-full max-w-md" />
                    </div>
                  </div>
                )}

                {detectedFormat.category === 'text' && (
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-mono font-bold text-[var(--theme-text)] flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-500" />
                      <span>Decoded Text / Markdown Content Preview</span>
                    </span>
                    <pre className="p-3 bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded text-[11px] font-mono max-h-36 overflow-y-auto whitespace-pre-wrap text-[var(--theme-text)] leading-relaxed">
                      {(() => {
                        try {
                          return atob(detectedFormat.rawBase64.slice(0, 1000));
                        } catch {
                          return 'Text content decoded';
                        }
                      })()}
                    </pre>
                  </div>
                )}
              </div>

              {/* Download Bar with Auto-Matched File Extension */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--theme-bg)] p-4 border border-[var(--theme-card-border)] rounded-lg font-mono text-xs">
                <div className="flex items-center gap-2 flex-grow max-w-md">
                  <span className="text-[var(--theme-text-muted)] font-bold">Download As:</span>
                  <div className="flex items-center flex-grow bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded overflow-hidden">
                    <input
                      type="text"
                      value={downloadFileName}
                      onChange={(e) => setDownloadFileName(e.target.value)}
                      placeholder="converted_file"
                      className="flex-grow px-3 py-1.5 text-[var(--theme-text)] font-semibold outline-none bg-transparent"
                    />
                    <span className="px-3 py-1.5 bg-[var(--theme-bg)] border-l border-[var(--theme-card-border)] text-emerald-500 font-bold">
                      .{detectedFormat.extension}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadFile}
                    className="bg-[var(--theme-accent)] text-[var(--theme-accent-text)] px-5 py-2 rounded font-bold uppercase flex items-center gap-2 shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download .{detectedFormat.extension} File</span>
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-3 py-2 border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 rounded font-bold uppercase cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
