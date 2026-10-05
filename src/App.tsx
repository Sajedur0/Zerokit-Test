/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  LayoutGrid,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Image as ImageIcon,
  Code,
  FileText,
  Scale,
  QrCode,
  Lock,
  CheckCircle,
  ChevronRight,
  Settings,
  Shield,
  Layers,
  Heart,
  ExternalLink,
  Laptop,
  Check,
  Maximize,
  Keyboard,
  Video,
  Mic,
  Binary,
  Globe,
  Type,
  FileJson,
  Palette,
  Moon,
  Sun,
  Github,
  Facebook
} from 'lucide-react';

const ImageResizer = lazy(() => import('./components/ImageResizer'));
const CodeFormatter = lazy(() => import('./components/CodeFormatter'));
const UnitConverter = lazy(() => import('./components/UnitConverter'));
const QrGenerator = lazy(() => import('./components/QrGenerator'));
const PasswordManager = lazy(() => import('./components/PasswordManager'));
const KeyboardMouseTest = lazy(() => import('./components/KeyboardMouseTest'));
const WebcamTest = lazy(() => import('./components/WebcamTest'));
const MicrophoneTest = lazy(() => import('./components/MicrophoneTest'));
const Base64Tool = lazy(() => import('./components/Base64Tool'));
const CountryCodeTool = lazy(() => import('./components/CountryCodeTool'));
const CharacterCounter = lazy(() => import('./components/CharacterCounter'));
const JsonValidator = lazy(() => import('./components/JsonValidator'));
const PdfTool = lazy(() => import('./components/PdfTool'));
const ScreenColorTest = lazy(() => import('./components/ScreenColorTest'));
import ErrorBoundary from './components/ErrorBoundary';
import ZkLogo from './components/ZkLogo';
import { CardTool, ToolType } from './types';

// Dynamic aesthetic configurations matching highly-polished premium web layouts
export const THEMES = [
  {
    id: 'swiss', // Swiss/Minimal Theme
    name: 'Swiss Minimalist',
    description: 'The elegant default white/light layout with custom charcoal black accents and soft modern contours.',
    bg: '#F7F9FB',
    cardBg: '#FFFFFF',
    cardBorder: '#E0E3E5',
    cardBorderHover: '#000000',
    text: '#191C1E',
    textMuted: '#515F74',
    accent: '#000000',
    accentText: '#FFFFFF',
    accentHover: '#1A1A1A',
    panelBg: '#FFFFFF',
    logoText: 'ZeroKit',
    logoAccent: 'DIRECTORY',
    fontClass: 'font-sans',
    inputBg: '#FFFFFF',
    shadow: '0px 2px 8px rgba(0,0,0,0.03)',
    shadowHover: '0px 12px 24px rgba(0,0,0,0.06)',
    borderRadius: '12px',
    borderRadiusThumb: '50%',
  },
  {
    id: 'midnight', // Midnight/Dark Theme
    name: 'Midnight',
    description: 'A premium dark layout with deep charcoal surfaces, soft glows and high-contrast accents.',
    bg: '#0B0E14',
    cardBg: '#141A26',
    cardBorder: '#232B3B',
    cardBorderHover: '#3B82F6',
    text: '#E8EDF6',
    textMuted: '#93A1B8',
    accent: '#3B82F6',
    accentText: '#FFFFFF',
    accentHover: '#2563EB',
    panelBg: '#0F1420',
    logoText: 'ZeroKit',
    logoAccent: 'NIGHT',
    fontClass: 'font-sans',
    inputBg: '#141A26',
    shadow: '0px 2px 8px rgba(0,0,0,0.25)',
    shadowHover: '0px 12px 24px rgba(0,0,0,0.45)',
    borderRadius: '12px',
    borderRadiusThumb: '50%',
  }
];

// Cookie helper utilities for browser theme persistence
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

const setCookie = (name: string, value: string, days = 365) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
};

