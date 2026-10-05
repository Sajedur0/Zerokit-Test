/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Copy, Check, RotateCw, Lock } from 'lucide-react';

export default function PasswordManager() {
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [copied, setCopied] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastText(msg);
  };

  useEffect(() => {
    if (!toastText) return;
    const timer = setTimeout(() => {
      setToastText(null);
    }, 2500);
    return () => clearTimeout(timer);
  }, [toastText]);

  useEffect(() => {
    generatePassword();
  }, []);

  const generatePassword = () => {
    let charset = '';
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers) charset += '0123456789';
    if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!charset) {
      setPassword('');
      return;
    }

    let result = '';
    // Use window.crypto for secure password generation if available, otherwise fallback to Math.random
    if (window.crypto && window.crypto.getRandomValues) {
      const array = new Uint32Array(length);
      window.crypto.getRandomValues(array);
      for (let i = 0; i < length; i++) {
        result += charset[array[i] % charset.length];
      }
    } else {
      for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
      }
    }
    setPassword(result);
  };

  const getStrength = (val: string) => {
    if (!val) return { label: 'Empty', score: 0, color: 'bg-neutral-200', text: 'text-neutral-500' };
    let score = 0;
    if (val.length >= 8) score += 1;
    if (val.length >= 14) score += 1;
    if (/[A-Z]/.test(val)) score += 1;
    if (/[a-z]/.test(val)) score += 1;
    if (/[0-9]/.test(val)) score += 1;
    if (/[^A-Za-z0-9]/.test(val)) score += 1;

    if (score <= 2) return { label: 'Weak', score: 25, color: 'bg-red-500', text: 'text-red-500' };
    if (score <= 4) return { label: 'Medium', score: 50, color: 'bg-amber-500', text: 'text-amber-500' };
    if (score === 5) return { label: 'Strong', score: 75, color: 'bg-emerald-500', text: 'text-emerald-500' };
    return { label: 'Ultimate', score: 100, color: 'bg-blue-600 animate-pulse', text: 'text-blue-600' };
  };

  const copyToClipboard = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    triggerToast('Generated backup key copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const strengthInfo = getStrength(password);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
          <Lock className="w-6 h-6 text-neutral-900" /> Secure Password Manager
        </h2>
        <p className="text-neutral-500 mt-1">
          Generate industrial-strength cryptographic keys instantly with customizable character sets.
        </p>
      </div>

      {/* Generator Controls */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm space-y-6 max-w-3xl">
        <h3 className="font-semibold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-neutral-600" />
          Key Generator
        </h3>

        {/* Password Visualizer Box */}
        <div className="relative">
          <div className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-4 pr-24 font-mono text-lg text-neutral-800 break-all select-all min-h-[3.5rem] flex items-center">
            {password || <span className="text-neutral-400">Select options below...</span>}
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={generatePassword}
              title="Regenerate password"
              className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <RotateCw className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={copyToClipboard}
              disabled={!password}
              title="Copy Password"
              className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors disabled:opacity-50"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Strength Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-neutral-500 uppercase tracking-wider">Key Strength</span>
            <span className={`${strengthInfo.text} font-bold`}>{strengthInfo.label}</span>
          </div>
          <div className="w-full bg-neutral-100 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${strengthInfo.color}`}
              style={{ width: `${strengthInfo.score}%` }}
            ></div>
          </div>
        </div>

        {/* Slider Options */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label htmlFor="length-range" className="text-sm font-medium text-neutral-700">Length: {length} chars</label>
          </div>
          <input
            id="length-range"
            type="range"
            min="6"
            max="64"
            value={length}
            onChange={(e) => {
              setLength(Number(e.target.value));
            }}
            className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
          />
          <div className="flex justify-between text-xs text-neutral-400 font-mono">
            <span>6</span>
            <span>16</span>
            <span>32</span>
            <span>48</span>
            <span>64</span>
          </div>
        </div>

        {/* Checkbox Grid */}
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-3 p-3 border border-neutral-150 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={includeUppercase}
              onChange={(e) => setIncludeUppercase(e.target.checked)}
              className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4"
            />
            <span className="text-sm font-medium text-neutral-700">Uppercase</span>
          </label>

          <label className="flex items-center gap-3 p-3 border border-neutral-150 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={includeLowercase}
              onChange={(e) => setIncludeLowercase(e.target.checked)}
              className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4"
            />
            <span className="text-sm font-medium text-neutral-700">Lowercase</span>
          </label>

          <label className="flex items-center gap-3 p-3 border border-neutral-150 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={includeNumbers}
              onChange={(e) => setIncludeNumbers(e.target.checked)}
              className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4"
            />
            <span className="text-sm font-medium text-neutral-700">Numbers</span>
          </label>

          <label className="flex items-center gap-3 p-3 border border-neutral-150 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={includeSymbols}
              onChange={(e) => setIncludeSymbols(e.target.checked)}
              className="rounded border-neutral-300 text-black focus:ring-black h-4 w-4"
            />
            <span className="text-sm font-medium text-neutral-700">Symbols</span>
          </label>
        </div>

        <button
          type="button"
          onClick={generatePassword}
          className="w-full bg-black hover:bg-neutral-800 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-98"
        >
          <RotateCw className="w-4 h-4" /> Generate New Key
        </button>
      </div>

      {/* Floating Success Toast Overlay */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-neutral-900 border border-neutral-800 text-white rounded-lg px-4 py-3 shadow-2xl transition-all duration-300 ease-out select-none ${
          toastText
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-4 opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <span className="p-1 bg-emerald-500/10 text-emerald-400 rounded-full">
          <Check className="w-3.5 h-3.5" />
        </span>
        <span className="text-xs font-mono font-medium tracking-wide">{toastText}</span>
      </div>
    </div>
  );
}
