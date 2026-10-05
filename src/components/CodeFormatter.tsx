/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Code,
  Copy,
  Check,
  Sparkles,
  Trash2,
  Minimize2,
  Maximize2,
  FileCode2,
  AlertCircle,
  Braces,
  CheckCircle2,
  Sliders
} from 'lucide-react';

type Lang = 'json' | 'html' | 'css' | 'sql' | 'js';

interface FormatOptions {
  indentSpaces: number;
}

export default function CodeFormatter() {
  const [lang, setLang] = useState<Lang>('json');
  const [indentSpaces, setIndentSpaces] = useState<number>(2);
  const [inputCode, setInputCode] = useState<string>('');
  const [outputCode, setOutputCode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const getIndent = (spaces: number) => ' '.repeat(spaces);

  const formatHTML = (html: string, spaces: number) => {
    let formatted = '';
    const reg = /(<\/?[^>]+>)/g;
    const parts = html.replace(reg, '\r\n$1\r\n').split('\r\n');
    let pad = 0;

    parts.forEach((node) => {
      let indent = 0;
      if (node.match(/.+<\/\w[^>]*>/)) {
        indent = 0;
      } else if (node.match(/<\/\w+/)) {
        if (pad !== 0) {
          pad -= 1;
        }
      } else if (node.match(/^<\w[^>]*[^\/]>$/)) {
        indent = 1;
      } else {
        indent = 0;
      }

      let padding = getIndent(pad * spaces);

      const trimmed = node.trim();
      if (trimmed) {
        formatted += padding + trimmed + '\n';
      }
      pad += indent;
    });

    return formatted.trim();
  };

  const formatCSS = (css: string, spaces: number) => {
    const clean = css
      .replace(/\s*([\{\};])\s*/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    const parts = clean.split('{');
    let formatted = '';
    const indentStr = getIndent(spaces);

    for (let i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (parts[i].includes('}')) {
        const subparts = parts[i].split('}');
        const body = subparts[0]
          .split(';')
          .filter((line) => line.trim())
          .map((line) => `${indentStr}${line.trim()};`)
          .join('\n');
        formatted += ` {\n${body}\n}\n\n`;

        if (subparts[1].trim()) {
          formatted += subparts[1].trim();
        }
      } else {
        formatted += parts[i].trim();
      }
    }
    return formatted.trim();
  };

  const formatSQL = (sql: string, spaces: number) => {
    const keywords = [
      'SELECT',
      'FROM',
      'WHERE',
      'AND',
      'OR',
      'LEFT JOIN',
      'RIGHT JOIN',
      'INNER JOIN',
      'JOIN',
      'ON',
      'ORDER BY',
      'GROUP BY',
      'LIMIT',
      'HAVING',
      'INSERT INTO',
      'UPDATE',
      'DELETE FROM',
      'VALUES',
      'SET'
    ];
    let working = sql.replace(/\s+/g, ' ').trim();

    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      working = working.replace(regex, `\n${keyword}`);
    });

    const indentStr = getIndent(spaces);

    return working
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        const isKeyword = keywords.some((k) => trimmed.toUpperCase().startsWith(k));
        return isKeyword ? trimmed : `${indentStr}${trimmed}`;
      })
      .filter((line) => line.length > 0)
      .join('\n');
  };

  const formatJS = (js: string, spaces: number) => {
    let indent = 0;
    const indentStr = getIndent(spaces);
    const lines = js
      .replace(/([{;}])/g, '$1\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    let formatted = '';
    lines.forEach((line) => {
      if (line.startsWith('}') || line.startsWith(']')) {
        indent = Math.max(0, indent - 1);
      }

      formatted += getIndent(indent * spaces) + line + '\n';

      if (line.endsWith('{') || line.endsWith('[')) {
        indent++;
      }
    });

    return formatted.trim();
  };

  const handleFormat = () => {
    setErrorMsg(null);
    if (!inputCode.trim()) {
      setOutputCode('');
      return;
    }

    try {
      if (lang === 'json') {
        const parsed = JSON.parse(inputCode);
        setOutputCode(JSON.stringify(parsed, null, indentSpaces));
      } else if (lang === 'html') {
        setOutputCode(formatHTML(inputCode, indentSpaces));
      } else if (lang === 'sql') {
        setOutputCode(formatSQL(inputCode, indentSpaces));
      } else if (lang === 'css') {
        setOutputCode(formatCSS(inputCode, indentSpaces));
      } else if (lang === 'js') {
        setOutputCode(formatJS(inputCode, indentSpaces));
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Syntax parsing error. Please verify input code structure.');
    }
  };

  const handleMinify = () => {
    setErrorMsg(null);
    if (!inputCode.trim()) {
      setOutputCode('');
      return;
    }

    try {
      if (lang === 'json') {
        const parsed = JSON.parse(inputCode);
        setOutputCode(JSON.stringify(parsed));
      } else {
        let minified = inputCode
          .replace(/\s+/g, ' ')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .trim();

        if (lang === 'css') {
          minified = minified
            .replace(/\s*([{\}:;])\s*/g, '$1')
            .replace(/;}/g, '}');
        } else if (lang === 'html') {
          minified = minified.replace(/>\s+</g, '><');
        }
        setOutputCode(minified);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Parsing error. Verify that your syntax contains no syntax breaks.');
    }
  };

  const handleCopy = () => {
    if (!outputCode && !inputCode) return;
    const textToCopy = outputCode || inputCode;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setInputCode('');
    setOutputCode('');
    setErrorMsg(null);
  };

  // Line metrics calculation
  const inputStats = useMemo(() => {
    if (!inputCode) return { lines: 0, chars: 0 };
    return {
      lines: inputCode.split('\n').length,
      chars: inputCode.length
    };
  }, [inputCode]);

  const outputStats = useMemo(() => {
    if (!outputCode) return { lines: 0, chars: 0 };
    return {
      lines: outputCode.split('\n').length,
      chars: outputCode.length
    };
  }, [outputCode]);

  return (
    <div className="space-y-6 text-[var(--theme-text)] animate-fade-in">
      {/* Tool Header */}
      <div className="border-b border-[var(--theme-card-border)] pb-6 space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20 shrink-0">
            <FileCode2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--theme-text)] flex items-center gap-2">
              Code Formatter & Beautifier
            </h2>
            <p className="text-xs md:text-sm text-[var(--theme-text-muted)] mt-0.5">
              Format, beautify, and compress JSON, HTML, CSS, SQL, and JavaScript code instantly with customizable indentations.
            </p>
          </div>
        </div>
      </div>

      {/* Main Controls Header */}
      <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm font-mono text-xs">
        {/* Language Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(
            [
              { id: 'json', label: 'JSON' },
              { id: 'html', label: 'HTML' },
              { id: 'css', label: 'CSS' },
              { id: 'sql', label: 'SQL' },
              { id: 'js', label: 'JavaScript' }
            ] as { id: Lang; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setLang(item.id);
                setOutputCode('');
                setErrorMsg(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs whitespace-nowrap ${
                lang === item.id
                  ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-sm'
                  : 'bg-[var(--theme-bg)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] border border-[var(--theme-card-border)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Indent Options & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          <div className="flex items-center gap-1.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] px-2.5 py-1 rounded-lg text-[11px]">
            <Sliders className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
            <span className="text-[var(--theme-text-muted)]">Indent:</span>
            {[2, 4].map((sp) => (
              <button
                key={sp}
                onClick={() => setIndentSpaces(sp)}
                className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                  indentSpaces === sp
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)]'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                }`}
              >
                {sp}s
              </button>
            ))}
          </div>

          <button
            onClick={handleClear}
            disabled={!inputCode && !outputCode}
            className="p-1.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-rose-500 text-rose-500 rounded-lg transition-colors disabled:opacity-40"
            title="Clear all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleFormat}
          disabled={!inputCode.trim()}
          className="flex-1 sm:flex-none px-5 py-2.5 bg-[var(--theme-accent)] hover:opacity-90 text-[var(--theme-accent-text)] font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-40 active:scale-95"
        >
          <Sparkles className="w-4 h-4" />
          <span>Format & Beautify</span>
        </button>

        <button
          onClick={handleMinify}
          disabled={!inputCode.trim()}
          className="px-4 py-2.5 bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] text-[var(--theme-text)] font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
        >
          <Minimize2 className="w-4 h-4 text-[var(--theme-accent)]" />
          <span>Minify Code</span>
        </button>

        <button
          onClick={handleCopy}
          disabled={!outputCode && !inputCode}
          className="px-4 py-2.5 bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] text-[var(--theme-text)] font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40 ml-auto"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-[var(--theme-accent)]" />
              <span>Copy Output</span>
            </>
          )}
        </button>
      </div>

      {/* Error Message Panel */}
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl flex items-start gap-3 font-mono text-xs text-rose-500 animate-fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <div>
            <div className="font-bold text-sm">Syntax Error Detected</div>
            <div className="text-rose-400 mt-1">{errorMsg}</div>
          </div>
        </div>
      )}

      {/* Code Editor Grid: Input vs Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Source Input Container */}
        <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-4 rounded-2xl shadow-sm space-y-3 flex flex-col">
          <div className="flex items-center justify-between text-xs font-mono uppercase text-[var(--theme-text-muted)] font-bold">
            <span className="flex items-center gap-2">
              <Code className="w-4 h-4 text-[var(--theme-accent)]" />
              Raw Input ({lang.toUpperCase()})
            </span>
            <span className="text-[11px]">
              {inputStats.lines} lines • {inputStats.chars} chars
            </span>
          </div>

          <textarea
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder={`Paste raw ${lang.toUpperCase()} code here...`}
            rows={14}
            spellCheck={false}
            className="w-full p-4 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] focus:border-[var(--theme-accent)] rounded-xl text-xs md:text-sm font-mono text-[var(--theme-text)] placeholder-[var(--theme-text-muted)]/50 focus:outline-none transition-colors resize-y leading-relaxed flex-grow"
          />
        </div>

        {/* Formatted Output Container */}
        <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-4 rounded-2xl shadow-sm space-y-3 flex flex-col">
          <div className="flex items-center justify-between text-xs font-mono uppercase text-[var(--theme-text-muted)] font-bold">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Formatted Output
            </span>
            <span className="text-[11px]">
              {outputStats.lines} lines • {outputStats.chars} chars
            </span>
          </div>

          <textarea
            value={outputCode}
            readOnly
            placeholder="Formatted output will appear here after clicking Format..."
            rows={14}
            spellCheck={false}
            className="w-full p-4 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] rounded-xl text-xs md:text-sm font-mono text-[var(--theme-text)] placeholder-[var(--theme-text-muted)]/50 focus:outline-none transition-colors resize-y leading-relaxed flex-grow"
          />
        </div>
      </div>
    </div>
  );
}
