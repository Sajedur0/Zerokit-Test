/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Ruler,
  Scale,
  Thermometer,
  Gauge,
  ArrowLeftRight,
  Square,
  Box,
  HardDrive,
  Clock,
  Copy,
  Check,
  RotateCcw,
  Sparkles
} from 'lucide-react';

type Category = 'length' | 'weight' | 'temp' | 'speed' | 'area' | 'volume' | 'data' | 'time';

interface UnitDefinition {
  value: string;
  label: string;
  factor: number;
}

const UNITS: Record<Category, UnitDefinition[]> = {
  length: [
    { value: 'm', label: 'Meters (m)', factor: 1 },
    { value: 'km', label: 'Kilometers (km)', factor: 1000 },
    { value: 'cm', label: 'Centimeters (cm)', factor: 0.01 },
    { value: 'mm', label: 'Millimeters (mm)', factor: 0.001 },
    { value: 'mi', label: 'Miles (mi)', factor: 1609.344 },
    { value: 'ft', label: 'Feet (ft)', factor: 0.3048 },
    { value: 'in', label: 'Inches (in)', factor: 0.0254 },
    { value: 'yd', label: 'Yards (yd)', factor: 0.9144 },
    { value: 'nmi', label: 'Nautical Miles (nmi)', factor: 1852 }
  ],
  weight: [
    { value: 'kg', label: 'Kilograms (kg)', factor: 1 },
    { value: 'g', label: 'Grams (g)', factor: 0.001 },
    { value: 'mg', label: 'Milligrams (mg)', factor: 0.000001 },
    { value: 'lb', label: 'Pounds (lb)', factor: 0.45359237 },
    { value: 'oz', label: 'Ounces (oz)', factor: 0.0283495231 },
    { value: 't', label: 'Metric Tons (t)', factor: 1000 },
    { value: 'st', label: 'Stone (st)', factor: 6.35029318 }
  ],
  temp: [
    { value: 'C', label: 'Celsius (°C)', factor: 1 },
    { value: 'F', label: 'Fahrenheit (°F)', factor: 1 },
    { value: 'K', label: 'Kelvin (K)', factor: 1 }
  ],
  speed: [
    { value: 'kmh', label: 'Kilometers/Hour (km/h)', factor: 1 / 3.6 },
    { value: 'mph', label: 'Miles/Hour (mph)', factor: 0.44704 },
    { value: 'mps', label: 'Meters/Second (m/s)', factor: 1 },
    { value: 'knot', label: 'Knots (kn)', factor: 0.514444 },
    { value: 'fts', label: 'Feet/Second (ft/s)', factor: 0.3048 }
  ],
  area: [
    { value: 'm2', label: 'Square Meters (m²)', factor: 1 },
    { value: 'km2', label: 'Square Kilometers (km²)', factor: 1000000 },
    { value: 'cm2', label: 'Square Centimeters (cm²)', factor: 0.0001 },
    { value: 'ha', label: 'Hectares (ha)', factor: 10000 },
    { value: 'ac', label: 'Acres (ac)', factor: 4046.85642 },
    { value: 'ft2', label: 'Square Feet (ft²)', factor: 0.09290304 },
    { value: 'in2', label: 'Square Inches (in²)', factor: 0.00064516 }
  ],
  volume: [
    { value: 'L', label: 'Liters (L)', factor: 1 },
    { value: 'mL', label: 'Milliliters (mL)', factor: 0.001 },
    { value: 'm3', label: 'Cubic Meters (m³)', factor: 1000 },
    { value: 'gal', label: 'US Gallons (gal)', factor: 3.78541 },
    { value: 'qt', label: 'US Quarts (qt)', factor: 0.946353 },
    { value: 'pt', label: 'US Pints (pt)', factor: 0.473176 },
    { value: 'cup', label: 'US Cups (cup)', factor: 0.24 },
    { value: 'floz', label: 'Fluid Ounces (fl oz)', factor: 0.0295735 }
  ],
  data: [
    { value: 'B', label: 'Bytes (B)', factor: 1 },
    { value: 'KB', label: 'Kilobytes (KB)', factor: 1024 },
    { value: 'MB', label: 'Megabytes (MB)', factor: 1048576 },
    { value: 'GB', label: 'Gigabytes (GB)', factor: 1073741824 },
    { value: 'TB', label: 'Terabytes (TB)', factor: 1099511627776 }
  ],
  time: [
    { value: 's', label: 'Seconds (s)', factor: 1 },
    { value: 'min', label: 'Minutes (min)', factor: 60 },
    { value: 'h', label: 'Hours (h)', factor: 3600 },
    { value: 'd', label: 'Days (d)', factor: 86400 },
    { value: 'wk', label: 'Weeks (wk)', factor: 604800 },
    { value: 'mo', label: 'Months (30d)', factor: 2592000 },
    { value: 'yr', label: 'Years (365d)', factor: 31536000 }
  ]
};

