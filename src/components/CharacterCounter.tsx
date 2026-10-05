/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Type,
  FileText,
  Copy,
  Check,
  Trash2,
  Sparkles,
  Clock,
  Mic,
  BarChart3,
  RotateCcw,
  Zap,
  AlignLeft
} from 'lucide-react';

export default function CharacterCounter() {
  const [text, setText] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // High-performance real-time analytics calculation
  const stats = useMemo(() => {
    const totalChars = text.length;
    const charsNoSpaces = text.replace(/\s/g, '').length;

    // Words calculation
    const trimmed = text.trim();
    const wordsArray = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const wordCount = wordsArray.length;

    // Sentences calculation (ending with ., !, or ?)
    const sentencesArray = text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const sentenceCount = sentencesArray.length;

    // Paragraphs calculation (separated by newlines)
    const paragraphsArray = text
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const paragraphCount = paragraphsArray.length;

    // Lines calculation
    const lineCount = text ? text.split('\n').length : 0;

    // Letters, digits, spaces, symbols
    const lettersCount = (text.match(/[a-zA-Z\u0980-\u09FF]/g) || []).length; // includes Bengali & Latin
    const digitsCount = (text.match(/[0-9\u09E6-\u09EF]/g) || []).length;
    const spacesCount = (text.match(/\s/g) || []).length;
    const specialCount = totalChars - lettersCount - digitsCount - spacesCount;

    // Reading time (avg 200 words per minute)
    const readingMinutes = wordCount / 200;
    const readingSecs = Math.ceil(readingMinutes * 60);

    // Speaking time (avg 130 words per minute)
    const speakingMinutes = wordCount / 130;
    const speakingSecs = Math.ceil(speakingMinutes * 60);

    // Top keyword frequency density
    const wordFreqMap: Record<string, number> = {};
    wordsArray.forEach((w) => {
      const clean = w.toLowerCase().replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, '');
      if (clean.length > 2) {
        wordFreqMap[clean] = (wordFreqMap[clean] || 0) + 1;
      }
    });

    const topKeywords = Object.entries(wordFreqMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([word, count]) => ({
        word,
        count,
        percentage: wordCount ? Math.round((count / wordCount) * 100) : 0
      }));

    return {
      totalChars,
      charsNoSpaces,
      wordCount,
      sentenceCount,
      paragraphCount,
      lineCount,
      lettersCount,
      digitsCount,
      spacesCount,
      specialCount: Math.max(0, specialCount),
      readingSecs,
      speakingSecs,
      topKeywords
    };
  }, [text]);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setText('');
  };

  const formatTime = (totalSeconds: number) => {
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Quick Text Transformations
  const transformUppercase = () => setText(text.toUpperCase());
  const transformLowercase = () => setText(text.toLowerCase());
  const transformTitlecase = () => {
    setText(
      text.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      )
    );
  };
  const transformRemoveExtraSpaces = () => {
    setText(text.replace(/\s+/g, ' ').trim());
  };

  return (
    <div className="space-y-6 text-[var(--theme-text)] animate-fade-in">
      {/* Tool Header */}
      <div className="border-b border-[var(--theme-card-border)] pb-6 space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20 shrink-0">
            <Type className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--theme-text)] flex items-center gap-2">
              Character & Word Counter Tool
            </h2>
            <p className="text-xs md:text-sm text-[var(--theme-text-muted)] mt-0.5">
              Unlimited capacity text analyzer with real-time character, word, sentence, and keyword density stats.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Textbox + Realtime Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Text Area & Quick Controls */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-4 md:p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
              <span className="text-[var(--theme-text-muted)] flex items-center gap-1.5 font-bold uppercase tracking-wider">
                <AlignLeft className="w-4 h-4 text-[var(--theme-accent)]" />
                Unlimited Text Capacity Box
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!text}
                  className="px-3 py-1.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] text-[var(--theme-text)] rounded-lg font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Copy text to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500">Copied!</span>
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
                  disabled={!text}
                  className="px-3 py-1.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-rose-500 text-rose-500 rounded-lg font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Clear text box"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* Unlimited Capacity Textarea */}
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste your text here without length limits..."
                rows={12}
                className="w-full p-4 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] focus:border-[var(--theme-accent)] rounded-xl text-sm md:text-base font-sans text-[var(--theme-text)] placeholder-[var(--theme-text-muted)]/50 focus:outline-none transition-colors resize-y leading-relaxed"
              />
            </div>

            {/* Text Transformation Quick Actions */}
            <div className="pt-2 border-t border-[var(--theme-card-border)] flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
              <span className="text-[var(--theme-text-muted)] font-bold uppercase text-[10px] tracking-wider">
                Quick Case Tools:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={transformUppercase}
                  disabled={!text}
                  className="px-2.5 py-1 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] rounded font-bold text-[var(--theme-text)] transition-colors disabled:opacity-40"
                >
                  UPPERCASE
                </button>
                <button
                  onClick={transformLowercase}
                  disabled={!text}
                  className="px-2.5 py-1 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] rounded font-bold text-[var(--theme-text)] transition-colors disabled:opacity-40"
                >
                  lowercase
                </button>
                <button
                  onClick={transformTitlecase}
                  disabled={!text}
                  className="px-2.5 py-1 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] rounded font-bold text-[var(--theme-text)] transition-colors disabled:opacity-40"
                >
                  Title Case
                </button>
                <button
                  onClick={transformRemoveExtraSpaces}
                  disabled={!text}
                  className="px-2.5 py-1 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] rounded font-bold text-[var(--theme-text)] transition-colors disabled:opacity-40"
                >
                  Trim Extra Spaces
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Key Metrics & Reading Insights */}
        <div className="lg:col-span-4 space-y-4">
          {/* Primary Quick Numbers Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-4 rounded-xl space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--theme-text-muted)] block">
                Total Characters
              </span>
              <span className="text-2xl font-mono font-black text-[var(--theme-accent)]">
                {stats.totalChars.toLocaleString()}
              </span>
            </div>

            <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-4 rounded-xl space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--theme-text-muted)] block">
                Total Words
              </span>
              <span className="text-2xl font-mono font-black text-[var(--theme-text)]">
                {stats.wordCount.toLocaleString()}
              </span>
            </div>

            <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-4 rounded-xl space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--theme-text-muted)] block">
                Without Spaces
              </span>
              <span className="text-xl font-mono font-bold text-[var(--theme-text)]">
                {stats.charsNoSpaces.toLocaleString()}
              </span>
            </div>

            <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-4 rounded-xl space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-[var(--theme-text-muted)] block">
                Sentences
              </span>
              <span className="text-xl font-mono font-bold text-[var(--theme-text)]">
                {stats.sentenceCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Secondary Structural Breakdown */}
          <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-4 rounded-xl space-y-3 font-mono text-xs">
            <div className="text-[10px] font-bold uppercase text-[var(--theme-text-muted)] tracking-wider flex items-center justify-between">
              <span>Text Composition</span>
              <BarChart3 className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-[var(--theme-card-border)]/60 pb-1.5">
                <span className="text-[var(--theme-text-muted)]">Paragraphs:</span>
                <span className="font-bold text-[var(--theme-text)]">{stats.paragraphCount}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--theme-card-border)]/60 pb-1.5">
                <span className="text-[var(--theme-text-muted)]">Lines:</span>
                <span className="font-bold text-[var(--theme-text)]">{stats.lineCount}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--theme-card-border)]/60 pb-1.5">
                <span className="text-[var(--theme-text-muted)]">Letters:</span>
                <span className="font-bold text-[var(--theme-text)]">{stats.lettersCount}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[var(--theme-card-border)]/60 pb-1.5">
                <span className="text-[var(--theme-text-muted)]">Digits / Numbers:</span>
                <span className="font-bold text-[var(--theme-text)]">{stats.digitsCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--theme-text-muted)]">Spaces & Symbols:</span>
                <span className="font-bold text-[var(--theme-text)]">
                  {stats.spacesCount} sp / {stats.specialCount} sym
                </span>
              </div>
            </div>
          </div>

          {/* Time Estimations */}
          <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-4 rounded-xl space-y-3 font-mono text-xs">
            <div className="text-[10px] font-bold uppercase text-[var(--theme-text-muted)] tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
              <span>Speed Estimates</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[var(--theme-bg)] p-3 rounded-lg border border-[var(--theme-card-border)] space-y-1">
                <span className="text-[10px] text-[var(--theme-text-muted)] block flex items-center gap-1">
                  <FileText className="w-3 h-3 text-[var(--theme-accent)]" /> Reading Time
                </span>
                <span className="text-sm font-bold text-[var(--theme-text)]">
                  {formatTime(stats.readingSecs)}
                </span>
              </div>

              <div className="bg-[var(--theme-bg)] p-3 rounded-lg border border-[var(--theme-card-border)] space-y-1">
                <span className="text-[10px] text-[var(--theme-text-muted)] block flex items-center gap-1">
                  <Mic className="w-3 h-3 text-[var(--theme-accent)]" /> Speaking Time
                </span>
                <span className="text-sm font-bold text-[var(--theme-text)]">
                  {formatTime(stats.speakingSecs)}
                </span>
              </div>
            </div>
          </div>

          {/* Keyword Frequency Density */}
          {stats.topKeywords.length > 0 && (
            <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-4 rounded-xl space-y-3 font-mono text-xs">
              <div className="text-[10px] font-bold uppercase text-[var(--theme-text-muted)] tracking-wider flex items-center justify-between">
                <span>Top Keyword Density</span>
                <Sparkles className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
              </div>

              <div className="space-y-2">
                {stats.topKeywords.map((kw) => (
                  <div key={kw.word} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[var(--theme-text)] truncate">{kw.word}</span>
                      <span className="text-[var(--theme-text-muted)]">
                        {kw.count}x ({kw.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-[var(--theme-bg)] h-1.5 rounded-full overflow-hidden border border-[var(--theme-card-border)]">
                      <div
                        className="bg-[var(--theme-accent)] h-full transition-all duration-300"
                        style={{ width: `${Math.min(100, kw.percentage * 3)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
