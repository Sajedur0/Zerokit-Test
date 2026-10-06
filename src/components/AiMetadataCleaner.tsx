/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI Metadata Cleaner — inspects any supported file for AI-generation
 * metadata and C2PA Content Credentials, removes them locally, and hands back
 * a clean copy at the same pixel/frame dimensions.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Download,
  Eraser,
  Eye,
  FileWarning,
  FolderOpen,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import {
  cleanFile,
  detectFormat,
  inspectFile,
  type CleanResult,
  type DetectedFormat,
  type InspectionReport,
} from '../lib/cleaner';
import { formatBytes } from '../lib/bytes';

type Stage = 'idle' | 'reading' | 'cleaned';

interface Loaded {
  file: File;
  bytes: Uint8Array;
  detected: DetectedFormat;
  report: InspectionReport;
  result: CleanResult | null;
  previewUrl: string | null;
  previewKind: 'image' | 'video' | 'audio' | 'none';
}

const PREVIEWABLE = new Set(['jpeg', 'png', 'webp', 'gif', 'svg', 'bmff']);

const previewKindFor = (format: DetectedFormat['format'], mime: string): Loaded['previewKind'] => {
  if (!PREVIEWABLE.has(format)) return 'none';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (format === 'bmff') return mime.startsWith('audio/') ? 'audio' : 'video';
  return 'image';
};

const MAX_BYTES = 120 * 1024 * 1024;