const VALID_TOOLS: ToolType[] = [
  'image-resizer',
  'pdf-converter',
  'code-formatter',
  'unit-converter',
  'qr-generator',
  'password-manager',
  'keyboard-mouse-test',
  'webcam-test',
  'microphone-test',
  'base64-tool',
  'country-codes',
  'character-counter',
  'json-validator',
  'screen-color-test',
];

const getToolFromUrlHash = (): ToolType | null => {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash) return null;
  // Strip the shareable ?color=&mode= query before matching the tool id.
  const match = hash.split('?')[0].replace(/^#\/?(tool\/)?/, '').trim();
  if (VALID_TOOLS.includes(match as ToolType)) {
    return match as ToolType;
  }
  return null;
};

export default function App() {
  const [activeThemeId, setActiveThemeId] = useState<string>(() => {
    const saved = getCookie('toolvault_theme') || localStorage.getItem('toolvault_theme');
    return saved || 'swiss';
  });
  const [activeTool, setActiveToolState] = useState<ToolType | null>(() => getToolFromUrlHash());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showNotification, setShowNotification] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  const setTheme = (themeId: string) => {
    setActiveThemeId(themeId);
    const cookie = themeId;
    localStorage.setItem('toolvault_theme', themeId);
    setCookie('toolvault_theme', cookie);
  };

  const toggleTheme = () => {
    setTheme(activeThemeId === 'swiss' ? 'midnight' : 'swiss');
  };

  const handleSelectTool = (toolId: ToolType | null) => {
    setActiveToolState(toolId);
    if (toolId) {
      window.location.hash = `#/${toolId}`;
    } else {
      if (window.location.hash) {
        window.history.pushState('', document.title, window.location.pathname + window.location.search);
      }
    }
  };

  // Keyboard shortcut listener (⌘K / Ctrl+K for search, Esc to close/clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (activeTool !== null) {
          handleSelectTool(null);
        }
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      } else if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
        } else if (activeTool !== null) {
          handleSelectTool(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, searchQuery]);

  useEffect(() => {
    const handleHashChange = () => {
      const toolFromHash = getToolFromUrlHash();
      setActiveToolState(toolFromHash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY <= 80) {
        setShowHeader(true);
      } else {
        if (currentScrollY > lastScrollY.current) {
          setShowHeader(false);
        } else {
          setShowHeader(true);
        }
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Retrieve current active config
  const activeTheme = useMemo(() => {
    return THEMES.find((t) => t.id === activeThemeId) || THEMES.find((t) => t.id === 'swiss') || THEMES[0];
  }, [activeThemeId]);

  const toolsList: CardTool[] = useMemo(() => [
    {
      id: 'image-resizer',
      title: 'Image Resizer',
      description: 'Scale, compress, and resize photo dimensions offline with custom aspect ratios.',
      icon: 'image-resizer',
      category: 'Creative',
      bgColor: 'bg-[#122c2a]',
      textColor: 'text-teal-400',
    },
    {
      id: 'pdf-converter',
      title: 'PDF Tools & Editor',
      description: 'Upload PDF files for live page preview, split, merge, delete pages, add pages, and rotate offline.',
      icon: 'file-text',
      category: 'Office',
      bgColor: 'bg-[#2f1319]',
      textColor: 'text-rose-400',
    },
    {
      id: 'code-formatter',
      title: 'Code Formatter',
      description: 'Format raw scripts, HTML, JSON, and SQL layouts with custom indentation.',
      icon: 'code',
      category: 'Developer',
      bgColor: 'bg-[#221c38]',
      textColor: 'text-violet-400',
    },
    {
      id: 'json-validator',
      title: 'JSON Validator & Formatter',
      description: 'Paste JSON code to validate syntax in real time with error highlights and auto-fixing.',
      icon: 'file-json',
      category: 'Developer',
      bgColor: 'bg-[#1e1b4b]',
      textColor: 'text-violet-400',
    },
    {
      id: 'base64-tool',
      title: 'Base64 Encrypt & Decrypt',
      description: 'Encode and decode text strings, binary files, and image data URLs securely.',
      icon: 'binary',
      category: 'Developer',
      bgColor: 'bg-[#1e293b]',
      textColor: 'text-sky-400',
    },
    {
      id: 'unit-converter',
      title: 'Unit Converter',
      description: 'Convert length, weight, temperature, speed, area, and time units instantly.',
      icon: 'scale',
      category: 'Office',
      bgColor: 'bg-[#2c2214]',
      textColor: 'text-amber-400',
    },
    {
      id: 'character-counter',
      title: 'Character & Word Counter',
      description: 'Real-time text analyzer with unlimited capacity, word counts, reading time, and case converters.',
      icon: 'type',
      category: 'Office',
      bgColor: 'bg-[#311b92]',
      textColor: 'text-indigo-400',
    },
    {
      id: 'country-codes',
      title: 'Country & Phone Codes',
      description: 'Search country dialing prefixes (+880, +1), ISO-2/ISO-3 codes, and national flags.',
      icon: 'globe',
      category: 'Office',
      bgColor: 'bg-[#122c2a]',
      textColor: 'text-emerald-400',
    },
    {
      id: 'qr-generator',
      title: 'QR Code Generator',
      description: 'Generate high-res downloadable QR codes for web URLs, Wi-Fi passwords, and contact info.',
      icon: 'qr-code',
      category: 'Marketing',
      bgColor: 'bg-[#30161d]',
      textColor: 'text-rose-400',
    },
    {
      id: 'password-manager',
      title: 'Password Generator',
      description: 'Generate and evaluate cryptographically strong enterprise passwords locally.',
      icon: 'lock',
      category: 'Security',
      bgColor: 'bg-[#13282f]',
      textColor: 'text-cyan-400',
    },
    {
      id: 'keyboard-mouse-test',
      title: 'Keyboard & Mouse Test',
      description: 'Test virtual keyboard signals, ghost keys, mouse click speeds, and scroll events.',
      icon: 'keyboard',
      category: 'Hardware',
      bgColor: 'bg-[#1a2035]',
      textColor: 'text-amber-400',
    },
    {
      id: 'webcam-test',
      title: 'Webcam Hardware Test',
      description: 'Inspect live camera feeds, resolution capabilities, FPS frame rates, and snapshots.',
      icon: 'video',
      category: 'Hardware',
      bgColor: 'bg-[#221c38]',
      textColor: 'text-fuchsia-400',
    },
    {
      id: 'microphone-test',
      title: 'Microphone Test',
      description: 'Monitor live audio input levels, gain waveforms, decibel meters, and speech clarity.',
      icon: 'mic',
      category: 'Hardware',
      bgColor: 'bg-[#122c2a]',
      textColor: 'text-emerald-400',
    },
    {
      id: 'screen-color-test',
      title: 'Screen Color Test',
      description: 'Fullscreen dead-pixel, gradient banding, geometry, convergence, focus, and resolution display diagnostics.',
      icon: 'palette',
      category: 'Hardware',
      bgColor: 'bg-[#141a2e]',
      textColor: 'text-sky-400',
    },
  ], []);

  const categories = useMemo(() => {
    return ['All', 'Developer', 'Office', 'Creative', 'Hardware', 'Security', 'Marketing'];
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: toolsList.length };
    toolsList.forEach((t) => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return counts;
  }, [toolsList]);

  const filteredTools = useMemo(() => {
    return toolsList.filter((tool) => {
      const matchesSearch =
        tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory =
        selectedCategory === 'All' || tool.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [toolsList, searchQuery, selectedCategory]);

  const activeToolObj = useMemo(() => {
    return toolsList.find((t) => t.id === activeTool) || null;
  }, [toolsList, activeTool]);

  const getToolIcon = (iconName: string) => {
    const iconClass = "w-5 h-5 transition-transform duration-300 group-hover:scale-110";
    const strokeWidth = 1.75;
    switch (iconName) {
      case 'image-resizer':
        return <Maximize className={iconClass} strokeWidth={strokeWidth} />;
      case 'image':
        return <ImageIcon className={iconClass} strokeWidth={strokeWidth} />;
      case 'code':
        return <Code className={iconClass} strokeWidth={strokeWidth} />;
      case 'file-text':
        return <FileText className={iconClass} strokeWidth={strokeWidth} />;
      case 'scale':
        return <Scale className={iconClass} strokeWidth={strokeWidth} />;
      case 'qr-code':
        return <QrCode className={iconClass} strokeWidth={strokeWidth} />;
      case 'lock':
        return <Lock className={iconClass} strokeWidth={strokeWidth} />;
      case 'keyboard':
        return <Keyboard className={iconClass} strokeWidth={strokeWidth} />;
      case 'video':
        return <Video className={iconClass} strokeWidth={strokeWidth} />;
      case 'mic':
        return <Mic className={iconClass} strokeWidth={strokeWidth} />;
      case 'binary':
        return <Binary className={iconClass} strokeWidth={strokeWidth} />;
      case 'globe':
        return <Globe className={iconClass} strokeWidth={strokeWidth} />;
      case 'type':
        return <Type className={iconClass} strokeWidth={strokeWidth} />;
      case 'file-json':
        return <FileJson className={iconClass} strokeWidth={strokeWidth} />;
      case 'palette':
        return <Palette className={iconClass} strokeWidth={strokeWidth} />;
      default:
        return <LayoutGrid className={iconClass} strokeWidth={strokeWidth} />;
    }
  };

  const handleQuickFind = () => {
    if (filteredTools.length > 0) {
      handleSelectTool(filteredTools[0].id);
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  };

  return (
    <div 
      style={{
        '--theme-bg': activeTheme.bg,
        '--theme-text': activeTheme.text,
        '--theme-accent': activeTheme.accent,
        '--theme-accent-text': activeTheme.accentText,
        '--theme-card-bg': activeTheme.cardBg,
        '--theme-card-border': activeTheme.cardBorder,
        '--theme-card-border-hover': activeTheme.cardBorderHover,
        '--theme-panel-bg': activeTheme.panelBg,
        '--theme-text-muted': activeTheme.textMuted,
        '--theme-input-bg': activeTheme.inputBg,
        '--theme-border-radius': activeTheme.borderRadius,
      } as React.CSSProperties}
      className="min-h-screen flex flex-col antialiased selection:bg-[var(--theme-accent)] selection:text-[var(--theme-accent-text)] bg-[var(--theme-bg)] text-[var(--theme-text)] transition-colors duration-300 font-sans relative overflow-x-hidden"
    >
      {/* Background visual grid overlay */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_75%_60%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none" />

      {/* Top Navbar */}
      <header className={`sticky top-0 z-50 bg-[var(--theme-panel-bg)]/95 backdrop-blur-md border-b border-[var(--theme-card-border)] shadow-sm transform transition-transform duration-300 ease-in-out ${
        showHeader ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          
          {/* Logo brand */}
          <div
            onClick={() => {
              handleSelectTool(null);
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-900/5 dark:bg-white/5 border border-[var(--theme-card-border)] p-1 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <ZkLogo className="w-full h-full" />
            </div>
            <div>
              <div className="text-lg sm:text-xl font-extrabold tracking-tight text-[var(--theme-text)] flex items-center gap-2">
                <span>ZeroKit</span>
              </div>
              <p className="text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider -mt-0.5 hidden xs:block">
                Standalone Web Tools
              </p>
            </div>
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={activeThemeId === 'swiss' ? 'Switch to Midnight (dark)' : 'Switch to Swiss Minimalist (light)'}
            className="w-10 h-10 rounded-xl border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)] flex items-center justify-center text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] hover:border-[var(--theme-accent)] transition-all active:scale-95 shadow-sm"
          >
            {activeThemeId === 'swiss' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        </nav>
      </header>

      {/* Main Container workspace */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 relative">
        {activeTool === null ? (
          /* Directory Catalog Landing Layout */
          <div className="space-y-8 sm:space-y-10 relative animate-fade-in">
            
            {/* Hero Header Section */}
            <section className="py-4 sm:py-8 max-w-4xl mx-auto text-center space-y-4 sm:space-y-6">
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-[var(--theme-text)] leading-tight max-w-3xl mx-auto">
                Essential Web Utilities in Zerokit.
              </h1>
              
              <p className="text-xs sm:text-base md:text-lg text-[var(--theme-text-muted)] max-w-2xl mx-auto leading-relaxed">
                Fast, secure, offline-capable developer & everyday web tools. Instant execution with no data tracking or complex server dependencies.
              </p>

              {/* Enhanced Search Input Bar */}
              <div className="max-w-2xl mx-auto relative mt-6 sm:mt-8 group">
                <div className="absolute inset-y-0 left-4 sm:left-5 flex items-center pointer-events-none text-[var(--theme-text-muted)]">
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 group-focus-within:text-[var(--theme-accent)] transition-colors" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickFind()}
                  placeholder="Search tools (e.g., JSON, QR, Units, Converter, Password)..."
                  className="w-full pl-11 sm:pl-14 pr-28 sm:pr-36 py-3.5 sm:py-4 bg-[var(--theme-card-bg)] border-2 border-[var(--theme-card-border)] rounded-2xl sm:rounded-full text-xs sm:text-sm font-medium focus:outline-none focus:border-[var(--theme-accent)] transition-all shadow-sm text-[var(--theme-text)] placeholder-[var(--theme-text-muted)]/60"
                />

                <div className="absolute inset-y-1.5 right-1.5 flex items-center gap-1">
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="p-2 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] text-xs font-mono font-bold"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    onClick={handleQuickFind}
                    className="bg-[var(--theme-accent)] hover:opacity-90 text-[var(--theme-accent-text)] px-4 sm:px-6 h-9 sm:h-11 rounded-xl sm:rounded-full text-xs font-bold tracking-wide transition-all uppercase shadow-sm active:scale-95"
                  >
                    Find
                  </button>
                </div>
              </div>


            </section>

            {/* Catalog Bento Grid Section */}
            <section className="space-y-6">
              {filteredTools.length === 0 ? (
                <div className="text-center py-16 bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-2xl shadow-sm p-6">
                  <Search className="w-10 h-10 text-[var(--theme-text-muted)] mx-auto mb-3 opacity-60" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--theme-text)]">No matching tools found</h3>
                  <p className="text-[var(--theme-text-muted)] text-xs mt-1 max-w-sm mx-auto">
                    No utilities matched &ldquo;{searchQuery}&rdquo;. Try searching for QR, JSON, base64, webcam, or units.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="mt-4 text-xs font-mono font-bold text-[var(--theme-text)] border border-[var(--theme-card-border)] px-4 py-2 rounded-xl hover:border-[var(--theme-accent)] transition-all bg-[var(--theme-bg)]"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredTools.map((tool, idx) => {
                    return (
                      <div
                        key={tool.id}
                        onClick={() => handleSelectTool(tool.id)}
                        className="group bg-[var(--theme-card-bg)] border-2 border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] p-5 sm:p-6 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col justify-between relative hover:-translate-y-1 shadow-sm hover:shadow-md active:scale-[0.99]"
                      >
                        <div className="space-y-3.5">
                          {/* Card Header: Icon + Category Badge */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="w-11 h-11 rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20 flex items-center justify-center shrink-0 group-hover:bg-[var(--theme-accent)] group-hover:text-[var(--theme-accent-text)] transition-colors duration-200">
                              {getToolIcon(tool.icon)}
                            </div>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-[var(--theme-bg)] border border-[var(--theme-card-border)] text-[var(--theme-text-muted)] group-hover:text-[var(--theme-text)] transition-colors">
                              {tool.category}
                            </span>
                          </div>

                          {/* Card Content */}
                          <div>
                            <h3 className="text-base sm:text-lg font-bold tracking-tight text-[var(--theme-text)] group-hover:text-[var(--theme-accent)] transition-colors">
                              {tool.title}
                            </h3>
                            <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed mt-1.5 line-clamp-2">
                              {tool.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          /* Active Interactive Workspace View */
          <div className="space-y-6">
            {/* Top breadcrumbs & Quick Tool Switcher bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--theme-card-border)] pb-4 font-mono text-xs">
              <button
                onClick={() => handleSelectTool(null)}
                className="group flex items-center gap-2 font-bold uppercase text-[var(--theme-text-muted)] hover:text-[var(--theme-accent)] transition-colors py-1 px-2 rounded-lg bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] shadow-sm"
                type="button"
              >
                <ArrowLeft className="w-4 h-4 text-[var(--theme-accent)] transition-transform group-hover:-translate-x-1" />
                <span>All Tools</span>
              </button>

              {/* Quick Tool Switcher Dropdown */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[var(--theme-text-muted)] hidden sm:inline">Active:</span>
                <select
                  value={activeTool || ''}
                  onChange={(e) => handleSelectTool(e.target.value as ToolType)}
                  className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] text-[var(--theme-text)] px-3 py-1.5 rounded-lg font-bold text-xs focus:outline-none focus:border-[var(--theme-accent)] cursor-pointer max-w-[220px] sm:max-w-none truncate"
                >
                  {toolsList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Direct workspace rendering without card container */}
            <div className="min-h-[500px] animate-fade-in py-2">
              <ErrorBoundary>
                <Suspense
                  fallback={
                    <div className="flex flex-col items-center justify-center gap-3 py-24">
                      <div className="w-10 h-10 border-3 border-[var(--theme-card-border)] border-t-[var(--theme-accent)] rounded-full animate-spin" />
                      <p className="text-xs font-mono text-[var(--theme-text-muted)] uppercase tracking-wider">
                        Loading tool...
                      </p>
                    </div>
                  }
                >
                  {activeTool === 'image-resizer' && <ImageResizer />}
                  {activeTool === 'pdf-converter' && <PdfTool />}
                  {activeTool === 'code-formatter' && <CodeFormatter />}
                  {activeTool === 'unit-converter' && <UnitConverter />}
                  {activeTool === 'qr-generator' && <QrGenerator />}
                  {activeTool === 'password-manager' && <PasswordManager />}
                  {activeTool === 'keyboard-mouse-test' && <KeyboardMouseTest />}
                  {activeTool === 'webcam-test' && <WebcamTest />}
                  {activeTool === 'microphone-test' && <MicrophoneTest />}
                  {activeTool === 'base64-tool' && <Base64Tool />}
                  {activeTool === 'country-codes' && <CountryCodeTool />}
                  {activeTool === 'character-counter' && <CharacterCounter />}
                  {activeTool === 'json-validator' && <JsonValidator />}
                  {activeTool === 'screen-color-test' && <ScreenColorTest />}
                </Suspense>
              </ErrorBoundary>
            </div>
          </div>
        )}
      </main>

      {/* Streamlined Modern Footer */}
      <footer className="mt-16 border-t border-[var(--theme-card-border)] bg-[var(--theme-panel-bg)] font-mono text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[var(--theme-text-muted)]">
          <div className="flex items-center gap-2.5">
            <ZkLogo className="w-6 h-6 shrink-0" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-[var(--theme-text)] tracking-wide">© {new Date().getFullYear()} ZeroKit. All Rights Reserved.</span>
          </div>

          <div className="flex items-center gap-3 text-[12px] flex-wrap justify-center">
            <span className="font-medium text-[var(--theme-text)]">Developed: Sajedur Rahman Roni</span>
            <span className="text-[var(--theme-text-muted)]">•</span>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/Sajedur0"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-[var(--theme-accent)] transition-colors p-1"
                title="GitHub"
              >
                <Github className="w-4 h-4" />
                <span className="hidden sm:inline">GitHub</span>
              </a>
              <a
                href="https://facebook.com/Sajedur0"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-[var(--theme-accent)] transition-colors p-1"
                title="Facebook"
              >
                <Facebook className="w-4 h-4" />
                <span className="hidden sm:inline">Facebook</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
