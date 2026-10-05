/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, Link, Trash2, Sliders, Type, Settings, Mail, Wifi } from 'lucide-react';

type QRType = 'link' | 'plain' | 'wifi' | 'email';

export default function QrGenerator() {
  const [qrType, setQrType] = useState<QRType>('link');
  const [inputText, setInputText] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiEnc, setWifiEnc] = useState('WPA');
  const [mailTo, setMailTo] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');

  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [size, setSize] = useState(256);
  const [margin, setMargin] = useState(4);
  const [qrImageSrc, setQrImageSrc] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestIdRef = useRef(0);

  // Escape `\` `;` `,` `:` inside WiFi SSID/password per the WiFi QR spec
  const escapeWifiValue = (value: string) => value.replace(/([\\;,:"])/g, '\\$1');

  // Compile final input string according to selectors
  const getCompiledText = () => {
    switch (qrType) {
      case 'link':
        // Ensure web link contains protocols
        if (inputText && !/^https?:\/\//i.test(inputText)) {
          return `https://${inputText}`;
        }
        return inputText || '';
      case 'wifi': {
        const ssid = escapeWifiValue(wifiSsid);
        if (wifiEnc === 'nopass') {
          return `WIFI:T:nopass;S:${ssid};;`;
        }
        const pass = escapeWifiValue(wifiPassword);
        return `WIFI:T:${wifiEnc};S:${ssid};P:${pass};;`;
      }
      case 'email':
        return `mailto:${mailTo}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
      default:
        return inputText || '';
    }
  };

  const generateQRCode = async () => {
    setErrorMsg(null);
    const content = getCompiledText();
    if (!content.trim()) {
      setQrImageSrc('');
      return;
    }

    const requestId = ++requestIdRef.current;

    try {
      const options: QRCode.QRCodeToDataURLOptions = {
        width: size,
        margin: margin,
        color: {
          dark: fgColor,
          light: bgColor,
        },
        errorCorrectionLevel: 'H', // High reliability for custom brand overlay
      };

      const dataUrl = await QRCode.toDataURL(content, options);

      // Only apply the result if no newer request has started since
      if (requestId === requestIdRef.current) {
        setQrImageSrc(dataUrl);
      }
    } catch (err: any) {
      if (requestId === requestIdRef.current) {
        console.error(err);
        setErrorMsg(err.message || 'QR generation failed codes limit exceeded!');
      }
    }
  };

  // Re-generate in real-time when configs alter (debounced to avoid
  // firing on every single keystroke and racing stale requests)
  useEffect(() => {
    const timer = setTimeout(() => {
      generateQRCode();
    }, 250);
    return () => clearTimeout(timer);
  }, [
    qrType,
    inputText,
    wifiSsid,
    wifiPassword,
    wifiEnc,
    mailTo,
    mailSubject,
    mailBody,
    fgColor,
    bgColor,
    size,
    margin,
  ]);

  const downloadQR = () => {
    if (!qrImageSrc) return;
    const link = document.createElement('a');
    link.download = `toolvault-qr-${qrType}.png`;
    link.href = qrImageSrc;
    link.click();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
          <QrCode className="w-6 h-6 text-neutral-900" /> High-Resolution Vector QR Generator
        </h2>
        <p className="text-neutral-500 mt-1">
          Synthesize custom high-contrast QR matrix codes for links, text, WiFi credentials, or secure email protocols.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Input Configuration Panel */}
        <div className="lg:col-span-7 bg-white border border-neutral-200 rounded-xl p-6 shadow-sm space-y-6">
          {/* Sub category tabs */}
          <div className="flex bg-neutral-100 p-1 rounded-lg">
            {[
              { id: 'link', label: 'URL Link', icon: <Link className="w-3.5 h-3.5" /> },
              { id: 'plain', label: 'Plain Text', icon: <Type className="w-3.5 h-3.5" /> },
              { id: 'wifi', label: 'WiFi Login', icon: <Wifi className="w-3.5 h-3.5" /> },
              { id: 'email', label: 'Email Tag', icon: <Mail className="w-3.5 h-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setQrType(tab.id as QRType)}
                className={`flex-1 py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
                  qrType === tab.id
                    ? 'bg-white text-neutral-900 shadow-sm font-bold'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Dynamic input fields based on type select */}
          <div className="space-y-4">
            {qrType === 'link' && (
              <div>
                <label htmlFor="url-input" className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                  Target Website Link URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-neutral-400">
                    <Link className="w-4 h-4" />
                  </div>
                  <input
                    id="url-input"
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="e.g., github.com/username"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-neutral-200 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                  />
                </div>
              </div>
            )}

            {qrType === 'plain' && (
              <div>
                <label htmlFor="plain-input" className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                  Plain Text Content
                </label>
                <textarea
                  id="plain-input"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type plain instructions or secret text values to package inside the QR map matrix..."
                  rows={4}
                  className="w-full rounded-lg border border-neutral-200 p-3 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none font-mono text-xs"
                />
              </div>
            )}

            {qrType === 'wifi' && (
              <div className="space-y-4 border border-neutral-100 p-4 rounded-lg bg-neutral-50/50">
                <div>
                  <label htmlFor="wifi-ssid-input" className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                    Network Name (SSID)
                  </label>
                  <input
                    id="wifi-ssid-input"
                    type="text"
                    required
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="wifi-password-input" className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                      Network Password
                    </label>
                    <input
                      id="wifi-password-input"
                      type="text"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="wifi-security-select" className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                      Encryption Tag
                    </label>
                    <select
                      id="wifi-security-select"
                      aria-label="WiFi Encryption Type"
                      value={wifiEnc}
                      onChange={(e) => setWifiEnc(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-black bg-white focus:ring-1 focus:ring-black outline-none font-semibold text-neutral-700"
                    >
                      <option value="WPA">WPA/WPA2</option>
                      <option value="WEP">WEP</option>
                      <option value="nopass">Unsecured (No Password)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {qrType === 'email' && (
              <div className="space-y-4 border border-neutral-100 p-4 rounded-lg bg-neutral-50/50">
                <div>
                  <label htmlFor="email-input" className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                    Destination Email Address
                  </label>
                  <input
                    id="email-input"
                    type="email"
                    required
                    value={mailTo}
                    onChange={(e) => setMailTo(e.target.value)}
                    placeholder="mail@example.com"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="email-subject" className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                    Preset Subject Line
                  </label>
                  <input
                    id="email-subject"
                    type="text"
                    value={mailSubject}
                    onChange={(e) => setMailSubject(e.target.value)}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="email-body" className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                    Default Message Body
                  </label>
                  <textarea
                    id="email-body"
                    value={mailBody}
                    onChange={(e) => setMailBody(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-neutral-200 p-3 text-sm focus:border-black focus:ring-1 focus:ring-black outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sizing & custom matrices */}
          <div className="border-t border-neutral-100 pt-5 space-y-4">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-neutral-500" /> Style Parameters & Customizers
            </h4>

            {/* Colors picker layout */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1">Foreground Matrix Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label="Foreground color picker"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-10 h-10 border border-neutral-300 rounded cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    aria-label="Foreground HEX value"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="flex-grow rounded border border-neutral-200 px-3 py-1 font-mono text-sm max-w-[120px] focus:ring-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1">Background Block color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label="Background color picker"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-10 h-10 border border-neutral-300 rounded cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    aria-label="Background HEX value"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="flex-grow rounded border border-neutral-200 px-3 py-1 font-mono text-sm max-w-[120px] focus:ring-black"
                  />
                </div>
              </div>
            </div>

            {/* Margin Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-neutral-500">
                <label htmlFor="margin-slider">Quiet Zone Padding (Margin)</label>
                <span className="font-mono">{margin} blocks</span>
              </div>
              <input
                id="margin-slider"
                type="range"
                min="0"
                max="10"
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
                className="w-full accent-black cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Output visualization panel (Right) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center min-h-[360px] text-center gap-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Generated Matrix Code</span>

            {/* Output image canvas visualization */}
            {qrImageSrc ? (
              <div className="p-4 rounded-xl border border-neutral-100 shadow-inner bg-neutral-50 max-w-[280px] w-full aspect-square flex items-center justify-center">
                <img
                  src={qrImageSrc}
                  alt="QR Code Map"
                  className="w-full h-full object-contain select-all shadow-sm rounded-lg"
                />
              </div>
            ) : (
              <div className="w-[220px] aspect-square rounded-xl bg-neutral-100 border border-dashed border-neutral-300 flex items-center justify-center text-neutral-300">
                <QrCode className="w-16 h-16" />
              </div>
            )}

            {/* Error notifications */}
            {errorMsg && (
              <div className="text-xs text-red-500 font-semibold p-2 bg-red-50 rounded border border-red-100 max-w-[220px] mx-auto break-all">
                {errorMsg}
              </div>
            )}

            <button
              onClick={downloadQR}
              disabled={!qrImageSrc}
              className="w-full max-w-[220px] bg-black hover:bg-neutral-800 text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:shadow shadow-sm active:scale-98"
            >
              <Download className="w-4 h-4" /> Download PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