export default function AiMetadataCleaner() {
  const [stage, setStage] = useState<Stage>('idle');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [isDrag, setIsDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => revokePreview(), [revokePreview]);

  const reset = useCallback(() => {
    revokePreview();
    setLoaded(null);
    setStage('idle');
    setError(null);
    setStatus('');
    if (inputRef.current) inputRef.current.value = '';
  }, [revokePreview]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setStatus('');
      setBusy(true);
      setStage('reading');

      try {
        if (file.size > MAX_BYTES) {
          throw new Error(`That file is ${formatBytes(file.size)} — this tool handles up to ${formatBytes(MAX_BYTES)} per pass.`);
        }
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const detected = await detectFormat(file, bytes);
        const report = await inspectFile(file, bytes, detected);

        revokePreview();
        const kind = previewKindFor(detected.format, file.type);
        let previewUrl: string | null = null;
        if (kind !== 'none') {
          previewUrl = URL.createObjectURL(file);
          previewUrlRef.current = previewUrl;
        }

        setLoaded({ file, bytes, detected, report, result: null, previewUrl, previewKind: kind });
        setStage('cleaned');
        setStatus('Scan complete — nothing has been changed yet.');
      } catch (err) {
        setStage('idle');
        setError(err instanceof Error ? err.message : 'That file could not be read.');
      } finally {
        setBusy(false);
      }
    },
    [revokePreview],
  );

  const runClean = useCallback(async () => {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    setStatus('Removing metadata…');
    try {
      // Re-run against the original bytes so repeated clicks stay idempotent.
      const result = await cleanFile(loaded.file, loaded.bytes, loaded.detected);
      setLoaded({ ...loaded, result });
      setStatus(
        result.report.removed.length
          ? `Removed ${result.report.removed.length} metadata item(s). Download the clean copy below.`
          : 'Nothing to remove — your file was already free of AI metadata.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The clean copy could not be created.');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }, [loaded]);

  const download = useCallback(() => {
    if (!loaded?.result) return;
    const blob = new Blob([loaded.result.cleanBytes as unknown as BlobPart], {
      type: loaded.file.type || 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = loaded.result.outName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, [loaded]);

  const aiVerdict = useMemo(() => {
    if (!loaded) return null;
    const { report } = loaded;
    const mentions = report.mentions;
    const fieldHits = report.fields.filter((field) =>
      /prompt|software|generator|creator|model|parameters|workflow|description|comment|artist|author|copyright/i.test(
        field.label,
      ),
    );
    const cleaned = Boolean(loaded.result);

    if (report.c2pa) {
      return {
        tone: 'c2pa' as const,
        icon: <AlertTriangle />,
        title: 'C2PA Content Credentials found',
        copy: 'This file carries a signed provenance manifest (C2PA / JUMBF). The cleaner removes the manifest and any AI fields attached to it.',
      };
    }
    if (mentions.length || fieldHits.length) {
      return {
        tone: 'detected' as const,
        icon: <AlertTriangle />,
        title: 'AI-related metadata detected',
        copy: `${mentions.length || fieldHits.length} identifier(s) matched known AI tooling or generation fields.`,
      };
    }
    if (cleaned) {
      return {
        tone: 'clear' as const,
        icon: <Check />,
        title: 'Clean copy ready',
        copy: 'The metadata containers were reset, so nothing AI-related remains.',
      };
    }
    return {
      tone: 'clear' as const,
      icon: <BadgeCheck />,
      title: 'No AI metadata found',
      copy: 'No generation prompts, model signatures, or Content Credentials were detected in this file.',
    };
  }, [loaded]);

  const removedList = loaded?.result?.report.removed ?? [];
  const notes = loaded?.result?.report.notes ?? [];
  const bytesDelta = loaded?.result ? loaded.result.report.before - loaded.result.report.after : 0;

  return (
    <div className="space-y-6 text-[var(--theme-text)] animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--theme-card-border)] pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20 shrink-0">
            <Eraser className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--theme-text)]">AI Metadata Cleaner</h2>
            <p className="text-xs text-[var(--theme-text-muted)] mt-1">
              Strip AI-generation metadata and C2PA Content Credentials from any supported file — images, video,
              audio, PDF and Office documents. Everything is rewritten on this device.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20 shrink-0">
          <Lock className="w-3.5 h-3.5" /> local only
        </span>
      </div>

      {/* Stage bar */}
      <ol className="grid grid-cols-3 gap-2 text-[10px] font-mono uppercase tracking-wider">
        {[
          { id: 'idle', label: '01 · Choose file' },
          { id: 'reading', label: '02 · Inspect' },
          { id: 'cleaned', label: '03 · Clean & download' },
        ].map((step) => {
          const active =
            step.id === stage || (step.id === 'cleaned' && stage === 'cleaned');
          return (
            <li
              key={step.id}
              className={`rounded-lg border px-3 py-2 text-center transition-colors ${
                active
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)]'
                  : 'bg-[var(--theme-bg)]/60 text-[var(--theme-text-muted)] border-[var(--theme-card-border)]'
              }`}
            >
              {step.label}
            </li>
          );
        })}
      </ol>

      {/* Drop zone */}
      {!loaded && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDrag(true);
          }}
          onDragLeave={() => setIsDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDrag(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`relative flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed px-6 py-14 transition-all ${
            isDrag
              ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/5'
              : 'border-[var(--theme-card-border)] bg-[var(--theme-bg)]/40'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <div className="w-14 h-14 rounded-2xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20 flex items-center justify-center mb-4">
            {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
          </div>
          <h3 className="text-base font-bold tracking-tight">Bring a file into focus</h3>
          <p className="text-xs text-[var(--theme-text-muted)] mt-1 max-w-md leading-relaxed">
            Drop it here, or choose one from your device. The original is never overwritten — you get a new
            <span className="font-mono"> -clean </span> copy at the same dimensions.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] text-xs font-mono font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
          >
            <FolderOpen className="w-4 h-4" /> Choose file
          </button>
          <p className="mt-4 text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)]">
            JPG · PNG · WebP · GIF · SVG · MP4 · MOV · HEIC · AVIF · WAV · AIFF · MP3 · FLAC · PDF · DOCX · XLSX · PPTX
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3">
          <FileWarning className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-500 font-medium">{error}</p>
        </div>
      )}

      {/* Report */}
      {loaded && (
        <div className="space-y-5">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Left: file identity + preview */}
            <div className="rounded-2xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--theme-card-border)]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)]">
                  01 · selected file
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md bg-[var(--theme-bg)] border border-[var(--theme-card-border)]">
                  {loaded.detected.formatLabel}
                </span>
              </div>

              <div className="p-5 space-y-4">
                <div className="aspect-video rounded-xl border border-[var(--theme-card-border)] bg-[var(--theme-bg)]/60 flex items-center justify-center overflow-hidden">
                  {loaded.previewUrl && loaded.previewKind === 'image' && (
                    <img src={loaded.previewUrl} alt="Selected file preview" className="w-full h-full object-contain" />
                  )}
                  {loaded.previewUrl && loaded.previewKind === 'video' && (
                    <video src={loaded.previewUrl} className="w-full h-full object-contain" controls muted />
                  )}
                  {loaded.previewUrl && loaded.previewKind === 'audio' && (
                    <audio src={loaded.previewUrl} className="w-[85%]" controls />
                  )}
                  {loaded.previewKind === 'none' && (
                    <div className="text-center px-6">
                      <Eye className="w-6 h-6 mx-auto mb-2 text-[var(--theme-text-muted)]" />
                      <p className="text-[11px] text-[var(--theme-text-muted)]">
                        No inline preview for this format — the bytes are still processed exactly the same way.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{loaded.file.name}</p>
                    <p className="text-[11px] text-[var(--theme-text-muted)] font-mono">
                      {formatBytes(loaded.bytes.length)} · {loaded.file.type || 'unknown type'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={reset}
                    className="text-[11px] font-bold text-[var(--theme-accent)] hover:opacity-80 transition-opacity shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                    Replace
                  </button>
                </div>
              </div>
            </div>

            {/* Right: metadata surface */}
            <div className="rounded-2xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--theme-card-border)]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)]">
                  02 · embedded metadata
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)]">
                  {loaded.report.segments.length + loaded.report.fields.length} finding(s)
                </span>
              </div>

              <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto">
                {aiVerdict && (
                  <div
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                      aiVerdict.tone === 'c2pa'
                        ? 'border-blue-500/40 bg-blue-500/5'
                        : aiVerdict.tone === 'detected'
                          ? 'border-rose-500/40 bg-rose-500/5'
                          : 'border-emerald-500/40 bg-emerald-500/5'
                    }`}
                  >
                    <span className="w-5 h-5 shrink-0 mt-0.5 [&>svg]:w-5 [&>svg]:h-5">{aiVerdict.icon}</span>
                    <div>
                      <p className="text-xs font-bold">{aiVerdict.title}</p>
                      <p className="text-[11px] text-[var(--theme-text-muted)] mt-0.5 leading-relaxed">{aiVerdict.copy}</p>
                    </div>
                  </div>
                )}

                {loaded.report.mentions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)] mb-2">
                      AI signatures
                    </p>
                    <ul className="space-y-1.5">
                      {loaded.report.mentions.slice(0, 6).map((mention, index) => (
                        <li
                          key={`${mention.label}-${index}`}
                          className="rounded-lg border border-[var(--theme-card-border)] bg-[var(--theme-bg)]/60 px-3 py-2"
                        >
                          <p className="text-[11px] font-bold">{mention.label}</p>
                          {mention.snippet && (
                            <p className="text-[10px] font-mono text-[var(--theme-text-muted)] mt-0.5 break-words">
                              {mention.snippet.slice(0, 160)}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {loaded.report.containers.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)] mb-2">
                      Metadata containers
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[...new Set(loaded.report.containers)].slice(0, 14).map((container) => (
                        <span
                          key={container}
                          className="text-[10px] font-mono px-2 py-1 rounded-md bg-[var(--theme-bg)] border border-[var(--theme-card-border)] text-[var(--theme-text-muted)]"
                        >
                          {container}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {loaded.report.segments.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)] mb-2">
                      Segments & chunks
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[...new Set(loaded.report.segments)].slice(0, 16).map((segment) => (
                        <span
                          key={segment}
                          className="text-[10px] font-mono px-2 py-1 rounded-md bg-[var(--theme-bg)] border border-[var(--theme-card-border)] text-[var(--theme-text-muted)]"
                        >
                          {segment}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {loaded.report.id3 && loaded.report.id3.frames.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)] mb-2">
                      {loaded.report.id3.version} frames
                    </p>
                    <dl className="space-y-1">
                      {loaded.report.id3.frames.slice(0, 12).map((frame, index) => (
                        <div
                          key={`${frame.id}-${index}`}
                          className="flex items-center justify-between gap-3 text-[11px] border-b border-[var(--theme-card-border)] pb-1"
                        >
                          <dt className="text-[var(--theme-text-muted)]">{frame.description}</dt>
                          <dd className="font-mono">
                            {frame.id} · {frame.size} B
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {loaded.report.fields.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)] mb-2">
                      Readable fields
                    </p>
                    <dl className="space-y-1">
                      {loaded.report.fields.slice(0, 18).map((field, index) => (
                        <div
                          key={`${field.label}-${index}`}
                          className="grid grid-cols-[minmax(90px,0.8fr)_minmax(0,1.2fr)] gap-3 text-[11px] border-b border-[var(--theme-card-border)] pb-1"
                        >
                          <dt className="text-[var(--theme-text-muted)] break-words">{field.label}</dt>
                          <dd className="text-right break-words">{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {loaded.report.xmp && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)] mb-2">
                      XMP packet (excerpt)
                    </p>
                    <pre className="text-[10px] font-mono whitespace-pre-wrap break-words rounded-lg border border-[var(--theme-card-border)] bg-[var(--theme-bg)]/60 p-3 max-h-40 overflow-y-auto">
                      {loaded.report.xmp}
                    </pre>
                  </div>
                )}

                {loaded.report.segments.length === 0 &&
                  loaded.report.fields.length === 0 &&
                  loaded.report.mentions.length === 0 &&
                  loaded.report.containers.length === 0 && (
                    <p className="text-[11px] text-[var(--theme-text-muted)]">
                      No metadata containers were found in this file.
                    </p>
                  )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={runClean}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 min-h-[52px] rounded-xl bg-[var(--theme-accent)] text-[var(--theme-accent-text)] text-xs font-mono font-bold uppercase tracking-wider transition-all active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loaded.result ? 'Clean again' : 'Clean metadata'}
            </button>
            <button
              type="button"
              onClick={download}
              disabled={!loaded.result}
              className="inline-flex items-center justify-center gap-2 min-h-[52px] rounded-xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] text-xs font-mono font-bold uppercase tracking-wider transition-all enabled:hover:border-[var(--theme-accent)] disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              {loaded.result ? `Download ${loaded.result.outName}` : 'Download clean copy'}
            </button>
          </div>

          {status && (
            <p className="text-[11px] text-[var(--theme-text-muted)] flex items-center gap-2" role="status" aria-live="polite">
              <ShieldCheck className="w-3.5 h-3.5" /> {status}
            </p>
          )}

          {/* Result */}
          {loaded.result && (
            <div className="rounded-2xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-[var(--theme-card-border)]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)]">
                  03 · clean copy
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)]">
                  {formatBytes(loaded.result.report.before)} → {formatBytes(loaded.result.report.after)}
                  {bytesDelta > 0 ? ` · −${formatBytes(bytesDelta)}` : ''}
                </span>
              </div>
              <div className="p-5 space-y-4">
                <ul className="grid sm:grid-cols-2 gap-2">
                  {(removedList.length ? removedList : ['Nothing needed removing — the file was already clean']).map(
                    (item, index) => (
                      <li
                        key={`${item}-${index}`}
                        className="flex items-start gap-2 text-[11px] rounded-lg border border-[var(--theme-card-border)] bg-[var(--theme-bg)]/60 px-3 py-2"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>

                {notes.length > 0 && (
                  <ul className="space-y-1.5">
                    {notes.map((note, index) => (
                      <li key={`${note}-${index}`} className="text-[11px] text-[var(--theme-text-muted)] flex items-start gap-2">
                        <span className="text-[var(--theme-accent)] mt-0.5">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={reset}
                  className="text-[11px] font-bold text-[var(--theme-accent)] hover:opacity-80 transition-opacity"
                >
                  Clean another file ↗
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Honest limits */}
      <div className="rounded-2xl border border-[var(--theme-card-border)] bg-[var(--theme-bg)]/40 p-5">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--theme-text-muted)] mb-2">
          What this tool can and cannot do
        </p>
        <ul className="space-y-1.5 text-[11px] text-[var(--theme-text-muted)]">
          <li>• Metadata inside supported containers (EXIF, XMP, IPTC, C2PA, ID3, document properties) is removed byte-by-byte — pixels, audio frames and video frames are never re-encoded.</li>
          <li>• HEIC/AVIF files that store XMP or C2PA inside their image item table are only flagged, because unlinking item data would corrupt the picture.</li>
          <li>• Invisible pixel watermarks (such as SynthID) are not part of the file metadata and cannot be removed by any local tool.</li>
        </ul>
      </div>
    </div>
  );
}
