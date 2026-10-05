/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Keyboard, MousePointer, RotateCcw, Activity, Lock, Unlock, ShieldAlert, Gauge, Zap } from 'lucide-react';

interface KeyMapItem {
  code: string;
  label: string;
  widthClass?: string;
}

interface ClickCount {
  left: number;
  right: number;
  middle: number;
  back: number;
  forward: number;
}

export default function KeyboardMouseTest() {
  // Strict mode lock state
  const [strictMode, setStrictMode] = useState<boolean>(true);
  const strictModeRef = useRef<boolean>(true);

  // Keyboard testing states
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [lastKeyInfo, setLastKeyInfo] = useState<{ key: string; code: string } | null>(null);
  const [maxRollover, setMaxRollover] = useState<number>(0);
  const [keyLatencies, setKeyLatencies] = useState<{ code: string; duration: number; timestamp: number }[]>([]);
  const keyDownTimes = useRef<Map<string, number>>(new Map());

  // Mouse testing states
  const [mouseActive, setMouseActive] = useState<{
    left: boolean;
    right: boolean;
    middle: boolean;
    back: boolean;
    forward: boolean;
  }>({
    left: false,
    right: false,
    middle: false,
    back: false,
    forward: false,
  });

  const [mouseClickedHistory, setMouseClickedHistory] = useState<{
    left: boolean;
    right: boolean;
    middle: boolean;
    back: boolean;
    forward: boolean;
  }>({
    left: false,
    right: false,
    middle: false,
    back: false,
    forward: false,
  });

  const [clickCounts, setClickCounts] = useState<ClickCount>({
    left: 0,
    right: 0,
    middle: 0,
    back: 0,
    forward: 0,
  });
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scrollDelta, setScrollDelta] = useState<number>(0);
  const [lastClickType, setLastClickType] = useState<string>('None');

  // Advanced mouse states
  const [cps, setCps] = useState<number>(0);
  const [doubleClickWarnings, setDoubleClickWarnings] = useState<{ button: string; interval: number; timestamp: number }[]>([]);
  const clickTimestamps = useRef<number[]>([]);
  const lastClickTimes = useRef<{ [key: string]: number }>({});

  // Sync ref with strict mode state
  useEffect(() => {
    strictModeRef.current = strictMode;
    // Lock scrolling on document body during strict test mode to ensure no page scroll or other UI elements run
    if (strictMode) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [strictMode]);

  // CPS recalculation tick
  useEffect(() => {
    const cpsInterval = setInterval(() => {
      const oneSecondAgo = Date.now() - 1000;
      clickTimestamps.current = clickTimestamps.current.filter(t => t > oneSecondAgo);
      setCps(clickTimestamps.current.length);
    }, 100);
    return () => clearInterval(cpsInterval);
  }, []);

  // Canvas ref for tracking precision trail
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Full extended Keyboard Layout Rows (Includes Function Keys, Main keyboard, Navigation block, and Numpad)
  const mainKeyboardRows: KeyMapItem[][] = [
    // Fn row
    [
      { code: 'Escape', label: 'ESC', widthClass: 'w-[44px]' },
      { code: 'Space_Spacer1', label: '', widthClass: 'w-6 bg-transparent border-none pointer-events-none' },
      { code: 'F1', label: 'F1', widthClass: 'w-[38px]' },
      { code: 'F2', label: 'F2', widthClass: 'w-[38px]' },
      { code: 'F3', label: 'F3', widthClass: 'w-[38px]' },
      { code: 'F4', label: 'F4', widthClass: 'w-[38px]' },
      { code: 'Space_Spacer2', label: '', widthClass: 'w-4 bg-transparent border-none pointer-events-none' },
      { code: 'F5', label: 'F5', widthClass: 'w-[38px]' },
      { code: 'F6', label: 'F6', widthClass: 'w-[38px]' },
      { code: 'F7', label: 'F7', widthClass: 'w-[38px]' },
      { code: 'F8', label: 'F8', widthClass: 'w-[38px]' },
      { code: 'Space_Spacer3', label: '', widthClass: 'w-4 bg-transparent border-none pointer-events-none' },
      { code: 'F9', label: 'F9', widthClass: 'w-[38px]' },
      { code: 'F10', label: 'F10', widthClass: 'w-[38px]' },
      { code: 'F11', label: 'F11', widthClass: 'w-[38px]' },
      { code: 'F12', label: 'F12', widthClass: 'w-[38px]' },
    ],
    // Key rows
    [
      { code: 'Backquote', label: '` ~', widthClass: 'w-9' },
      { code: 'Digit1', label: '1 !', widthClass: 'w-9' },
      { code: 'Digit2', label: '2 @', widthClass: 'w-9' },
      { code: 'Digit3', label: '3 #', widthClass: 'w-9' },
      { code: 'Digit4', label: '4 $', widthClass: 'w-9' },
      { code: 'Digit5', label: '5 %', widthClass: 'w-9' },
      { code: 'Digit6', label: '6 ^', widthClass: 'w-9' },
      { code: 'Digit7', label: '7 &', widthClass: 'w-9' },
      { code: 'Digit8', label: '8 *', widthClass: 'w-9' },
      { code: 'Digit9', label: '9 (', widthClass: 'w-9' },
      { code: 'Digit0', label: '0 )', widthClass: 'w-9' },
      { code: 'Minus', label: '- _', widthClass: 'w-9' },
      { code: 'Equal', label: '= +', widthClass: 'w-9' },
      { code: 'Backspace', label: 'Backspace ⟵', widthClass: 'w-[84px]' },
    ],
    [
      { code: 'Tab', label: 'Tab ↹', widthClass: 'w-[52px]' },
      { code: 'KeyQ', label: 'Q', widthClass: 'w-9' },
      { code: 'KeyW', label: 'W', widthClass: 'w-9' },
      { code: 'KeyE', label: 'E', widthClass: 'w-9' },
      { code: 'KeyR', label: 'R', widthClass: 'w-9' },
      { code: 'KeyT', label: 'T', widthClass: 'w-9' },
      { code: 'KeyY', label: 'Y', widthClass: 'w-9' },
      { code: 'KeyU', label: 'U', widthClass: 'w-9' },
      { code: 'KeyI', label: 'I', widthClass: 'w-9' },
      { code: 'KeyO', label: 'O', widthClass: 'w-9' },
      { code: 'KeyP', label: 'P', widthClass: 'w-9' },
      { code: 'BracketLeft', label: '[ {', widthClass: 'w-9' },
      { code: 'BracketRight', label: '] }', widthClass: 'w-9' },
      { code: 'Backslash', label: '\\ |', widthClass: 'w-[56px]' },
    ],
    [
      { code: 'CapsLock', label: 'Caps ⇪', widthClass: 'w-[64px]' },
      { code: 'KeyA', label: 'A', widthClass: 'w-9' },
      { code: 'KeyS', label: 'S', widthClass: 'w-9' },
      { code: 'KeyD', label: 'D', widthClass: 'w-9' },
      { code: 'KeyF', label: 'F', widthClass: 'w-9' },
      { code: 'KeyG', label: 'G', widthClass: 'w-9' },
      { code: 'KeyH', label: 'H', widthClass: 'w-9' },
      { code: 'KeyJ', label: 'J', widthClass: 'w-9' },
      { code: 'KeyK', label: 'K', widthClass: 'w-9' },
      { code: 'KeyL', label: 'L', widthClass: 'w-9' },
      { code: 'Semicolon', label: '; :', widthClass: 'w-9' },
      { code: 'Quote', label: '\' "', widthClass: 'w-9' },
      { code: 'Enter', label: 'Enter ↵', widthClass: 'w-[80px]' },
    ],
    [
      { code: 'ShiftLeft', label: 'Shift ⇧', widthClass: 'w-[84px]' },
      { code: 'KeyZ', label: 'Z', widthClass: 'w-9' },
      { code: 'KeyX', label: 'X', widthClass: 'w-9' },
      { code: 'KeyC', label: 'C', widthClass: 'w-9' },
      { code: 'KeyV', label: 'V', widthClass: 'w-9' },
      { code: 'KeyB', label: 'B', widthClass: 'w-9' },
      { code: 'KeyN', label: 'N', widthClass: 'w-9' },
      { code: 'KeyM', label: 'M', widthClass: 'w-9' },
      { code: 'Comma', label: ', <', widthClass: 'w-9' },
      { code: 'Period', label: '. >', widthClass: 'w-9' },
      { code: 'Slash', label: '/ ?', widthClass: 'w-9' },
      { code: 'ShiftRight', label: 'Shift ⇧', widthClass: 'w-[96px]' },
    ],
    [
      { code: 'ControlLeft', label: 'Ctrl', widthClass: 'w-[44px]' },
      { code: 'MetaLeft', label: 'Win ⊞', widthClass: 'w-[44px]' },
      { code: 'AltLeft', label: 'Alt', widthClass: 'w-[44px]' },
      { code: 'Space', label: 'Spacebar', widthClass: 'w-[252px]' },
      { code: 'AltRight', label: 'Alt', widthClass: 'w-[44px]' },
      { code: 'MetaRight', label: 'Win ⊞', widthClass: 'w-[44px]' },
      { code: 'ContextMenu', label: 'Menu ≣', widthClass: 'w-[44px]' },
      { code: 'ControlRight', label: 'Ctrl', widthClass: 'w-[44px]' },
    ],
  ];

  // Navigation Panel (Insert, Home, PgUp, Delete, End, PgDn, and arrows)
  const navClusterRows: KeyMapItem[][] = [
    [
      { code: 'PrintScreen', label: 'PrtSc' },
      { code: 'ScrollLock', label: 'ScrLk' },
      { code: 'Pause', label: 'Pause' },
    ],
    [
      { code: 'Insert', label: 'Ins' },
      { code: 'Home', label: 'Home' },
      { code: 'PageUp', label: 'PgUp' },
    ],
    [
      { code: 'Delete', label: 'Del' },
      { code: 'End', label: 'End' },
      { code: 'PageDown', label: 'PgDn' },
    ],
    [
      { code: 'Spacer_Nav1', label: '', widthClass: 'h-9 bg-transparent border-none pointer-events-none' },
      { code: 'Spacer_Nav2', label: '', widthClass: 'h-9 bg-transparent border-none pointer-events-none' },
      { code: 'Spacer_Nav3', label: '', widthClass: 'h-9 bg-transparent border-none pointer-events-none' },
    ],
    [
      { code: 'Spacer_ArrowUp', label: '', widthClass: 'bg-transparent border-none pointer-events-none' },
      { code: 'ArrowUp', label: '▲' },
      { code: 'Spacer_ArrowUp2', label: '', widthClass: 'bg-transparent border-none pointer-events-none' },
    ],
    [
      { code: 'ArrowLeft', label: '◀' },
      { code: 'ArrowDown', label: '▼' },
      { code: 'ArrowRight', label: '▶' },
    ],
  ];

  // Keypad cluster
  const numpadCluster: KeyMapItem[][] = [
    [
      { code: 'NumLock', label: 'Num' },
      { code: 'NumpadDivide', label: '/' },
      { code: 'NumpadMultiply', label: '*' },
      { code: 'NumpadSubtract', label: '-' },
    ],
    [
      { code: 'Numpad7', label: '7' },
      { code: 'Numpad8', label: '8' },
      { code: 'Numpad9', label: '9' },
      { code: 'NumpadAdd', label: '+', widthClass: 'row-span-2 h-[76px]' },
    ],
    [
      { code: 'Numpad4', label: '4' },
      { code: 'Numpad5', label: '5' },
      { code: 'Numpad6', label: '6' },
      // Added row spacer implicitly because NumpadAdd is row-span
    ],
    [
      { code: 'Numpad1', label: '1' },
      { code: 'Numpad2', label: '2' },
      { code: 'Numpad3', label: '3' },
      { code: 'NumpadEnter', label: 'Ent', widthClass: 'row-span-2 h-[76px]' },
    ],
    [
      { code: 'Numpad0', label: '0', widthClass: 'col-span-2 w-[82px]' },
      { code: 'NumpadDecimal', label: '.' },
    ],
  ];

  // Monitor physical keyboard rules with strict mode support and metrics
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If strict mode is enabled, prevent default behavior for all keys to keep standard screen processes/scrolling locked
      if (strictModeRef.current) {
        e.preventDefault();
      } else {
        // Fallback standard behavior: only block common disruptive ones
        if (
          e.code === 'Tab' ||
          e.code === 'Backspace' ||
          e.code === 'F1' ||
          e.code === 'F3' ||
          e.code === 'F5' ||
          e.code === 'F6' ||
          e.code === 'F11' ||
          e.code === 'AltLeft' ||
          e.code === 'AltRight' ||
          (e.code === 'KeyD' && e.ctrlKey)
        ) {
          e.preventDefault();
        }
      }

      setLastKeyInfo({ key: e.key, code: e.code });

      // Track key down timestamp for precision latency measurements
      if (!keyDownTimes.current.has(e.code)) {
        keyDownTimes.current.set(e.code, performance.now());
      }

      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.add(e.code);
        return next;
      });

      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.add(e.code);
        // Measure active rollover peaks
        if (next.size > maxRollover) {
          setMaxRollover(next.size);
        }
        return next;
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (strictModeRef.current) {
        e.preventDefault();
      }

      // Calculate holding latency
      const downTime = keyDownTimes.current.get(e.code);
      if (downTime) {
        const duration = Math.round(performance.now() - downTime);
        keyDownTimes.current.delete(e.code);
        
        // Push latency log
        setKeyLatencies((prev) => [
          { code: e.code, duration, timestamp: Date.now() },
          ...prev
        ].slice(0, 8)); // Keep last 8 entries
      }

      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(e.code);
        return next;
      });
    };

    const preventDefaultWheel = (e: WheelEvent) => {
      if (strictModeRef.current) {
        e.preventDefault();
      }
    };

    // Global listeners
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('wheel', preventDefaultWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('wheel', preventDefaultWheel);
    };
  }, [maxRollover]);

  // Monitor mouse canvas resizing and initialization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height || 200;
        drawCanvasGrid(ctx, canvas.width, canvas.height);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const drawCanvasGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = 'rgba(81, 95, 116, 0.08)';
    ctx.lineWidth = 1;
    const step = 20;

    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(81, 95, 116, 0.4)';
    ctx.fillText('MOUSE TRACKING OVERLAY (CLICK & DRAG TO TEST POLLING INTERPOLATION)', 15, h - 15);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#10B981'; // Green-500
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    setMousePosition({ x, y });

    if (!isDrawing) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCanvasGrid(ctx, canvas.width, canvas.height);
  };

  // Center Mouse Action Box & Interactive Device handlers
  const handleGenericMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const btn = e.button; 
    let type = '';
    let btnName = '';

    const btnStates = { left: false, right: false, middle: false, back: false, forward: false };

    if (btn === 0) {
      btnStates.left = true;
      type = 'Left Click';
      btnName = 'Left';
    } else if (btn === 1) {
      btnStates.middle = true;
      type = 'Middle Click';
      btnName = 'Middle';
    } else if (btn === 2) {
      btnStates.right = true;
      type = 'Right Click';
      btnName = 'Right';
    } else if (btn === 3) {
      btnStates.back = true;
      type = 'Side Back (Btn 4)';
      btnName = 'Back';
    } else if (btn === 4) {
      btnStates.forward = true;
      type = 'Side Forward (Btn 5)';
      btnName = 'Forward';
    }

    // Measure click speed (CPS)
    if (btnName === 'Left' || btnName === 'Right') {
      clickTimestamps.current.push(Date.now());
    }

    // Double-click fault measurement (Debounce threshold check)
    if (btnName) {
      const now = performance.now();
      const lastTime = lastClickTimes.current[btnName];
      if (lastTime) {
        const interval = now - lastTime;
        if (interval > 8 && interval < 80) { // between 8ms and 80ms is highly indicative of switch-bouncing double-click issues
          setDoubleClickWarnings((prev) => [
            { button: btnName, interval: Math.round(interval), timestamp: Date.now() },
            ...prev
          ].slice(0, 5));
        }
      }
      lastClickTimes.current[btnName] = now;
    }

    setMouseActive((prev) => ({
      ...prev,
      ...btnStates
    }));

    setMouseClickedHistory((prev) => ({
      ...prev,
      left: prev.left || btnStates.left,
      right: prev.right || btnStates.right,
      middle: prev.middle || btnStates.middle,
      back: prev.back || btnStates.back,
      forward: prev.forward || btnStates.forward,
    }));

    setClickCounts((prev) => ({
      left: prev.left + (btn === 0 ? 1 : 0),
      right: prev.right + (btn === 2 ? 1 : 0),
      middle: prev.middle + (btn === 1 ? 1 : 0),
      back: prev.back + (btn === 3 ? 1 : 0),
      forward: prev.forward + (btn === 4 ? 1 : 0),
    }));

    setLastClickType(type);
  };

  const handleGenericMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setMouseActive({
      left: false,
      right: false,
      middle: false,
      back: false,
      forward: false,
    });
  };

  const handleGenericWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    setScrollDelta((prev) => prev + Math.sign(e.deltaY));
  };

  const resetAllTests = () => {
    setPressedKeys(new Set());
    setActiveKeys(new Set());
    setLastKeyInfo(null);
    setMaxRollover(0);
    setKeyLatencies([]);
    setDoubleClickWarnings([]);
    keyDownTimes.current.clear();
    clickTimestamps.current = [];
    lastClickTimes.current = {};
    setClickCounts({ left: 0, right: 0, middle: 0, back: 0, forward: 0 });
    setMouseActive({ left: false, right: false, middle: false, back: false, forward: false });
    setMouseClickedHistory({ left: false, right: false, middle: false, back: false, forward: false });
    setScrollDelta(0);
    setLastClickType('None');
    clearCanvas();
  };

  return (
    <div className="space-y-8">
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--theme-card-border)] pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--theme-text)] flex items-center gap-2">
            <Keyboard className="w-6 h-6 text-emerald-500" />
            <span>Interactive Keyboard & Mouse Tester</span>
          </h2>
          <p className="text-xs text-[var(--theme-text-muted)] mt-1">
            Test key anti-ghosting signals, millisecond switch latencies, clicks-per-second, and detect mechanical double-click faults.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStrictMode(!strictMode)}
            className={`flex items-center gap-2 px-4 py-2 border rounded text-xs font-mono font-bold uppercase transition-all shadow-sm active:scale-95 ${
              strictMode 
                ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600' 
                : 'bg-[var(--theme-bg)] text-[var(--theme-text-muted)] border-[var(--theme-card-border)] hover:border-neutral-400'
            }`}
            type="button"
            title="When active, intercepts all browser shortcuts, keyboard scrolling, and default mouse events globally to prevent other programs from running."
          >
            {strictMode ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{strictMode ? 'Strict Capture: ENGAGED' : 'Strict Capture: DISABLED'}</span>
          </button>

          <button
            onClick={resetAllTests}
            className="flex items-center gap-2 px-4 py-2 border border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/10 text-xs font-mono font-bold uppercase transition-all rounded text-emerald-400 bg-[var(--theme-bg)] shadow-sm active:scale-95"
            type="button"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Reset Console</span>
          </button>
        </div>
      </div>

      {/* STRICT MODE EXPLANATION ACCURACY WARNING BANNER */}
      {strictMode ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-lg text-xs space-y-1.5 shadow-sm">
          <div className="flex items-center gap-1.5 font-bold">
            <Lock className="w-4 h-4 text-emerald-500" />
            <span>Strict Input Lock Mode is Active</span>
          </div>
          <p className="leading-relaxed">
            All default browser shortcuts (e.g. <b>Tab, Backspace, Arrow keys, spacebar, F1-F12, mouse wheels, right-clicks</b>) are temporarily locked. 
            This ensures that during the diagnostic testing, other background browser behaviors, page scrolling, or other page components are <b>completely suppressed</b>.
            Test your inputs smoothly without page jumps. Click the <b>Strict Capture</b> toggle button above to release events.
          </p>
        </div>
      ) : (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-lg text-xs space-y-1.5 shadow-sm">
          <div className="flex items-center gap-1.5 font-bold">
            <Unlock className="w-4 h-4 text-amber-500" />
            <span>Standard Capture Mode is Active</span>
          </div>
          <p className="leading-relaxed">
            Events are not blocked globally. Clicking Backspace or scrolling the page with Arrow keys / Spacebar might result in the browser navigating back or page jumping.
            We recommend enabling <b>Strict Capture Mode</b> at the top-right for a perfect hardware test.
          </p>
        </div>
      )}

      {/* KEYBOARD FULL MATRIX PANEL */}
      <div className="border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] p-5 md:p-6 rounded-lg space-y-6 shadow-sm overflow-hidden">
        
        <div className="flex items-center justify-between border-b border-[var(--theme-card-border)] pb-3">
          <span className="text-xs font-extrabold uppercase font-mono tracking-wider flex items-center gap-1.5 text-[var(--theme-text)]">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span>Complete Full Keyboard Layout Matrix</span>
          </span>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold px-2 py-0.5 rounded uppercase">
            Registered: {pressedKeys.size} Unique Keys
          </span>
        </div>

        {lastKeyInfo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-[var(--theme-bg)]/80 border border-[var(--theme-card-border)] rounded text-xs font-mono">
            <div>
              <span className="text-[9px] text-[var(--theme-text-muted)] block uppercase font-bold">Physical Key Name</span>
              <span className="font-bold text-[var(--theme-text)] text-sm">{lastKeyInfo.key || 'Space'}</span>
            </div>
            <div>
              <span className="text-[9px] text-[var(--theme-text-muted)] block uppercase font-bold">Key Code Standard</span>
              <span className="font-bold text-emerald-500 text-sm">{lastKeyInfo.code}</span>
            </div>
            <div>
              <span className="text-[9px] text-[var(--theme-text-muted)] block uppercase font-bold">Key Rollover (Peak)</span>
              <span className="text-emerald-500 font-extrabold text-sm">{maxRollover} Keys (Anti-Ghosting)</span>
            </div>
            <div>
              <span className="text-[9px] text-[var(--theme-text-muted)] block uppercase font-bold">Signal Connection</span>
              <span className="text-emerald-500 font-extrabold tracking-widest text-sm uppercase animate-pulse">
                {activeKeys.size > 0 ? 'RECEIVING' : 'STANDBY'}
              </span>
            </div>
          </div>
        )}

        {/* Scrollable Layout Container containing Main block, arrow/nav blocks, and Numpad block side-by-side */}
        <div className="overflow-x-auto pb-4 select-none">
          <div className="inline-flex gap-6 min-w-[1100px] p-2 bg-[var(--theme-bg)]/40 border border-[var(--theme-card-border)] rounded-lg">
            
            {/* 1. Main QWERTY Key Block */}
            <div className="space-y-1.5">
              {mainKeyboardRows.map((row, rowIndex) => (
                <div key={`main-${rowIndex}`} className="flex gap-1">
                  {row.map((item) => {
                    const isPressed = pressedKeys.has(item.code);
                    const isActive = activeKeys.has(item.code);
 
                    let keyColor = 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] hover:border-neutral-400';
                    if (isActive) {
                      keyColor = 'bg-emerald-500 text-white border-emerald-600 scale-[0.97]';
                    } else if (isPressed) {
                      keyColor = 'bg-emerald-600/35 text-emerald-400 border-emerald-500/60 font-bold';
                    }

                    return (
                      <div
                        key={item.code}
                        className={`h-[42px] rounded border border-[var(--theme-card-border)] flex flex-col justify-center items-center text-[10px] font-bold font-mono transition-all duration-75 text-center ${
                          item.widthClass || 'w-9'
                        } ${keyColor}`}
                      >
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* 2. Navigation Cluster Block (Arrow navigation keys) */}
            <div className="space-y-1.5 w-[124px]">
              {navClusterRows.map((row, rowIndex) => (
                <div key={`nav-${rowIndex}`} className="flex gap-1 justify-center">
                  {row.map((item) => {
                    const isPressed = pressedKeys.has(item.code);
                    const isActive = activeKeys.has(item.code);

                    let keyColor = 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] hover:border-neutral-400';
                    if (isActive) {
                      keyColor = 'bg-emerald-500 text-white border-emerald-600 scale-[0.97]';
                    } else if (isPressed) {
                      keyColor = 'bg-emerald-600/35 text-emerald-400 border-emerald-500/60 font-bold';
                    }

                    return (
                      <div
                        key={item.code}
                        className={`h-[42px] w-[38px] rounded border border-[var(--theme-card-border)] flex flex-col justify-center items-center text-[9px] font-bold font-mono transition-all duration-75 text-center ${
                          item.widthClass || ''
                        } ${keyColor}`}
                      >
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* 3. Number Pad (Numpad) Cluster Block */}
            <div className="space-y-1.5 w-[164px]">
              <div className="grid grid-cols-4 gap-1">
                {numpadCluster.map((row, rowIndex) => (
                  <React.Fragment key={`num-row-${rowIndex}`}>
                    {row.map((item) => {
                      const isPressed = pressedKeys.has(item.code);
                      const isActive = activeKeys.has(item.code);

                      let keyColor = 'bg-[var(--theme-card-bg)] text-[var(--theme-text)] hover:border-neutral-400';
                      if (isActive) {
                        keyColor = 'bg-emerald-500 text-white border-emerald-600 scale-[0.97]';
                      } else if (isPressed) {
                        keyColor = 'bg-emerald-600/35 text-emerald-400 border-emerald-500/60 font-bold';
                      }

                      return (
                        <div
                          key={item.code}
                          className={`rounded border border-[var(--theme-card-border)] flex flex-col justify-center items-center text-[10px] font-bold font-mono transition-all duration-75 text-center ${
                            item.code === 'Numpad0' ? 'col-span-2 h-[42px]' : 'h-[42px]'
                          } ${item.widthClass || 'w-[36px]'} ${keyColor}`}
                        >
                          {item.label}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Legend block bar */}
        <div className="text-[11px] font-mono text-[var(--theme-text-muted)] flex flex-wrap gap-x-6 gap-y-2 pt-2 border-t border-[var(--theme-card-border)]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-sm"></span>
            <span>Unpressed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-emerald-600/35 border border-emerald-500 border-dashed rounded-sm"></span>
            <span>Registered Signal (Pressed / Green)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-emerald-500 rounded-sm"></span>
            <span>Currently Held Down</span>
          </div>
        </div>

      </div>

      {/* ADVANCED STATS PANEL GRID (Key Latencies and Double click detectors) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* KEY HOLDING DURATION REGISTRATION LOG */}
        <div className="border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] p-5 md:p-6 rounded-lg space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-extrabold uppercase font-mono tracking-wider text-[var(--theme-text)] flex items-center gap-1.5 border-b border-[var(--theme-card-border)] pb-2.5">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span>Keyboard Hold Duration & Latency Log</span>
            </h3>
            <p className="text-[11px] text-[var(--theme-text-muted)] mt-1.5">
              Registers exact holding intervals (ms) from keystroke trigger up to release. Test double tapping speeds.
            </p>
            
            <div className="mt-4 space-y-2 max-h-[160px] overflow-y-auto font-mono text-xs pr-1">
              {keyLatencies.length === 0 ? (
                <div className="text-[11px] text-[var(--theme-text-muted)] italic py-8 text-center bg-[var(--theme-bg)] border border-[var(--theme-card-border)] rounded">
                  No keystroke releases recorded yet. Hold and release keys above.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {keyLatencies.map((log, i) => (
                    <div 
                      key={`${log.code}-${log.timestamp}-${i}`} 
                      className="flex justify-between items-center bg-[var(--theme-bg)] border border-[var(--theme-card-border)] px-3 py-1.5 rounded text-[11px] transition-all hover:border-emerald-500/40"
                    >
                      <span className="font-bold text-[var(--theme-text)]">{log.code}</span>
                      <span className="font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                        {log.duration} ms
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-[10px] text-[var(--theme-text-muted)] font-mono pt-2 border-t border-[var(--theme-card-border)]">
            ⚡ Accurate hardware debounce loops evaluate signals in real-time.
          </div>
        </div>

        {/* MECHANICAL MOUSE DOUBLE-CLICK FAULT DETECTOR */}
        <div className="border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] p-5 md:p-6 rounded-lg space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-extrabold uppercase font-mono tracking-wider text-[var(--theme-text)] flex items-center gap-1.5 border-b border-[var(--theme-card-border)] pb-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-500 animate-bounce" />
              <span>Mouse Switch Bouncing (Double-Click) Tester</span>
            </h3>
            <p className="text-[11px] text-[var(--theme-text-muted)] mt-1.5">
              Flags clicking intervals below <b>80ms</b> which typically pinpoint mechanical microswitch degradation (chatter).
            </p>
            
            <div className="mt-4 space-y-2 max-h-[160px] overflow-y-auto font-mono text-xs pr-1">
              {doubleClickWarnings.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-[11px] py-6 px-3 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/15 rounded text-center h-full">
                  <span className="font-bold block text-sm">✔️ Switch Health Normal</span>
                  <span className="mt-1 block text-[10px] text-[var(--theme-text-muted)]">No rapid mechanical chatter or accidental double-clicks registered yet.</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {doubleClickWarnings.map((warn, i) => (
                    <div 
                      key={`${warn.button}-${warn.timestamp}-${i}`} 
                      className="bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded text-[11px] flex justify-between items-center text-rose-600 dark:text-rose-400"
                    >
                      <span className="font-bold flex items-center gap-1">
                        ⚠️ Rapid chatter: {warn.button} Button
                      </span>
                      <span className="font-black bg-rose-500/20 px-1.5 py-0.5 rounded">
                        Interval: {warn.interval}ms
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-[10px] text-[var(--theme-text-muted)] font-mono pt-2 border-t border-[var(--theme-card-border)]">
            💡 Mechanical buttons should trigger &gt; 100ms intervals during normal typing.
          </div>
        </div>
      </div>

      {/* MOUSE PANEL GRID (SVG CAD Mouse & Precise Track Canvas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* INTERACTIVE COMPOSITE MOUSE GRAPHICAL DESIGN */}
        <div className="lg:col-span-5">
          <div className="border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] p-6 rounded-lg space-y-6 shadow-sm h-full flex flex-col justify-between">
            
            <div className="flex items-center justify-between border-b border-[var(--theme-card-border)] pb-2.5">
              <span className="text-xs font-extrabold uppercase font-mono tracking-wider text-[var(--theme-text)] flex items-center gap-1.5">
                <MousePointer className="w-4 h-4 text-emerald-500" />
                <span>Hardware Mouse CAD Design</span>
              </span>
              
              <div className="flex items-center gap-1 font-mono text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-black">
                <Gauge className="w-3.5 h-3.5" />
                <span>{cps} CPS</span>
              </div>
            </div>

            {/* Main Interactive CAD Mouse Block */}
            <div 
              onMouseDown={handleGenericMouseDown}
              onMouseUp={handleGenericMouseUp}
              onWheel={handleGenericWheel}
              onContextMenu={(e) => e.preventDefault()}
              className="flex justify-center items-center py-6 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] rounded-md cursor-crosshair select-none relative"
            >
              {/* CAD mouse design framework */}
              <div className="w-[180px] h-[280px] rounded-[60px] border-4 border-dashed border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] shadow-md relative flex flex-col justify-start items-center p-1 overflow-hidden">
                
                {/* Horizontal line breaking left-right-wheel boundaries */}
                <span className="absolute top-[100px] left-0 right-0 h-[2px] bg-[var(--theme-card-border)] border-dashed z-0" />
                {/* Vertical line splitting Left & Right Click clicks */}
                <span className="absolute top-0 bottom-[180px] left-[50%] w-[2px] bg-[var(--theme-card-border)] border-dashed z-0" />

                {/* LEFT BUTTON TARGET */}
                <div 
                  className={`absolute top-0 left-0 w-[50%] h-[100px] rounded-tl-[54px] flex items-center justify-center text-[10px] font-mono font-bold tracking-wide transition-colors ${
                    mouseActive.left 
                      ? 'bg-emerald-500 text-white z-10' 
                      : mouseClickedHistory.left 
                        ? 'bg-emerald-600/30 text-emerald-400 z-10' 
                        : 'text-[var(--theme-text-muted)] hover:bg-neutral-100 dark:hover:bg-neutral-850'
                  }`}
                >
                  LEFT (L)
                </div>

                {/* RIGHT BUTTON TARGET */}
                <div 
                  className={`absolute top-0 right-0 w-[50%] h-[100px] rounded-tr-[54px] flex items-center justify-center text-[10px] font-mono font-bold tracking-wide transition-colors ${
                    mouseActive.right 
                      ? 'bg-emerald-500 text-white z-10' 
                      : mouseClickedHistory.right 
                        ? 'bg-emerald-600/30 text-emerald-400 z-10' 
                        : 'text-[var(--theme-text-muted)] hover:bg-neutral-100 dark:hover:bg-neutral-850'
                  }`}
                >
                  RIGHT (R)
                </div>

                {/* MIDDLE WHEEL SCROLL OVERLAY */}
                <div 
                  className={`absolute top-6 left-[calc(50%-10px)] w-5 h-12 rounded-lg border-2 flex items-center justify-center z-20 shadow transition-colors ${
                    mouseActive.middle 
                      ? 'bg-emerald-400 text-white border-emerald-500' 
                      : mouseClickedHistory.middle 
                        ? 'bg-emerald-600/40 text-emerald-400 border-emerald-500/50' 
                        : 'bg-neutral-850 border-neutral-600 text-white dark:bg-neutral-800'
                  }`}
                >
                  <span className="text-[8px] font-bold text-center">W</span>
                </div>

                {/* SIDE BUTTONS Forward & Back (On the Left Side perimeter) */}
                <div className="absolute left-[-2px] top-[115px] flex flex-col gap-1.5 z-20">
                  {/* FORWARD BUTTON */}
                  <div 
                    className={`w-3.5 h-10 rounded-r border border-l-0 text-[8px] font-mono flex items-center justify-center transition-colors ${
                      mouseActive.forward 
                        ? 'bg-emerald-500 text-white border-emerald-600' 
                        : mouseClickedHistory.forward 
                          ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500' 
                          : 'bg-[var(--theme-bg)] border-[var(--theme-card-border)] text-[var(--theme-text-muted)]'
                    }`}
                  >
                    F
                  </div>
                  {/* BACK BUTTON */}
                  <div 
                    className={`w-3.5 h-10 rounded-r border border-l-0 text-[8px] font-mono flex items-center justify-center transition-colors ${
                      mouseActive.back 
                        ? 'bg-emerald-500 text-white border-emerald-600' 
                        : mouseClickedHistory.back 
                          ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500' 
                          : 'bg-[var(--theme-bg)] border-[var(--theme-card-border)] text-[var(--theme-text-muted)]'
                    }`}
                  >
                    B
                  </div>
                </div>

                {/* Lower body decoration */}
                <div className="mt-[135px] text-center select-none space-y-1.5">
                  <span className="text-[11px] font-mono font-black text-rose-500 uppercase tracking-widest block animate-pulse">
                    DIAGNOSTICS
                  </span>
                  <span className="text-[9px] font-mono text-[var(--theme-text-muted)] block max-w-[130px] leading-tight">
                    Hold or click buttons to trigger exact calibration registers.
                  </span>
                </div>

              </div>
            </div>

            {/* Diagnostic metrics table */}
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-[var(--theme-bg)] border border-[var(--theme-card-border)] p-3 rounded space-y-1 shadow-sm">
                <span className="text-[9px] text-[var(--theme-text-muted)] uppercase font-bold block">Clicks Measured:</span>
                <div className="space-y-1 text-[11px] text-[var(--theme-text)]">
                  <div className="flex justify-between">
                    <span>Left Count:</span>
                    <span className="font-bold">{clickCounts.left}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Right Count:</span>
                    <span className="font-bold">{clickCounts.right}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Scroll Pressed:</span>
                    <span className="font-bold">{clickCounts.middle}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--theme-bg)] border border-[var(--theme-card-border)] p-3 rounded space-y-1 shadow-sm">
                <span className="text-[9px] text-[var(--theme-text-muted)] uppercase font-bold block">Hardware Metrics:</span>
                <div className="space-y-1 text-[11px] text-[var(--theme-text)]">
                  <div className="flex justify-between">
                    <span>Scroll Delta:</span>
                    <span className="font-bold text-emerald-500">{scrollDelta}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pointer X:</span>
                    <span className="font-bold">{mousePosition.x} px</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pointer Y:</span>
                    <span className="font-bold">{mousePosition.y} px</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* DRAWING TRAJECTORY TESTER CANVAS */}
        <div className="lg:col-span-7">
          <div className="border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] p-6 rounded-lg space-y-4 shadow-sm h-full flex flex-col justify-between">
            
            <div className="flex justify-between items-center border-b border-[var(--theme-card-border)] pb-3">
              <span className="text-xs font-extrabold uppercase font-mono tracking-wider text-[var(--theme-text)]">
                🎯 Polling Interpolation Trajectory Canvas
              </span>
              <button
                onClick={clearCanvas}
                className="text-[10px] font-mono font-bold uppercase text-rose-500 hover:bg-rose-500/10 border border-rose-500/30 transition-all px-3 py-1.5 rounded"
                type="button"
              >
                Clear Paint Path
              </button>
            </div>

            <div className="relative flex-grow min-h-[300px] bg-[var(--theme-bg)] border border-[var(--theme-card-border)] rounded-md overflow-hidden">
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                className="w-full h-full block cursor-crosshair absolute top-0 left-0"
              />
            </div>

            <p className="text-[10px] font-sans text-right text-[var(--theme-text-muted)] mt-2">
              💡 Left Click & Drag to paint. Jittery or broken lines indicate polling drops.
            </p>

          </div>
        </div>

      </div>
    </div>
  );
}
