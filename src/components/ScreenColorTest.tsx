/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react';
import { Maximize2, Minimize2, Pause, Play, X } from 'lucide-react';
import { useWakeLock } from '../hooks/useWakeLock';

type PatternMode = 'solid' | 'gradient' | 'checkerboard' | 'grayscale-ramp';

interface ModeDef {
  id: PatternMode;
  label: string;
}

const PRESETS: { name: string; hex: string }[] = [
  { name: 'Red', hex: '#ff0000' },
  { name: 'Green', hex: '#00ff00' },
  { name: 'Blue', hex: '#0000ff' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Black', hex: '#000000' },
  { name: 'Gray', hex: '#808080' },
  { name: 'Cyan', hex: '#00ffff' },
  { name: 'Magenta', hex: '#ff00ff' },
  { name: 'Yellow', hex: '#ffff00' },
];

const MODES: ModeDef[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'checkerboard', label: 'Checkerboard' },
  { id: 'grayscale-ramp', label: 'Grayscale ramp' },
];

const STORAGE_KEY = 'zerokit:screen-color-test';
const HIDE_CONTROLS_MS = 2000;

// 0–255 step ramp with hard stops so gamma/contrast banding is visible.
const GRAYSCALE_RAMP = `linear-gradient(90deg, ${Array.from({ length: 11 }, (_, i) => {
  const v = Math.round((i / 10) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${i * 10}% #${v}${v}${v}`;
}).join(', ')})`;

function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw}`.toLowerCase();
  return null;
}

function readInitialState(): { color: string; mode: PatternMode } {
  // Shared URL (?color=ff0000&mode=solid) wins over persisted state.
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const urlColor = params.get('color');
  const urlMode = params.get('mode') as PatternMode | null;
  const mode: PatternMode = MODES.some((m) => m.id === urlMode)
    ? urlMode
    : 'solid';

  if (urlColor) {
    const color = normalizeHex(`#${urlColor}`);
    if (color) return { color, mode };
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as { color?: string; mode?: PatternMode };
      const color = parsed?.color ? normalizeHex(parsed.color) : null;
      const savedMode: PatternMode = MODES.some((m) => m.id === parsed?.mode)
        ? (parsed.mode as PatternMode)
        : 'solid';
      if (color) return { color, mode: savedMode };
    }
  } catch {
    /* ignore corrupt storage */
  }

  return { color: PRESETS[0].hex, mode: 'solid' };
}

