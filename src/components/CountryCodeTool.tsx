/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Globe,
  Phone,
  Search,
  Copy,
  Check,
  MapPin,
  Coins,
  Hash,
  Grid,
  List,
  Sparkles,
  ArrowUpDown,
  PhoneCall,
  Info,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Flag
} from 'lucide-react';
import { COUNTRIES_DATA, CountryInfo } from '../data/countries';

// Reliable High-Definition Country Flag component with emoji fallback
function CountryFlagImage({
  iso2,
  emoji,
  name,
  size = 'md'
}: {
  iso2: string;
  emoji: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [hasError, setHasError] = useState(false);
  const code = iso2?.toLowerCase();

  const imgDims = {
    sm: 'w-6 h-4',
    md: 'w-8 h-5.5',
    lg: 'w-11 h-7.5'
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl'
  };

  if (hasError || !code) {
    return <span className={`${textSizes[size]} leading-none shrink-0`}>{emoji}</span>;
  }

  return (
    <div className="relative inline-flex items-center shrink-0">
      <img
        src={`https://flagcdn.com/w80/${code}.png`}
        srcSet={`https://flagcdn.com/w160/${code}.png 2x`}
        alt={`${name} Flag`}
        onError={() => setHasError(true)}
        className={`${imgDims[size]} object-cover rounded border border-black/15 dark:border-white/20 shadow-sm transition-transform duration-200 shrink-0`}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

export default function CountryCodeTool() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'dialCode' | 'region'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Phone number lookup state
  const [phoneTestInput, setPhoneTestInput] = useState('');

  // Copy helper with feedback toast
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(`${label}:${text}`);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  // Filtered and sorted countries list
  const filteredCountries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase().replace(/^\+/, '');

    return COUNTRIES_DATA.filter((country) => {
      // Region match
      const matchesRegion =
        selectedRegion === 'All' ||
        (selectedRegion === 'Popular' && country.popular) ||
        country.region === selectedRegion;

      if (!query) return matchesRegion;

      const cleanDialCode = country.dialCode.replace('+', '');

      const matchesName = country.name.toLowerCase().includes(query);
      const matchesNative = country.nativeName?.toLowerCase().includes(query) || false;
      const matchesDial =
        cleanDialCode.startsWith(query) ||
        country.dialCode.toLowerCase().includes(query);
      const matchesIso2 = country.iso2.toLowerCase() === query || country.iso2.toLowerCase().includes(query);
      const matchesIso3 = country.iso3.toLowerCase() === query || country.iso3.toLowerCase().includes(query);
      const matchesCapital = country.capital.toLowerCase().includes(query);
      const matchesCurrency =
        country.currency.code.toLowerCase().includes(query) ||
        country.currency.name.toLowerCase().includes(query);

      return (
        matchesRegion &&
        (matchesName ||
          matchesNative ||
          matchesDial ||
          matchesIso2 ||
          matchesIso3 ||
          matchesCapital ||
          matchesCurrency)
      );
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'dialCode') {
        const numA = parseInt(a.dialCode.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.dialCode.replace(/\D/g, ''), 10) || 0;
        comparison = numA - numB;
      } else if (sortBy === 'region') {
        comparison = a.region.localeCompare(b.region);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [searchQuery, selectedRegion, sortBy, sortOrder]);

  // Phone number reverse lookup match calculation
  const phoneLookupResult = useMemo(() => {
    const raw = phoneTestInput.trim().replace(/[^\d+]/g, '');
    if (!raw) return null;

    const formatted = raw.startsWith('+') ? raw : `+${raw}`;
    const cleanDigits = formatted.replace('+', '');

    // Sort countries by dial code length descending (+1242 before +1)
    const sortedByDialLen = [...COUNTRIES_DATA].sort(
      (a, b) => b.dialCode.length - a.dialCode.length
    );

    const match = sortedByDialLen.find((c) => {
      const codeDigits = c.dialCode.replace('+', '');
      return cleanDigits.startsWith(codeDigits);
    });

    if (!match) return null;

    const codeDigits = match.dialCode.replace('+', '');
    const subscriberNumber = cleanDigits.slice(codeDigits.length);

    return {
      country: match,
      fullFormatted: `${match.dialCode} ${subscriberNumber}`,
      subscriberNumber,
      isValidLen: subscriberNumber.length >= 6 && subscriberNumber.length <= 12
    };
  }, [phoneTestInput]);

  const regions = ['All', 'Popular', 'Asia', 'Middle East', 'Europe', 'Americas', 'Africa', 'Oceania'];

  return (
    <div className="space-y-8 animate-fade-in text-[var(--theme-text)]">
      {/* Header section */}
      <div className="border-b border-[var(--theme-card-border)] pb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20 shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--theme-text)] flex items-center gap-2">
                Country & Phone Code Directory
                <span className="text-xs font-mono font-normal bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] px-2.5 py-0.5 rounded-full border border-[var(--theme-accent)]/20">
                  {COUNTRIES_DATA.length}+ Countries
                </span>
              </h2>
              <p className="text-xs md:text-sm text-[var(--theme-text-muted)] mt-0.5">
                Search and look up country codes (ISO-2/ISO-3) and international phone dialing prefixes (+1, +44, +880) for countries worldwide.
              </p>
            </div>
          </div>

          {/* Copy Toast Indicator */}
          {copiedField && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2 shadow-sm animate-fade-in">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Copied {copiedField.split(':')[1]}!</span>
            </div>
          )}
        </div>
      </div>

      {/* Instant Phone Number reverse detector card */}
      <div className="bg-[var(--theme-bg)] border border-[var(--theme-card-border)] p-5 rounded-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-[var(--theme-accent)]" />
            <h3 className="text-xs font-mono uppercase font-bold tracking-wider text-[var(--theme-text)]">
              // Instant Phone Number Lookup
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[var(--theme-text-muted)]">
            Type any full number to detect its country
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-6 relative">
            <input
              type="text"
              value={phoneTestInput}
              onChange={(e) => setPhoneTestInput(e.target.value)}
              placeholder="e.g. +8801700000000 or +12025550123"
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/20 focus:border-[var(--theme-accent)]"
            />
            <Phone className="w-4 h-4 absolute left-3.5 top-3 text-[var(--theme-text-muted)]" />
          </div>

          <div className="md:col-span-6">
            {phoneLookupResult ? (
              <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-3 rounded-lg flex items-center justify-between gap-3 font-mono text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">
                    <CountryFlagImage
                      iso2={phoneLookupResult.country.iso2}
                      emoji={phoneLookupResult.country.flag}
                      name={phoneLookupResult.country.name}
                      size="lg"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[var(--theme-text)] truncate flex items-center gap-1.5">
                      <span>{phoneLookupResult.country.name}</span>
                      <span className="text-[10px] bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] px-1.5 py-0.2 rounded">
                        {phoneLookupResult.country.iso2}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--theme-text-muted)] truncate">
                      Dial Code: <span className="font-bold text-[var(--theme-text)]">{phoneLookupResult.country.dialCode}</span> | Capital: {phoneLookupResult.country.capital}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(phoneLookupResult.country.dialCode, 'Dial Code')}
                  className="px-2.5 py-1.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] text-[10px] font-bold rounded flex items-center gap-1 shrink-0 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>{phoneLookupResult.country.dialCode}</span>
                </button>
              </div>
            ) : (
              <div className="bg-[var(--theme-card-bg)] border border-dashed border-[var(--theme-card-border)] p-3 rounded-lg text-xs font-mono text-[var(--theme-text-muted)] text-center">
                Enter number starting with country prefix (e.g. +880, +1, +91)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Search Controls & Region Pills */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Main search bar */}
          <div className="relative flex-grow max-w-xl">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[var(--theme-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by country name, +code (e.g., +880), ISO (BD/BGD), or capital..."
              className="w-full pl-10 pr-10 py-2.5 bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/20 focus:border-[var(--theme-accent)] shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort & View mode toggles */}
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            {/* Sort selection */}
            <div className="flex items-center gap-1.5 bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] px-2.5 py-1.5 rounded-lg text-xs font-mono">
              <ArrowUpDown className="w-3.5 h-3.5 text-[var(--theme-text-muted)]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-[var(--theme-text)] focus:outline-none cursor-pointer font-bold"
              >
                <option value="name">Sort Name</option>
                <option value="dialCode">Sort Code (+)</option>
                <option value="region">Sort Region</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="hover:text-[var(--theme-accent)] text-[10px] font-bold uppercase border-l border-[var(--theme-card-border)] pl-1.5"
              >
                {sortOrder}
              </button>
            </div>

            {/* View Mode Grid/Table toggle */}
            <div className="flex items-center bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] p-1 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${
                  viewMode === 'grid'
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)]'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                } transition-colors`}
                title="Grid Card View"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded ${
                  viewMode === 'table'
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)]'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]'
                } transition-colors`}
                title="Compact Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Region filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none font-mono text-xs">
          {regions.map((region) => {
            const isActive = selectedRegion === region;
            return (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] border-[var(--theme-accent)] font-bold shadow-sm'
                    : 'bg-[var(--theme-card-bg)] text-[var(--theme-text-muted)] border-[var(--theme-card-border)] hover:border-[var(--theme-text)] hover:text-[var(--theme-text)]'
                }`}
              >
                {region === 'All' ? '🌐 All Countries' : region === 'Popular' ? '★ Popular' : region}
              </button>
            );
          })}
        </div>
      </div>

      {/* Countries Count status summary */}
      <div className="flex items-center justify-between text-xs font-mono text-[var(--theme-text-muted)] border-b border-[var(--theme-card-border)] pb-2">
        <span>
          Showing <b className="text-[var(--theme-text)]">{filteredCountries.length}</b> countries
          {searchQuery ? ` matching "${searchQuery}"` : ''}
        </span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-[var(--theme-accent)] hover:underline font-bold"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Render Countries - Grid View or Table View */}
      {filteredCountries.length === 0 ? (
        <div className="text-center py-16 bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-xl space-y-3">
          <Globe className="w-10 h-10 text-[var(--theme-text-muted)] mx-auto opacity-50" />
          <h3 className="text-sm font-bold text-[var(--theme-text)] uppercase font-mono">
            No matching country found
          </h3>
          <p className="text-xs text-[var(--theme-text-muted)] max-w-sm mx-auto">
            We couldn't find any country matching &ldquo;{searchQuery}&rdquo;. Try searching for &ldquo;Bangladesh&rdquo;, &ldquo;+880&rdquo;, &ldquo;BD&rdquo; or &ldquo;USA&rdquo;.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedRegion('All');
            }}
            className="px-4 py-2 bg-[var(--theme-accent)] text-[var(--theme-accent-text)] rounded-lg text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
          >
            Reset Search Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCountries.map((country) => (
            <div
              key={`${country.iso2}-${country.name}`}
              className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] p-4 rounded-xl transition-all duration-200 flex flex-col justify-between space-y-4 group hover:shadow-md relative"
            >
              <div className="space-y-3">
                {/* Header row: Flag, Name, Dial Code Pill */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="shrink-0 group-hover:scale-105 transition-transform">
                      <CountryFlagImage
                        iso2={country.iso2}
                        emoji={country.flag}
                        name={country.name}
                        size="md"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-[var(--theme-text)] truncate group-hover:text-[var(--theme-accent)] transition-colors">
                        {country.name}
                      </h3>
                      {country.nativeName && country.nativeName !== country.name && (
                        <p className="text-[11px] text-[var(--theme-text-muted)] truncate">
                          {country.nativeName}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopy(country.dialCode, 'Dial Code')}
                    className="bg-[var(--theme-accent)]/10 hover:bg-[var(--theme-accent)] text-[var(--theme-accent)] hover:text-[var(--theme-accent-text)] px-2.5 py-1 rounded-lg font-mono text-xs font-bold shrink-0 transition-colors flex items-center gap-1 border border-[var(--theme-accent)]/20"
                    title="Click to copy calling code"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{country.dialCode}</span>
                  </button>
                </div>

                {/* ISO Badges & Region */}
                <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
                  <span
                    onClick={() => handleCopy(country.iso2, 'ISO-2')}
                    className="bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] px-2 py-0.5 rounded text-[var(--theme-text)] font-bold cursor-pointer transition-colors"
                    title="Copy ISO 2-letter code"
                  >
                    ISO2: <b>{country.iso2}</b>
                  </span>
                  <span
                    onClick={() => handleCopy(country.iso3, 'ISO-3')}
                    className="bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] px-2 py-0.5 rounded text-[var(--theme-text)] font-bold cursor-pointer transition-colors"
                    title="Copy ISO 3-letter code"
                  >
                    ISO3: <b>{country.iso3}</b>
                  </span>
                  <span className="bg-[var(--theme-bg)] border border-[var(--theme-card-border)] text-[var(--theme-text-muted)] px-2 py-0.5 rounded">
                    {country.region}
                  </span>
                </div>

                {/* Capital & Currency Info */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1 border-t border-[var(--theme-card-border)]/60 text-[var(--theme-text-muted)]">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-[var(--theme-accent)]" />
                    <span className="truncate">{country.capital}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate justify-end">
                    <Coins className="w-3.5 h-3.5 shrink-0 text-[var(--theme-accent)]" />
                    <span className="truncate">{country.currency.code} ({country.currency.symbol})</span>
                  </div>
                </div>
              </div>

              {/* Action buttons row */}
              <div className="pt-2 flex items-center justify-between text-[11px] font-mono border-t border-[var(--theme-card-border)]">
                <button
                  onClick={() =>
                    handleCopy(
                      `${country.name} (${country.iso2}/${country.iso3}) | Dial Code: ${country.dialCode} | Capital: ${country.capital} | Currency: ${country.currency.code} (${country.currency.symbol})`,
                      'Full Summary'
                    )
                  }
                  className="text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center gap-1 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Summary</span>
                </button>

                <button
                  onClick={() => {
                    setPhoneTestInput(`${country.dialCode}1700000000`);
                    window.scrollTo({ top: 120, behavior: 'smooth' });
                  }}
                  className="text-[var(--theme-accent)] hover:underline flex items-center gap-1 font-bold"
                >
                  <span>Test Number</span>
                  <PhoneCall className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[var(--theme-bg)] border-b border-[var(--theme-card-border)] text-[var(--theme-text-muted)] uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Country</th>
                  <th className="py-3 px-4">Dial Code</th>
                  <th className="py-3 px-4">ISO 2</th>
                  <th className="py-3 px-4">ISO 3</th>
                  <th className="py-3 px-4">Capital</th>
                  <th className="py-3 px-4">Currency</th>
                  <th className="py-3 px-4">Region</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--theme-card-border)]">
                {filteredCountries.map((country) => (
                  <tr
                    key={`${country.iso2}-${country.name}`}
                    className="hover:bg-[var(--theme-bg)]/60 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-[var(--theme-text)]">
                      <div className="flex items-center gap-2.5">
                        <CountryFlagImage
                          iso2={country.iso2}
                          emoji={country.flag}
                          name={country.name}
                          size="sm"
                        />
                        <div>
                          <div>{country.name}</div>
                          {country.nativeName && (
                            <div className="text-[10px] text-[var(--theme-text-muted)] font-normal">
                              {country.nativeName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-[var(--theme-accent)]">
                      <button
                        onClick={() => handleCopy(country.dialCode, 'Dial Code')}
                        className="hover:underline flex items-center gap-1"
                        title="Copy Calling Code"
                      >
                        {country.dialCode}
                        <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-[var(--theme-bg)] border border-[var(--theme-card-border)] px-1.5 py-0.5 rounded font-bold">
                        {country.iso2}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-[var(--theme-bg)] border border-[var(--theme-card-border)] px-1.5 py-0.5 rounded font-bold">
                        {country.iso3}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--theme-text-muted)]">{country.capital}</td>
                    <td className="py-3 px-4 text-[var(--theme-text-muted)]">
                      {country.currency.code} ({country.currency.symbol})
                    </td>
                    <td className="py-3 px-4 text-[var(--theme-text-muted)]">{country.region}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() =>
                          handleCopy(
                            `${country.name}: Code ${country.dialCode}, ISO2 ${country.iso2}, ISO3 ${country.iso3}`,
                            'Summary'
                          )
                        }
                        className="p-1.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] rounded transition-colors text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"
                        title="Copy Country Data"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
