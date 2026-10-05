/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  FileCode,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Trash2,
  Sparkles,
  Minimize2,
  Maximize2,
  Wand2,
  Info,
  Braces,
  Hash,
  Layers,
  Code2,
  FileJson
} from 'lucide-react';

interface ErrorDetails {
  message: string;
  line?: number;
  column?: number;
  position?: number;
  snippet?: string;
  suggestion?: string;
}

export default function JsonValidator() {
  const [jsonInput, setJsonInput] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [indentSpaces, setIndentSpaces] = useState<number>(2);

  // Real-time JSON parsing and analysis
  const validationResult = useMemo(() => {
    const trimmed = jsonInput.trim();
    if (!trimmed) {
      return {
        isValid: null,
        error: null,
        stats: null,
        parsedData: null
      };
    }

    try {
      const parsed = JSON.parse(trimmed);

      // Calculate JSON structure statistics
      let keyCount = 0;
      let maxDepth = 0;

      const analyzeObj = (obj: any, depth = 1) => {
        if (depth > maxDepth) maxDepth = depth;
        if (obj && typeof obj === 'object') {
          if (Array.isArray(obj)) {
            obj.forEach((item) => analyzeObj(item, depth + 1));
          } else {
            const keys = Object.keys(obj);
            keyCount += keys.length;
            keys.forEach((k) => analyzeObj(obj[k], depth + 1));
          }
        }
      };

      analyzeObj(parsed, 1);

      const byteSize = new Blob([trimmed]).size;
      const formattedSize = new Blob([JSON.stringify(parsed, null, indentSpaces)]).size;

      return {
        isValid: true,
        error: null,
        parsedData: parsed,
        stats: {
          rootType: Array.isArray(parsed) ? 'Array' : typeof parsed === 'object' && parsed !== null ? 'Object' : typeof parsed,
          keyCount,
          maxDepth,
          byteSize,
          formattedSize,
          arrayLength: Array.isArray(parsed) ? parsed.length : null
        }
      };
    } catch (err: any) {
      const errMessage = err?.message || 'Invalid JSON format';
      const details: ErrorDetails = {
        message: errMessage
      };

      // Extract error position from V8 / standard engine error messages
      // e.g. "Unexpected token } in JSON at position 45"
      const posMatch = errMessage.match(/at position (\d+)/i);
      if (posMatch && posMatch[1]) {
        const pos = parseInt(posMatch[1], 10);
        details.position = pos;

        // Calculate line and column
        let line = 1;
        let col = 1;
        for (let i = 0; i < Math.min(pos, trimmed.length); i++) {
          if (trimmed[i] === '\n') {
            line++;
            col = 1;
          } else {
            col++;
          }
        }
        details.line = line;
        details.column = col;

        // Get snippet around position
        const start = Math.max(0, pos - 20);
        const end = Math.min(trimmed.length, pos + 20);
        details.snippet = trimmed.substring(start, end);
      }

      // Generate smart recovery suggestions
      if (errMessage.includes("'") || errMessage.includes("single quote")) {
        details.suggestion = "JSON requires double quotes (\") for property keys and string values instead of single quotes (').";
      } else if (errMessage.includes("Unexpected token }") || errMessage.includes("Unexpected token ]")) {
        details.suggestion = "Check for trailing commas before closing braces '}' or brackets ']'.";
      } else if (errMessage.includes("Unexpected string") || errMessage.includes("Expected ':'")) {
        details.suggestion = "Verify that key-value pairs are separated by colons (:) and items are separated by commas (,).";
      } else {
        details.suggestion = "Ensure all brackets/braces are matched, keys are in double quotes, and no trailing commas exist.";
      }

      return {
        isValid: false,
        error: details,
        parsedData: null,
        stats: null
      };
    }
  }, [jsonInput, indentSpaces]);

  // Format / Beautify JSON
  const handleFormat = (spaces: number = indentSpaces) => {
    if (!validationResult.parsedData) return;
    setJsonInput(JSON.stringify(validationResult.parsedData, null, spaces));
  };

  // Minify JSON
  const handleMinify = () => {
    if (!validationResult.parsedData) return;
    setJsonInput(JSON.stringify(validationResult.parsedData));
  };

  // Smart Auto-Fix for common JS-to-JSON loose syntax
  const handleAutoFix = () => {
    if (!jsonInput) return;
    let fixed = jsonInput;

    // 1. Replace single quotes with double quotes where appropriate
    fixed = fixed.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"');

    // 2. Remove trailing commas in objects and arrays
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');

    // 3. Wrap unquoted key names in double quotes (e.g. { name: "val" } -> { "name": "val" })
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

    setJsonInput(fixed);
  };

  const handleCopy = () => {
    if (!jsonInput) return;
    navigator.clipboard.writeText(jsonInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setJsonInput('');
  };

  return (
    <div className="space-y-6 text-[var(--theme-text)] animate-fade-in">
      {/* Tool Header */}
      <div className="border-b border-[var(--theme-card-border)] pb-6 space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20 shrink-0">
            <FileJson className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--theme-text)] flex items-center gap-2">
              JSON Validator & Formatter
            </h2>
            <p className="text-xs md:text-sm text-[var(--theme-text-muted)] mt-0.5">
              Paste JSON code for instant syntax validation, line-by-line error reporting, smart auto-fixing, and minification.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Input + Status & Tools */}
      <div className="space-y-6">
        {/* Top Control Bar */}
        <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-4 rounded-2xl flex items-center justify-between flex-wrap gap-3 shadow-sm font-mono text-xs">
          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleFormat(2)}
              disabled={!validationResult.isValid}
              className="px-3 py-1.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] rounded-lg font-bold text-[var(--theme-text)] flex items-center gap-1.5 transition-colors disabled:opacity-40"
              title="Format JSON with 2-space indentation"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
              <span>Format (2 Sp)</span>
            </button>

            <button
              onClick={() => handleFormat(4)}
              disabled={!validationResult.isValid}
              className="px-3 py-1.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] rounded-lg font-bold text-[var(--theme-text)] flex items-center gap-1.5 transition-colors disabled:opacity-40"
              title="Format JSON with 4-space indentation"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
              <span>Format (4 Sp)</span>
            </button>

            <button
              onClick={handleMinify}
              disabled={!validationResult.isValid}
              className="px-3 py-1.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] rounded-lg font-bold text-[var(--theme-text)] flex items-center gap-1.5 transition-colors disabled:opacity-40"
              title="Compact JSON onto a single line"
            >
              <Minimize2 className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
              <span>Minify</span>
            </button>

            <button
              onClick={handleAutoFix}
              disabled={!jsonInput.trim()}
              className="px-3 py-1.5 bg-[var(--theme-accent)]/15 text-[var(--theme-accent)] border border-[var(--theme-accent)]/30 hover:bg-[var(--theme-accent)]/25 rounded-lg font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40"
              title="Automatically fix single quotes, unquoted keys, and trailing commas"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Auto-Fix Syntax</span>
            </button>
          </div>

          {/* Actions & Clear */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!jsonInput.trim()}
              className="px-3 py-1.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] text-[var(--theme-text)] rounded-lg font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              onClick={handleClear}
              disabled={!jsonInput.trim()}
              className="px-3 py-1.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-rose-500 text-rose-500 rounded-lg font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Validation Status Indicator Banner */}
        {validationResult.isValid === true && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono animate-fade-in">
            <div className="flex items-center gap-2.5 text-emerald-500 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
              <span>Valid JSON Syntax!</span>
            </div>

            {/* Quick Stats Summary */}
            {validationResult.stats && (
              <div className="flex items-center gap-4 flex-wrap text-[var(--theme-text-muted)] text-[11px]">
                <div>
                  Root: <span className="text-[var(--theme-text)] font-bold">{validationResult.stats.rootType}</span>
                </div>
                <div>
                  Keys: <span className="text-[var(--theme-text)] font-bold">{validationResult.stats.keyCount}</span>
                </div>
                <div>
                  Depth: <span className="text-[var(--theme-text)] font-bold">{validationResult.stats.maxDepth} levels</span>
                </div>
                <div>
                  Size: <span className="text-[var(--theme-text)] font-bold">{(validationResult.stats.byteSize / 1024).toFixed(2)} KB</span>
                </div>
              </div>
            )}
          </div>
        )}

        {validationResult.isValid === false && validationResult.error && (
          <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl space-y-3 font-mono text-xs text-rose-500 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <XCircle className="w-5 h-5 shrink-0 text-rose-500" />
                <span>Invalid JSON Syntax Detected</span>
              </div>
              {validationResult.error.line && (
                <span className="px-2.5 py-1 bg-rose-500/20 rounded font-black text-rose-400">
                  Line {validationResult.error.line}, Column {validationResult.error.column}
                </span>
              )}
            </div>

            <div className="bg-[var(--theme-bg)] p-3 rounded-lg border border-rose-500/20 text-rose-400 font-mono space-y-1">
              <div className="font-bold">{validationResult.error.message}</div>
              {validationResult.error.snippet && (
                <div className="text-[11px] text-[var(--theme-text-muted)] mt-1 opacity-80 overflow-x-auto whitespace-pre">
                  Near: &quot;...{validationResult.error.snippet}...&quot;
                </div>
              )}
            </div>

            {validationResult.error.suggestion && (
              <div className="flex items-start gap-2 text-xs text-[var(--theme-text-muted)] bg-[var(--theme-card-bg)] p-3 rounded-lg border border-[var(--theme-card-border)]">
                <Info className="w-4 h-4 text-[var(--theme-accent)] shrink-0 mt-0.5" />
                <span>
                  <strong>Tip:</strong> {validationResult.error.suggestion}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Text Area Input */}
        <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-4 md:p-5 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-mono uppercase text-[var(--theme-text-muted)] font-bold">
            <span className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-[var(--theme-accent)]" />
              JSON Input Box
            </span>
            <span>Unlimited Capacity</span>
          </div>

          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste or type your JSON code here..."
            rows={16}
            spellCheck={false}
            className="w-full p-4 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] focus:border-[var(--theme-accent)] rounded-xl text-xs md:text-sm font-mono text-[var(--theme-text)] placeholder-[var(--theme-text-muted)]/50 focus:outline-none transition-colors resize-y leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}