const DEFAULT_UNITS: Record<Category, { u1: string; u2: string }> = {
  length: { u1: 'm', u2: 'ft' },
  weight: { u1: 'kg', u2: 'lb' },
  temp: { u1: 'C', u2: 'F' },
  speed: { u1: 'kmh', u2: 'mph' },
  area: { u1: 'm2', u2: 'ft2' },
  volume: { u1: 'L', u2: 'gal' },
  data: { u1: 'MB', u2: 'GB' },
  time: { u1: 'h', u2: 'min' }
};

export default function UnitConverter() {
  const [category, setCategory] = useState<Category>('length');
  const [val1, setVal1] = useState<string>('1');
  const [val2, setVal2] = useState<string>('');
  const [unit1, setUnit1] = useState<string>('m');
  const [unit2, setUnit2] = useState<string>('ft');
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Helper for high-precision conversion
  const computeConversion = (valStr: string, fromUnit: string, toUnit: string, cat: Category): string => {
    const num = parseFloat(valStr);
    if (isNaN(num)) return '';
    if (fromUnit === toUnit) return valStr;

    if (cat === 'temp') {
      let celsius = num;
      if (fromUnit === 'F') celsius = ((num - 32) * 5) / 9;
      else if (fromUnit === 'K') celsius = num - 273.15;

      let result = celsius;
      if (toUnit === 'F') result = (celsius * 9) / 5 + 32;
      else if (toUnit === 'K') result = celsius + 273.15;

      const rounded = Number(result.toFixed(6));
      return rounded.toString();
    }

    const list = UNITS[cat];
    const uFrom = list.find((u) => u.value === fromUnit);
    const uTo = list.find((u) => u.value === toUnit);

    if (!uFrom || !uTo) return '';

    const baseValue = num * uFrom.factor;
    const resultValue = baseValue / uTo.factor;
    const rounded = Number(resultValue.toFixed(8));
    return rounded.toString();
  };

  // Reset defaults when switching category
  useEffect(() => {
    const defaults = DEFAULT_UNITS[category];
    setUnit1(defaults.u1);
    setUnit2(defaults.u2);
    setVal1('1');
    setVal2(computeConversion('1', defaults.u1, defaults.u2, category));
  }, [category]);

  // Handle Source input change
  const handleVal1Change = (newVal: string) => {
    setVal1(newVal);
    setVal2(computeConversion(newVal, unit1, unit2, category));
  };

  // Handle Destination input change
  const handleVal2Change = (newVal: string) => {
    setVal2(newVal);
    setVal1(computeConversion(newVal, unit2, unit1, category));
  };

  // Handle Source Unit change
  const handleUnit1Change = (newUnit: string) => {
    setUnit1(newUnit);
    setVal2(computeConversion(val1, newUnit, unit2, category));
  };

  // Handle Destination Unit change
  const handleUnit2Change = (newUnit: string) => {
    setUnit2(newUnit);
    setVal2(computeConversion(val1, unit1, newUnit, category));
  };

  // Smooth SWAP / SWIPE functionality
  const handleSwap = () => {
    setIsSwapping(true);
    setTimeout(() => {
      setIsSwapping(false);
    }, 400);

    const prevU1 = unit1;
    const prevU2 = unit2;
    const prevV1 = val1;
    const prevV2 = val2;

    setUnit1(prevU2);
    setUnit2(prevU1);
    setVal1(prevV2);
    setVal2(prevV1);
  };

  const handleCopyResult = () => {
    if (!val2) return;
    const fromLabel = UNITS[category].find((u) => u.value === unit1)?.label || unit1;
    const toLabel = UNITS[category].find((u) => u.value === unit2)?.label || unit2;
    const textToCopy = `${val1} ${fromLabel} = ${val2} ${toLabel}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryIcon = (cat: Category) => {
    switch (cat) {
      case 'length':
        return <Ruler className="w-4 h-4" />;
      case 'weight':
        return <Scale className="w-4 h-4" />;
      case 'temp':
        return <Thermometer className="w-4 h-4" />;
      case 'speed':
        return <Gauge className="w-4 h-4" />;
      case 'area':
        return <Square className="w-4 h-4" />;
      case 'volume':
        return <Box className="w-4 h-4" />;
      case 'data':
        return <HardDrive className="w-4 h-4" />;
      case 'time':
        return <Clock className="w-4 h-4" />;
    }
  };

  const categoriesList: { id: Category; label: string }[] = [
    { id: 'length', label: 'Length' },
    { id: 'weight', label: 'Weight' },
    { id: 'temp', label: 'Temperature' },
    { id: 'speed', label: 'Speed' },
    { id: 'area', label: 'Area' },
    { id: 'volume', label: 'Volume' },
    { id: 'data', label: 'Data Storage' },
    { id: 'time', label: 'Time' }
  ];

  return (
    <div className="space-y-8 text-[var(--theme-text)] animate-fade-in">
      {/* Tool Header */}
      <div className="border-b border-[var(--theme-card-border)] pb-6 space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] border border-[var(--theme-accent)]/20 shrink-0">
            {getCategoryIcon(category)}
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--theme-text)] flex items-center gap-2">
              Universal Unit & Metric Converter
            </h2>
            <p className="text-xs md:text-sm text-[var(--theme-text-muted)] mt-0.5">
              Perform high-precision conversions across globally recognized metric & imperial standards.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Category selector tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none bg-[var(--theme-card-bg)] p-1.5 rounded-xl border border-[var(--theme-card-border)] shadow-sm font-mono text-xs">
          {categoriesList.map((cat) => {
            const isActive = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all font-bold ${
                  isActive
                    ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-sm'
                    : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-bg)]'
                }`}
              >
                {getCategoryIcon(cat.id)}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Converter Card Container */}
        <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-2xl p-6 md:p-8 shadow-sm space-y-6 relative">
          <div className="grid grid-cols-1 md:grid-cols-11 gap-4 md:gap-2 items-center">
            
            {/* Left Box: Source Value & Unit */}
            <div className="md:col-span-5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] p-4 md:p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-mono uppercase text-[var(--theme-text-muted)] font-bold">
                <span>Source Value</span>
                <span className="text-[var(--theme-accent)]">{unit1}</span>
              </div>

              <input
                type="number"
                value={val1}
                onChange={(e) => handleVal1Change(e.target.value)}
                placeholder="0"
                className="w-full text-2xl md:text-3xl font-mono font-extrabold bg-transparent border-b-2 border-[var(--theme-card-border)] focus:border-[var(--theme-accent)] pb-2 text-[var(--theme-text)] focus:outline-none transition-colors"
              />

              <select
                value={unit1}
                onChange={(e) => handleUnit1Change(e.target.value)}
                className="w-full bg-[var(--theme-card-bg)] px-3 py-2.5 rounded-lg border border-[var(--theme-card-border)] text-xs font-mono font-bold text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-accent)] cursor-pointer"
              >
                {UNITS[category].map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Center: Interactive Swap / Swipe Button */}
            <div className="md:col-span-1 flex items-center justify-center py-2 md:py-0">
              <button
                type="button"
                onClick={handleSwap}
                title="Swipe / Swap units and values"
                className="group relative p-3.5 bg-[var(--theme-accent)] text-[var(--theme-accent-text)] rounded-full shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-[var(--theme-card-border)] flex items-center justify-center shrink-0"
              >
                <ArrowLeftRight
                  className={`w-5 h-5 transition-transform duration-300 ${
                    isSwapping ? 'rotate-180 scale-110' : 'group-hover:rotate-45'
                  }`}
                />
                <span className="sr-only">Swap Units</span>
              </button>
            </div>

            {/* Right Box: Destination Converted Output & Unit */}
            <div className="md:col-span-5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] p-4 md:p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-mono uppercase text-[var(--theme-text-muted)] font-bold">
                <span>Converted Output</span>
                <span className="text-[var(--theme-accent)]">{unit2}</span>
              </div>

              <input
                type="number"
                value={val2}
                onChange={(e) => handleVal2Change(e.target.value)}
                placeholder="0"
                className="w-full text-2xl md:text-3xl font-mono font-extrabold bg-transparent border-b-2 border-[var(--theme-card-border)] focus:border-[var(--theme-accent)] pb-2 text-[var(--theme-text)] focus:outline-none transition-colors"
              />

              <select
                value={unit2}
                onChange={(e) => handleUnit2Change(e.target.value)}
                className="w-full bg-[var(--theme-card-bg)] px-3 py-2.5 rounded-lg border border-[var(--theme-card-border)] text-xs font-mono font-bold text-[var(--theme-text)] focus:outline-none focus:border-[var(--theme-accent)] cursor-pointer"
              >
                {UNITS[category].map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Result Summary Bar & Copy Button */}
          {val1 && val2 && (
            <div className="bg-[var(--theme-bg)] border border-[var(--theme-accent)]/30 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--theme-accent)] shrink-0" />
                <span className="text-[var(--theme-text-muted)]">Conversion Equation:</span>
                <span className="font-bold text-[var(--theme-text)]">
                  {val1} {UNITS[category].find((u) => u.value === unit1)?.label} ={' '}
                  <span className="text-[var(--theme-accent)]">{val2}</span>{' '}
                  {UNITS[category].find((u) => u.value === unit2)?.label}
                </span>
              </div>

              <button
                onClick={handleCopyResult}
                className="px-3 py-1.5 bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] rounded-lg font-bold text-[var(--theme-text)] flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Copied Result!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Equation</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Formula Reference Footnote */}
        <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-xl p-4 text-xs font-mono text-[var(--theme-text-muted)] text-center">
          <strong>Precision Standard:</strong> IEEE 754 floating point precision calculation converting{' '}
          <span className="text-[var(--theme-text)] font-bold">
            {UNITS[category].find((u) => u.value === unit1)?.label}
          </span>{' '}
          to{' '}
          <span className="text-[var(--theme-text)] font-bold">
            {UNITS[category].find((u) => u.value === unit2)?.label}
          </span>.
        </div>
      </div>
    </div>
  );
}