export default function ScreenColorTest() {
  const initial = useMemo(readInitialState, []);
  const [color, setColor] = useState(initial.color);
  const [mode, setMode] = useState<PatternMode>(initial.mode);
  const [scanning, setScanning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(1500);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hexText, setHexText] = useState(initial.color);

  const containerRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number | null>(null);
  const presetIndex = useRef(0);
  const controlsVisibleRef = useRef(true);
  const hexFocused = useRef(false);

  useWakeLock(scanning || isFullscreen);

  useEffect(() => {
    controlsVisibleRef.current = controlsVisible;
  }, [controlsVisible]);

  // Persist color/mode and mirror them into a shareable URL.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ color, mode }));
    } catch {
      /* storage unavailable */
    }
    const params = new URLSearchParams();
    params.set('color', color.replace('#', ''));
    params.set('mode', mode);
    const base = window.location.hash.split('?')[0];
    if (base) {
      window.history.replaceState(null, '', `${base}?${params.toString()}`);
    }
  }, [color, mode]);

  // Two-way sync for the editable hex field.
  useEffect(() => {
    if (!hexFocused.current) setHexText(color);
  }, [color]);

  // Auto-cycle scan through presets.
  useEffect(() => {
    if (!scanning) return;
    const id = window.setInterval(() => {
      presetIndex.current = (presetIndex.current + 1) % PRESETS.length;
      setColor(PRESETS[presetIndex.current].hex);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [scanning, intervalMs]);

  // Show controls on interaction and auto-hide after inactivity while
  // scanning/fullscreen. State updates are guarded by a ref so mousemove
  // storms don't re-render the component.
  const bumpIdleTimer = useCallback(() => {
    if (!controlsVisibleRef.current) {
      controlsVisibleRef.current = true;
      setControlsVisible(true);
    }
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    if (scanning || isFullscreen) {
      idleTimer.current = window.setTimeout(() => {
        controlsVisibleRef.current = false;
        setControlsVisible(false);
      }, HIDE_CONTROLS_MS);
    }
  }, [scanning, isFullscreen]);

  useEffect(() => {
    bumpIdleTimer();
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [bumpIdleTimer]);

  const exitFullscreen = useCallback(async () => {
    const doc = document as Document & { webkitExitFullscreen?: () => void };
    if (document.fullscreenElement) {
      try {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      } catch {
        /* ignore */
      }
    }
    setIsFullscreen(false);
  }, []);

  const enterFullscreen = useCallback(async () => {
    const el = (containerRef.current ?? document.documentElement) as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } catch {
      /* Fullscreen API unavailable (e.g. iOS Safari) — the fixed overlay still fills the viewport. */
    }
    setIsFullscreen(true);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) void exitFullscreen();
    else void enterFullscreen();
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    const onFsChange = () => {
      const inFs =
        !!document.fullscreenElement ||
        !!(document as Document & { webkitFullscreenElement?: Element })
          .webkitFullscreenElement;
      setIsFullscreen(inFs);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Keyboard: Space toggles play-pause, arrows step colors, Esc stops the scan
  // and exits fullscreen. Registered in the capture phase so Esc takes
  // precedence over the app-wide handler that navigates back to the directory.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? '';
      const inFormField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

      if (e.code === 'Space') {
        if (inFormField) return;
        e.preventDefault();
        setScanning((s) => !s);
        bumpIdleTimer();
      } else if (e.code === 'ArrowRight') {
        if (inFormField) return;
        e.preventDefault();
        presetIndex.current = (presetIndex.current + 1) % PRESETS.length;
        setColor(PRESETS[presetIndex.current].hex);
        bumpIdleTimer();
      } else if (e.code === 'ArrowLeft') {
        if (inFormField) return;
        e.preventDefault();
        presetIndex.current = (presetIndex.current - 1 + PRESETS.length) % PRESETS.length;
        setColor(PRESETS[presetIndex.current].hex);
        bumpIdleTimer();
      } else if (e.key === 'Escape') {
        if (scanning || isFullscreen) {
          e.stopImmediatePropagation();
          e.preventDefault();
          setScanning(false);
          controlsVisibleRef.current = true;
          setControlsVisible(true);
          void exitFullscreen();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [bumpIdleTimer, scanning, isFullscreen, exitFullscreen]);

  // Tap toggles play-pause and re-surfaces the controls.
  const handleBackgroundTap = useCallback(() => {
    setScanning((s) => !s);
    bumpIdleTimer();
  }, [bumpIdleTimer]);

  const handleHexChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHexText(value);
    const normalized = normalizeHex(value);
    if (normalized) setColor(normalized);
  }, []);

  const handleHexBlur = useCallback(() => {
    hexFocused.current = false;
    setHexText(color);
  }, [color]);

  const handleClose = useCallback(() => {
    window.location.hash = '';
  }, []);

  const backgroundStyle = useMemo<CSSProperties>(() => {
    switch (mode) {
      case 'gradient':
        return {
          backgroundImage: `linear-gradient(100deg, #000 0%, ${color} 50%, #fff 100%)`,
          backgroundSize: '200% 100%',
        };
      case 'checkerboard':
        return {
          backgroundImage: [
            `linear-gradient(45deg, ${color} 25%, transparent 25%)`,
            `linear-gradient(-45deg, ${color} 25%, transparent 25%)`,
            `linear-gradient(45deg, transparent 75%, ${color} 75%)`,
            `linear-gradient(-45deg, transparent 75%, ${color} 75%)`,
          ].join(', '),
          backgroundSize: '40px 40px',
          backgroundPosition: '0 0, 0 20px, 20px -20px, -20px 0px',
          backgroundColor: '#000',
        };
      case 'grayscale-ramp':
        return { backgroundImage: GRAYSCALE_RAMP };
      case 'solid':
      default:
        return { backgroundColor: color };
    }
  }, [mode, color]);

  const modeLabel = useMemo(
    () => MODES.find((m) => m.id === mode)?.label ?? mode,
    [mode],
  );

  const rootClass = isFullscreen
    ? 'fixed inset-0 z-[9999] rounded-none border-0'
    : 'relative w-full h-[65vh] min-h-[420px] rounded-2xl border border-[var(--theme-card-border)] shadow-xl';

  return (
    <div
      ref={containerRef}
      onMouseMove={bumpIdleTimer}
      onTouchStart={bumpIdleTimer}
      className={`${rootClass} select-none overflow-hidden bg-black transition-colors duration-200 motion-reduce:transition-none`}
    >
      <div
        aria-hidden="true"
        onClick={handleBackgroundTap}
        className={`absolute inset-0 ${
          mode === 'gradient' ? 'animate-gradient-sweep motion-reduce:animate-none' : ''
        }`}
        style={backgroundStyle}
      />

      {/* Status badge */}
      <div
        className={`pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-black/50 px-2.5 py-1.5 font-mono text-[11px] text-white/90 backdrop-blur-sm transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {color} · {modeLabel}
        {scanning && <span className="ml-2 text-emerald-400">● scanning</span>}
      </div>

      {/* Controls overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 border-t border-white/10 bg-black/50 p-3 backdrop-blur-md transition-opacity duration-300 sm:p-4 ${
          controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={p.hex}
              type="button"
              aria-label={`Set color ${p.name}`}
              aria-pressed={color.toLowerCase() === p.hex}
              title={p.name}
              onClick={() => {
                presetIndex.current = i;
                setColor(p.hex);
              }}
              className={`h-9 w-9 rounded-lg border border-white/25 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 active:scale-95 ${
                color.toLowerCase() === p.hex ? 'ring-2 ring-white' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: p.hex }}
            />
          ))}

          <input
            type="color"
            aria-label="Custom color picker"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-lg bg-transparent"
          />

          <input
            type="text"
            aria-label="Hex color value"
            value={hexText}
            onFocus={() => {
              hexFocused.current = true;
            }}
            onBlur={handleHexBlur}
            onChange={handleHexChange}
            spellCheck={false}
            className="w-24 rounded-lg bg-white/10 px-2 py-1.5 font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/60"
          />

          <button
            type="button"
            aria-label="Close screen color test"
            title="Close"
            onClick={handleClose}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white">
          <label className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-white/60">Mode</span>
            <select
              aria-label="Pattern mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as PatternMode)}
              className="rounded-lg bg-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            aria-label={scanning ? 'Pause scan' : 'Start scan'}
            onClick={() => setScanning((s) => !s)}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {scanning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {scanning ? 'Pause' : 'Start scan'}
          </button>

          <label className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-white/60">Interval</span>
            <input
              type="range"
              min={500}
              max={5000}
              step={250}
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
              className="w-28 accent-white"
            />
            <span className="w-12 font-mono text-xs text-white/70">
              {(intervalMs / 1000).toFixed(2)}s
            </span>
          </label>

          <button
            type="button"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onClick={toggleFullscreen}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isFullscreen ? 'Exit' : 'Fullscreen'}
          </button>
        </div>
      </div>
    </div>
  );
}
