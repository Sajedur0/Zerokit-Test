/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  LayoutGrid,
  ArrowLeft,
  Maximize,
  Image as ImageIcon,
  Code,
  FileText,
  Scale,
  QrCode,
  Lock,
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
  Facebook,
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

/**
 * Two voices of the same quiet palette:
 *  - paper  → warm off-white sheets with forest-green ink (default)
 *  - forest → deep forest-ink surfaces with lime highlights
 */
export const THEMES = [
  {
    id: 'paper',
    name: 'Paper',
    description: 'Warm off-white sheets, forest-green ink and a coral accent.',
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Deep forest surfaces with lime highlights for low-light work.',
  },
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

const LEGACY_THEME_MAP: Record<string, string> = {
  swiss: 'paper',
  midnight: 'forest',
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

/** Brand lockup: coral tile mark + lowercase wordmark. */
const BrandButton = ({ className = '', onClick }: { className?: string; onClick: () => void }) => (
  <button type="button" className={`brand ${className}`} onClick={onClick} aria-label="ZeroKit home">
    <span className="brand-mark" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </span>
    <span className="brand-name">zerokit</span>
  </button>
);

const goHome = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const getStoredTheme = (): string => {
  if (typeof window === 'undefined') return 'paper';
  const saved = getCookie('zerokit_theme') || localStorage.getItem('zerokit_theme') || getCookie('toolvault_theme') || localStorage.getItem('toolvault_theme');
  if (!saved) return 'paper';
  if (THEMES.some((t) => t.id === saved)) return saved;
  return LEGACY_THEME_MAP[saved] || 'paper';
};

export default function App() {
  const [activeThemeId, setActiveThemeId] = useState<string>(getStoredTheme);
  const [activeTool, setActiveToolState] = useState<ToolType | null>(() => getToolFromUrlHash());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  const setTheme = (themeId: string) => {
    setActiveThemeId(themeId);
    localStorage.setItem('zerokit_theme', themeId);
    setCookie('zerokit_theme', themeId);
  };

  const toggleTheme = () => {
    setTheme(activeThemeId === 'paper' ? 'forest' : 'paper');
  };

  const handleSelectTool = (toolId: ToolType | null) => {
    setActiveToolState(toolId);
    if (toolId) {
      window.location.hash = `#/${toolId}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      } else if (currentScrollY > lastScrollY.current) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Paint the chosen mode onto the document so the whole page (and every tool)
  // inherits the palette before the first interaction.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeThemeId);
    document.body.setAttribute('data-theme', activeThemeId);
  }, [activeThemeId]);

  const activeTheme = useMemo(() => {
    return THEMES.find((t) => t.id === activeThemeId) || THEMES[0];
  }, [activeThemeId]);

  const toolsList: CardTool[] = useMemo(
    () => [
      {
        id: 'image-resizer',
        title: 'Image Resizer',
        description: 'Scale, compress, and resize photo dimensions offline with custom aspect ratios.',
        icon: 'image-resizer',
        category: 'Creative',
      },
      {
        id: 'pdf-converter',
        title: 'PDF Tools & Editor',
        description: 'Upload PDF files for live page preview, split, merge, delete pages, add pages, and rotate offline.',
        icon: 'file-text',
        category: 'Office',
      },
      {
        id: 'code-formatter',
        title: 'Code Formatter',
        description: 'Format raw scripts, HTML, JSON, and SQL layouts with custom indentation.',
        icon: 'code',
        category: 'Developer',
      },
      {
        id: 'json-validator',
        title: 'JSON Validator & Formatter',
        description: 'Paste JSON code to validate syntax in real time with error highlights and auto-fixing.',
        icon: 'file-json',
        category: 'Developer',
      },
      {
        id: 'base64-tool',
        title: 'Base64 Encrypt & Decrypt',
        description: 'Encode and decode text strings, binary files, and image data URLs securely.',
        icon: 'binary',
        category: 'Developer',
      },
      {
        id: 'unit-converter',
        title: 'Unit Converter',
        description: 'Convert length, weight, temperature, speed, area, and time units instantly.',
        icon: 'scale',
        category: 'Office',
      },
      {
        id: 'character-counter',
        title: 'Character & Word Counter',
        description: 'Real-time text analyzer with unlimited capacity, word counts, reading time, and case converters.',
        icon: 'type',
        category: 'Office',
      },
      {
        id: 'country-codes',
        title: 'Country & Phone Codes',
        description: 'Search country dialing prefixes (+880, +1), ISO-2/ISO-3 codes, and national flags.',
        icon: 'globe',
        category: 'Office',
      },
      {
        id: 'qr-generator',
        title: 'QR Code Generator',
        description: 'Generate high-res downloadable QR codes for web URLs, Wi-Fi passwords, and contact info.',
        icon: 'qr-code',
        category: 'Marketing',
      },
      {
        id: 'password-manager',
        title: 'Password Generator',
        description: 'Generate and evaluate cryptographically strong enterprise passwords locally.',
        icon: 'lock',
        category: 'Security',
      },
      {
        id: 'keyboard-mouse-test',
        title: 'Keyboard & Mouse Test',
        description: 'Test virtual keyboard signals, ghost keys, mouse click speeds, and scroll events.',
        icon: 'keyboard',
        category: 'Hardware',
      },
      {
        id: 'webcam-test',
        title: 'Webcam Hardware Test',
        description: 'Inspect live camera feeds, resolution capabilities, FPS frame rates, and snapshots.',
        icon: 'video',
        category: 'Hardware',
      },
      {
        id: 'microphone-test',
        title: 'Microphone Test',
        description: 'Monitor live audio input levels, gain waveforms, decibel meters, and speech clarity.',
        icon: 'mic',
        category: 'Hardware',
      },
      {
        id: 'screen-color-test',
        title: 'Screen Color Test',
        description: 'Fullscreen dead-pixel, gradient banding, geometry, convergence, focus, and resolution display diagnostics.',
        icon: 'palette',
        category: 'Hardware',
      },
    ],
    [],
  );

  const categories = useMemo(() => {
    const present = Array.from(new Set(toolsList.map((t) => t.category)));
    const order = ['Developer', 'Office', 'Creative', 'Hardware', 'Security', 'Marketing'];
    return ['All', ...order.filter((c) => present.includes(c as CardTool['category']))];
  }, [toolsList]);

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

      const matchesCategory = selectedCategory === 'All' || tool.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [toolsList, searchQuery, selectedCategory]);

  const activeToolObj = useMemo(() => {
    return toolsList.find((t) => t.id === activeTool) || null;
  }, [toolsList, activeTool]);

  const getToolIcon = (iconName: string) => {
    const strokeWidth = 1.7;
    switch (iconName) {
      case 'image-resizer':
        return <Maximize strokeWidth={strokeWidth} />;
      case 'image':
        return <ImageIcon strokeWidth={strokeWidth} />;
      case 'code':
        return <Code strokeWidth={strokeWidth} />;
      case 'file-text':
        return <FileText strokeWidth={strokeWidth} />;
      case 'scale':
        return <Scale strokeWidth={strokeWidth} />;
      case 'qr-code':
        return <QrCode strokeWidth={strokeWidth} />;
      case 'lock':
        return <Lock strokeWidth={strokeWidth} />;
      case 'keyboard':
        return <Keyboard strokeWidth={strokeWidth} />;
      case 'video':
        return <Video strokeWidth={strokeWidth} />;
      case 'mic':
        return <Mic strokeWidth={strokeWidth} />;
      case 'binary':
        return <Binary strokeWidth={strokeWidth} />;
      case 'globe':
        return <Globe strokeWidth={strokeWidth} />;
      case 'type':
        return <Type strokeWidth={strokeWidth} />;
      case 'file-json':
        return <FileJson strokeWidth={strokeWidth} />;
      case 'palette':
        return <Palette strokeWidth={strokeWidth} />;
      default:
        return <LayoutGrid strokeWidth={strokeWidth} />;
    }
  };

  const handleQuickFind = () => {
    if (filteredTools.length > 0) {
      handleSelectTool(filteredTools[0].id);
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
  };

  const handleHome = () => {
    handleSelectTool(null);
    resetFilters();
    goHome();
  };

  return (
    <div className="page-shell">
      <a className="skip-link" href="#tools">
        Skip to the tools
      </a>

      {/* Top navigation */}
      <header className={`site-header ${showHeader ? '' : 'is-hidden'}`}>
        <div className="wrap">
          <BrandButton onClick={handleHome} />

          <nav className="primary-nav" aria-label="Primary navigation">
            <a href="#tools" onClick={() => handleSelectTool(null)}>
              Workspace
            </a>
            <a href="#principles" onClick={() => handleSelectTool(null)}>
              Why ZeroKit
            </a>
            <span className="local-badge">
              <span className="status-dot" aria-hidden="true"></span>
              local only
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={toggleTheme}
              aria-label={`Switch to the ${activeThemeId === 'paper' ? 'forest' : 'paper'} theme`}
              title={`Switch to the ${activeThemeId === 'paper' ? 'forest (dark)' : 'paper (light)'} theme`}
            >
              {activeThemeId === 'paper' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </nav>
        </div>
      </header>

      <main>
        {activeTool === null ? (
          /* ---------------------------- Directory ---------------------------- */
          <div className="animate-fade-in">
            <section className="hero wrap" aria-labelledby="page-title">
              <div className="hero-copy">
                <p className="eyebrow">
                  <span>01</span> private web toolbox
                </p>
                <h1 id="page-title">
                  Every tool you need.
                  <br />
                  <em>Nothing leaves the tab.</em>
                </h1>
                <p className="hero-lede">
                  Fourteen small, focused utilities for images, code, documents, text, and devices. They open instantly,
                  run in this browser, and never ask for an account.
                </p>
              </div>
              <div className="hero-aside" aria-label="The ZeroKit promise">
                <div className="aside-rule"></div>
                <p className="aside-label">The quiet way to work</p>
                <p className="aside-copy">No account. No upload. No audience.</p>
                <span className="aside-arrow" aria-hidden="true">
                  ↘
                </span>
              </div>
            </section>

            <section id="tools" className="tool-section wrap" aria-labelledby="tools-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">
                    <span>02</span> your workspace
                  </p>
                  <h2 id="tools-title">Pick a tool. Start at once.</h2>
                </div>
                <p className="section-note">Everything happens on this device.</p>
              </div>

              <div className="tool-card">
                <div className="picker-state">
                  <div className="picker-zone">
                    <div className="zone-icon" aria-hidden="true">
                      <LayoutGrid strokeWidth={1.6} />
                      <span className="zone-plus">+</span>
                    </div>
                    <p className="zone-title">Find your tool</p>
                    <p className="zone-copy">Search by name, or browse the cards below.</p>

                    <div className="search-field">
                      <span className="search-icon" aria-hidden="true">
                        <Search strokeWidth={1.8} />
                      </span>
                      <input
                        ref={searchInputRef}
                        id="tool-search"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuickFind()}
                        placeholder="Search tools (e.g. JSON, QR, units, password)…"
                        aria-label="Search tools"
                        className="search-input"
                        autoComplete="off"
                      />
                      {searchQuery && (
                        <button type="button" className="search-clear" onClick={() => setSearchQuery('')} title="Clear search">
                          ✕
                        </button>
                      )}
                      <button type="button" className="button button-dark" onClick={handleQuickFind}>
                        Find <span aria-hidden="true">↗</span>
                      </button>
                    </div>

                    <p className="format-note">
                      {toolsList.length} tools <span>·</span> {categories.length - 1} categories <span>·</span> no uploads
                    </p>
                  </div>

                  <aside className="picker-aside" aria-label="What ZeroKit changes">
                    <div className="aside-number">A / B</div>
                    <h3>
                      Less setup.
                      <br />
                      Same tools.
                    </h3>
                    <p>
                      ZeroKit reads files, text, and device streams only inside this tab. The original stays with you, and
                      nothing is written to a server.
                    </p>
                    <div className="mini-detail">
                      <span className="mini-dot"></span> Your files stay in this tab
                    </div>
                    <div className="mini-detail">
                      <span className="mini-dot"></span> Keeps working without a connection
                    </div>
                  </aside>
                </div>
              </div>

              <div className="filter-row">
                <div className="filter-pills" aria-label="Tool categories">
                  {categories.map((category) => {
                    const isActive = selectedCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setSelectedCategory(category)}
                        className={`filter-pill ${isActive ? 'is-active' : ''}`}
                      >
                        {category}
                        <em>{categoryCounts[category] ?? 0}</em>
                      </button>
                    );
                  })}
                </div>
                <p className="result-note">
                  Showing {filteredTools.length} of {toolsList.length} tools
                </p>
              </div>

              <div className="tool-grid">
                {filteredTools.length === 0 ? (
                  <div className="empty-card">
                    <span className="empty-mark" aria-hidden="true">
                      <Search strokeWidth={1.8} />
                    </span>
                    <h3>No matching tools found</h3>
                    <p>
                      Nothing matched &ldquo;{searchQuery}&rdquo;. Try QR, JSON, base64, webcam, or units.
                    </p>
                    <button type="button" className="button button-dark" onClick={resetFilters}>
                      Reset filters
                    </button>
                  </div>
                ) : (
                  filteredTools.map((tool, idx) => (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => handleSelectTool(tool.id)}
                      className="tool-tile"
                      aria-label={`Open ${tool.title}`}
                    >
                      <span className="tile-head">
                        <span className="card-number">{String(idx + 1).padStart(2, '0')}</span>
                        <span className="tile-category">{tool.category}</span>
                      </span>
                      <span className="tile-icon" aria-hidden="true">
                        {getToolIcon(tool.icon)}
                      </span>
                      <h3>{tool.title}</h3>
                      <p>{tool.description}</p>
                      <span className="tile-action">
                        Open tool <i aria-hidden="true">↗</i>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : (
          /* --------------------------- Tool workspace -------------------------- */
          <div className="wrap view-section animate-fade-in">
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  <span>02</span> your workspace
                </p>
                <h2>{activeToolObj?.title ?? 'Tool'}</h2>
              </div>
              <p className="section-note">Everything happens on this device.</p>
            </div>

            <div className="workspace">
              <div className="workspace-bar">
                <div className="workspace-identity">
                  <span className="bar-logo" aria-hidden="true">
                    <ZkLogo className="w-full h-full" />
                  </span>
                  <span className="panel-index">01</span>
                  <span className="state-pill">active tool</span>
                </div>

                <div className="workspace-bar-right">
                  <label className="switcher">
                    <span>Switch</span>
                    <select
                      className="select-input"
                      value={activeTool || ''}
                      onChange={(e) => handleSelectTool(e.target.value as ToolType)}
                      aria-label="Switch tool"
                    >
                      {toolsList.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="back-button" onClick={() => handleSelectTool(null)}>
                    <ArrowLeft strokeWidth={2} />
                    All tools
                  </button>
                </div>
              </div>

              <div className="workspace-body">
                <ErrorBoundary>
                  <Suspense
                    fallback={
                      <div className="loading-note">
                        <div className="spinner" aria-hidden="true" />
                        <p>Loading tool…</p>
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

              <div className="workspace-foot">
                <div className="foot-details">
                  <span className="mini-detail">
                    <span className="mini-dot"></span> Runs on this device
                  </span>
                  <span className="mini-detail">
                    <span className="mini-dot"></span> Nothing uploaded
                  </span>
                  <span className="mini-detail">
                    <span className="mini-dot"></span> No account needed
                  </span>
                </div>
                <button type="button" className="text-button" onClick={() => handleSelectTool(null)}>
                  Back to the directory <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------ Principles ---------------------------- */}
        <section id="principles" className="principles wrap" aria-labelledby="principles-title">
          <div className="section-heading principles-heading">
            <div>
              <p className="eyebrow">
                <span>03</span> the zerokit approach
              </p>
              <h2 id="principles-title">Simple by design.</h2>
            </div>
            <p className="section-note">The useful details, and nothing extra.</p>
          </div>

          <div className="principle-grid">
            <article className="principle-card">
              <span className="card-number">01</span>
              <h3>Private by default</h3>
              <p>Files, text, and device streams are handled in this tab. Nothing is uploaded, stored, or logged.</p>
            </article>
            <article className="principle-card highlighted-card">
              <span className="card-number">02</span>
              <h3>One quiet workspace</h3>
              <p>Fourteen tools behind a single search field, so you never hit a sign-up wall mid-task.</p>
            </article>
            <article className="principle-card">
              <span className="card-number">03</span>
              <h3>Built to keep working</h3>
              <p>Once the page is loaded the tools keep running, even with a poor or missing connection.</p>
            </article>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <div className="wrap">
          <BrandButton className="footer-brand" onClick={handleHome} />
          <p>Made for work that should stay yours.</p>
          <div className="footer-links">
            <a href="https://github.com/Sajedur0" target="_blank" rel="noopener noreferrer" title="GitHub">
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
            <a href="https://facebook.com/Sajedur0" target="_blank" rel="noopener noreferrer" title="Facebook">
              <Facebook className="w-4 h-4" />
              <span>Facebook</span>
            </a>
            <span className="footer-mark">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
