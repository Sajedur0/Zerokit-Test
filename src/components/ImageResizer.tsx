/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  Upload, 
  Download, 
  RefreshCw, 
  Check, 
  Sparkles,
  Maximize
} from 'lucide-react';

interface Preset {
  name: string;
  width: number;
  height: number;
  description: string;
}

const PRESETS: Preset[] = [
  { name: 'Square / Avatar', width: 400, height: 400, description: 'Profile Pic / Avatar' },
  { name: 'Instagram Post', width: 1080, height: 1080, description: 'High-quality square post' },
  { name: 'YouTube Thumbnail', width: 1280, height: 720, description: 'Standard 16:9 HD video' },
  { name: 'Facebook Host Cover', width: 1200, height: 630, description: 'Optimal landscape banner' },
  { name: '1080p Full HD', width: 1920, height: 1080, description: 'High definition screen' },
  { name: '4K Ultra HD', width: 3840, height: 2160, description: 'Ultra high-definition target' }
];

export default function ImageResizer() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalWidth, setOriginalWidth] = useState<number>(0);
  const [originalHeight, setOriginalHeight] = useState<number>(0);
  const [targetWidth, setTargetWidth] = useState<number>(800);
  const [targetHeight, setTargetHeight] = useState<number>(600);
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<number>(4 / 3);
  const [format, setFormat] = useState<string>('image/png'); // 'image/png', 'image/jpeg', 'image/webp'
  const [quality, setQuality] = useState<number>(90); // 10 to 100
  const [percentage, setPercentage] = useState<number>(100);
  const [fileName, setFileName] = useState<string>('resized-image.png');
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // In-browser safety cap to avoid freezing the tab on huge images
  const MAX_IMAGE_BYTES = 40 * 1024 * 1024; // 40 MB

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const loadImageFile = (file: File) => {
    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMessage(
        `${file.name} is ${formatBytes(file.size)} — over the ${formatBytes(MAX_IMAGE_BYTES)} in-browser limit. ` +
        `Compress or resize the image first to avoid freezing the tab.`
      );
      setImageSrc(null);
      setDownloadSuccess(false);
      return;
    }
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageSrc(event.target.result as string);
        setFileName(file.name);
        setDownloadSuccess(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Custom target size states
  const [enableSizeLimit, setEnableSizeLimit] = useState<boolean>(false);
  const [targetSizeVal, setTargetSizeVal] = useState<number>(150);
  const [targetSizeUnit, setTargetSizeUnit] = useState<'KB' | 'MB'>('KB');
  const [finalProcessedInfo, setFinalProcessedInfo] = useState<{ width: number; height: number; quality: number; fileSizeBytes: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // When image source changes or loads, get its natural dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setOriginalWidth(img.naturalWidth);
    setOriginalHeight(img.naturalHeight);
    setTargetWidth(img.naturalWidth);
    setTargetHeight(img.naturalHeight);
    if (img.naturalHeight > 0) {
      const ratio = img.naturalWidth / img.naturalHeight;
      setAspectRatio(ratio);
    }
    setPercentage(100);
  };

  // Handle changes to width
  const handleWidthChange = (val: number) => {
    if (val <= 0 || isNaN(val)) {
      setTargetWidth(0);
      return;
    }
    setTargetWidth(val);
    if (lockAspectRatio && aspectRatio) {
      setTargetHeight(Math.round(val / aspectRatio));
    }
    // calculate custom percentage
    if (originalWidth > 0) {
      setPercentage(Math.round((val / originalWidth) * 100));
    }
  };

  // Handle changes to height
  const handleHeightChange = (val: number) => {
    if (val <= 0 || isNaN(val)) {
      setTargetHeight(0);
      return;
    }
    setTargetHeight(val);
    if (lockAspectRatio && aspectRatio) {
      setTargetWidth(Math.round(val * aspectRatio));
    }
    // calculate custom percentage
    if (originalHeight > 0) {
      setPercentage(Math.round((val / originalHeight) * 100));
    }
  };

  // Handle percentage scale
  const handlePercentageChange = (pct: number) => {
    if (pct <= 0 || originalWidth <= 0 || originalHeight <= 0) return;
    setPercentage(pct);
    const newW = Math.round((originalWidth * pct) / 100);
    const newH = Math.round((originalHeight * pct) / 100);
    setTargetWidth(newW);
    setTargetHeight(newH);
  };

  const handlePresetSelect = (preset: Preset) => {
    if (lockAspectRatio && originalWidth > 0 && originalHeight > 0) {
      // If lock is active, prioritize width and scale height keeping natural aspect ratio
      const newH = Math.round(preset.width / aspectRatio);
      setTargetWidth(preset.width);
      setTargetHeight(newH);
      setPercentage(Math.round((preset.width / originalWidth) * 100));
    } else {
      setTargetWidth(preset.width);
      setTargetHeight(preset.height);
      if (originalWidth > 0) {
        setPercentage(Math.round((preset.width / originalWidth) * 100));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      loadImageFile(file);
    }
  };

  // Change file name suffix base on output format
  const getOutputFileName = (actualFormat: string) => {
    const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    const extension = actualFormat === 'image/jpeg' ? 'jpg' : actualFormat === 'image/webp' ? 'webp' : 'png';
    return `${baseName}-resized.${extension}`;
  };

  // Helper to search and optimize compression to hit a file size budget perfectly
  const optimizeToTargetSize = async (
    img: HTMLImageElement,
    targetSizeInBytes: number,
    outputFormat: string
  ): Promise<{ dataUrl: string; finalWidth: number; finalHeight: number; finalQuality: number }> => {
    const currentWidth = targetWidth;
    const currentHeight = targetHeight;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error("Canvas context is unavailable.");
    }

    const tryExport = (w: number, h: number, q: number): Promise<{ size: number; dataUrl: string }> => {
      return new Promise((resolve) => {
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        
        const qFactor = outputFormat === 'image/png' ? undefined : q / 100;
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve({ size: 0, dataUrl: '' });
            return;
          }
          const dataUrl = canvas.toDataURL(outputFormat, qFactor);
          resolve({ size: blob.size, dataUrl });
        }, outputFormat, qFactor);
      });
    };

    // 1. Lossless PNG format: PNG is lossless and doesn't support canvas compression quality factors.
    // If outputFormat is PNG, we maintain dimensions at maximum quality (but note: handleResizeAndDownload automatically switch to JPEG).
    if (outputFormat === 'image/png') {
      const attempt = await tryExport(currentWidth, currentHeight, 100);
      return { dataUrl: attempt.dataUrl, finalWidth: currentWidth, finalHeight: currentHeight, finalQuality: 100 };
    }

    // 2. Lossy formats (JPEG/WEBP): binary search compression quality (1 to 100) to hit the budget while retaining strict exact custom pixels
    // Let's first test the absolute lowest quality (1%) to see if even that is too big,
    // and use it as our baseline fallback.
    const baseline = await tryExport(currentWidth, currentHeight, 1);
    if (baseline.size > targetSizeInBytes) {
      // If even quality 1% exceeds target size limit, return quality 1% as the absolute smallest available size for these custom dimensions.
      return { dataUrl: baseline.dataUrl, finalWidth: currentWidth, finalHeight: currentHeight, finalQuality: 1 };
    }

    let lowQ = 1;
    let highQ = 100;
    let bestQ = 1;
    let bestDataUrl = baseline.dataUrl;

    // Binary search the perfect quality level
    for (let i = 0; i < 7; i++) {
      const midQ = Math.round((lowQ + highQ) / 2);
      const test = await tryExport(currentWidth, currentHeight, midQ);
      if (test.size <= targetSizeInBytes) {
        bestQ = midQ;
        bestDataUrl = test.dataUrl;
        lowQ = midQ + 1; // Try to get higher quality if possible
      } else {
        highQ = midQ - 1; // Exceeded target budget, lower quality
      }
    }

    // Return the optimized results keeping the dimensions strictly at the specified custom width and height
    return {
      dataUrl: bestDataUrl,
      finalWidth: currentWidth,
      finalHeight: currentHeight,
      finalQuality: bestQ
    };
  };

  // Perform canvas drawing and compression on resize download click
  const handleResizeAndDownload = () => {
    if (!imageSrc || targetWidth <= 0 || targetHeight <= 0) return;
    setDownloading(true);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

    img.onload = async () => {
      try {
        let finalDataUrl = '';
        let finalW = targetWidth;
        let finalH = targetHeight;
        let finalQ = quality;
        let finalSizeBytes = 0;
        let finalFormat = format;

        if (enableSizeLimit && targetSizeVal > 0) {
          const multiplier = targetSizeUnit === 'MB' ? 1024 * 1024 : 1024;
          const maxBytes = targetSizeVal * multiplier;
          
          let exportFormat = format;
          // PNG can't be compressed in quality. Force switch to JPEG to hit target budget under strict custom dimensions!
          if (format === 'image/png') {
            exportFormat = 'image/jpeg';
            finalFormat = 'image/jpeg';
          }
          
          const result = await optimizeToTargetSize(img, maxBytes, exportFormat);
          finalDataUrl = result.dataUrl;
          finalW = result.finalWidth;
          finalH = result.finalHeight;
          finalQ = result.finalQuality;
          
          // Calculate final blob size
          const base64Str = finalDataUrl.split(',')[1];
          finalSizeBytes = Math.round((base64Str.length * 3) / 4);
        } else {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setDownloading(false);
            return;
          }

          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          const qFactor = format === 'image/png' ? undefined : quality / 100;
          finalDataUrl = canvas.toDataURL(format, qFactor);
          const base64Str = finalDataUrl.split(',')[1];
          finalSizeBytes = Math.round((base64Str.length * 3) / 4);
        }

        // Create download pipeline
        const link = document.createElement('a');
        link.download = getOutputFileName(finalFormat);
        link.href = finalDataUrl;
        link.click();

        setFinalProcessedInfo({
          width: finalW,
          height: finalH,
          quality: finalQ,
          fileSizeBytes: finalSizeBytes
        });

        setDownloading(false);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 6000);
      } catch (err) {
        console.error(err);
        setDownloading(false);
        alert("An error occurred during resizing and processing.");
      }
    };

    img.onerror = () => {
      setDownloading(false);
      alert("Failed to load source image file for processing.");
    };
  };

  // Calculate file size estimation base on scale
  const estimateFileSize = () => {
    if (originalWidth === 0) return '0 KB';
    const reductionFactor = (targetWidth * targetHeight) / (originalWidth * originalHeight);
    const formatWeight = format === 'image/png' ? 1.0 : (quality / 100) * 0.75;
    const sizeEst = Math.round(500 * reductionFactor * formatWeight);
    if (sizeEst < 10) return '< 10 KB';
    if (sizeEst > 1024) return `${(sizeEst / 1024).toFixed(1)} MB`;
    return `${sizeEst} KB`;
  };

  return (
    <div className="space-y-8">
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--theme-card-border)] pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--theme-text)]">
            Image Resizer
          </h2>
          <p className="text-xs text-[var(--theme-text-muted)] mt-1">
            Instantly scale, lock proportions, choose custom files, compress and resize offline.
          </p>
        </div>
        
        {imageSrc && (
          <button
            onClick={() => {
              setImageSrc(null);
              setFileName('resized-image.png');
            }}
            className="text-xs font-mono font-bold text-[var(--theme-accent)] hover:underline flex items-center gap-1 self-start"
          >
            [CLOSE TOOL WORKSPACE]
          </button>
        )}
      </div>

      {!imageSrc ? (
        /* Empty Upload State Zone */
        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{ borderRadius: 'var(--theme-border-radius)' }}
          className="border-2 border-dashed border-[var(--theme-card-border)] bg-[var(--theme-bg)]/40 hover:border-[var(--theme-accent)]/40 transition-all p-12 text-center relative group min-h-[350px] flex flex-col justify-center items-center"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <div className="w-16 h-16 rounded-2xl bg-[var(--theme-panel-bg)] border border-[var(--theme-card-border)] shadow-sm flex items-center justify-center text-[var(--theme-accent)] mb-5 group-hover:scale-105 transition-transform duration-300">
            <Upload className="w-6 h-6" />
          </div>

          <div className="space-y-2 max-w-sm">
            <h3 className="text-md font-bold text-[var(--theme-text)]">Upload your image file</h3>
            <p className="text-xs text-[var(--theme-text-muted)] leading-relaxed">
              Drag and drop your image right here, or click to browse local files. Supports PNG, JPEG, and WEBP formats.
            </p>
          </div>

          {errorMessage && (
            <div className="mt-4 max-w-md text-left bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-rose-500 break-words">{errorMessage}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3 mt-8">
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ borderRadius: 'calc(var(--theme-border-radius) / 1.5 || 8px)' }}
              className="bg-[var(--theme-text)] text-[var(--theme-bg)] hover:opacity-90 active:scale-95 px-6 py-2.5 text-xs font-bold transition-all uppercase tracking-wider"
            >
              Browse Files
            </button>
          </div>
        </div>
      ) : (
        /* Workspace Active View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left panel: Original Preview & Resizing comparison */}
          <div className="lg:col-span-7 space-y-6">
            <div 
              style={{ borderRadius: 'var(--theme-border-radius)' }}
              className="bg-[var(--theme-bg)] border-2 border-[var(--theme-card-border)] p-4 flex items-center justify-center min-h-[300px] max-h-[500px] overflow-hidden relative group"
            >
              {/* Invisible Image to hook natural load data */}
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Source Image"
                onLoad={handleImageLoad}
                className="max-w-full max-h-[440px] object-contain rounded transition-all"
                style={{ 
                  filter: downloading ? 'blur(2px) brightness(0.9)' : 'none' 
                }}
              />

              {downloading && (
                <div className="absolute inset-0 bg-white/40 dark:bg-black/40 flex items-center justify-center">
                  <div className="bg-[var(--theme-panel-bg)] border border-[var(--theme-card-border)] rounded-full px-5 py-3 shadow-lg flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[var(--theme-accent)]" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--theme-text)]">
                      DRAFTER PIPELINE ACTIVE...
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Details Ribbon */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-[var(--theme-bg)]/80 border border-[var(--theme-card-border)] p-3 rounded-lg">
                <span className="text-[10px] font-mono font-bold tracking-wider text-[var(--theme-text-muted)] block uppercase">
                  ORIGINAL SIZE
                </span>
                <span className="text-sm font-bold text-[var(--theme-text)] mt-1 block">
                  {originalWidth} x {originalHeight} px
                </span>
              </div>
              <div className="bg-[var(--theme-bg)]/80 border border-[var(--theme-card-border)] p-3 rounded-lg">
                <span className="text-[10px] font-mono font-bold tracking-wider text-[var(--theme-text-muted)] block uppercase">
                  DESTINATION SIZE
                </span>
                <span className="text-sm font-bold text-[var(--theme-accent)] mt-1 block">
                  {targetWidth} x {targetHeight} px
                </span>
              </div>
              <div className="bg-[var(--theme-bg)]/80 border border-[var(--theme-card-border)] p-3 rounded-lg">
                <span className="text-[10px] font-mono font-bold tracking-wider text-[var(--theme-text-muted)] block uppercase">
                  ESTIMATION SIZE
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {estimateFileSize()}
                </span>
              </div>
            </div>
          </div>

          {/* Right panel: Resize adjustments settings */}
          <div className="lg:col-span-5 space-y-6">
            <div 
              style={{ borderRadius: 'var(--theme-border-radius)' }}
              className="bg-[var(--theme-card-bg)] border-2 border-[var(--theme-card-border)] p-6 space-y-6"
            >
              {/* Header Title */}
              <div className="border-b border-[var(--theme-card-border)] pb-3 flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-[var(--theme-text)] uppercase tracking-wider">// RESIZE ENGINE MODULES</span>
                <Sparkles className="w-4 h-4 text-[var(--theme-accent)]" />
              </div>

              {/* Exact Dimensions Inputs */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-[var(--theme-text)] uppercase tracking-wider block">
                  Resize Mode
                </span>
                
                {/* Mode Select Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLockAspectRatio(true);
                      if (originalHeight > 0) {
                        const ratio = originalWidth / originalHeight;
                        setAspectRatio(ratio);
                        setTargetHeight(Math.round(targetWidth / ratio));
                      }
                    }}
                    className={`text-[11px] font-mono font-bold uppercase py-2 border rounded-md text-center transition-all ${
                      lockAspectRatio 
                        ? 'bg-[var(--theme-accent)] border-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-sm'
                        : 'bg-[var(--theme-bg)] border-[var(--theme-card-border)] text-[var(--theme-text-muted)] hover:border-[var(--theme-text)]'
                    }`}
                  >
                    Lock Ratio
                  </button>
                  <button
                    type="button"
                    onClick={() => setLockAspectRatio(false)}
                    className={`text-[11px] font-mono font-bold uppercase py-2 border rounded-md text-center transition-all ${
                      !lockAspectRatio 
                        ? 'bg-[var(--theme-text)] border-[var(--theme-text)] text-[var(--theme-bg)] shadow-sm'
                        : 'bg-[var(--theme-bg)] border-[var(--theme-card-border)] text-[var(--theme-text-muted)] hover:border-[var(--theme-text)]'
                    }`}
                  >
                    Custom Size
                  </button>
                </div>

                <div className="border-t border-[var(--theme-card-border)] pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[var(--theme-text-muted)] uppercase tracking-wider">
                      Specify Custom Pixels (PX)
                    </label>
                    <span className="text-[10px] font-mono bg-[var(--theme-accent)]/10 text-[var(--theme-accent)] font-extrabold px-1.5 py-0.5 rounded uppercase">
                      {lockAspectRatio ? 'Ratio Locked' : 'True Custom PX unlocked'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono font-bold text-[var(--theme-text-muted)] uppercase tracking-wide">Width (PX)</span>
                      <input
                        type="number"
                        value={targetWidth || ''}
                        onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                        className="w-full bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-text)] px-3 py-2 text-sm rounded outline-none focus:border-[var(--theme-accent)] focus:ring-1 focus:ring-[var(--theme-accent)] font-semibold text-[var(--theme-text)]"
                        placeholder="Width PX"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono font-bold text-[var(--theme-text-muted)] uppercase tracking-wide">Height (PX)</span>
                      <input
                        type="number"
                        value={targetHeight || ''}
                        onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                        disabled={lockAspectRatio}
                        className="w-full bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-text)] px-3 py-2 text-sm rounded outline-none focus:border-[var(--theme-accent)] focus:ring-1 focus:ring-[var(--theme-accent)] font-semibold text-[var(--theme-text)] disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="Height PX"
                      />
                    </div>
                  </div>

                  {!lockAspectRatio && (
                    <p className="text-[10px] text-[var(--theme-accent)] font-medium leading-relaxed font-mono">
                      * You can enter completely custom values for both Width and Height (e.g., Width 500, Height 300). The image will be exported exactly to these exact pixel dimensions!
                    </p>
                  )}
                </div>
              </div>

              {/* Range Scale Percentages */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[var(--theme-text)] uppercase tracking-wider">Scale Percentage</span>
                  <span className="text-xs font-mono font-bold text-[var(--theme-accent)]">{percentage}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  value={percentage}
                  onChange={(e) => handlePercentageChange(parseInt(e.target.value))}
                  className="w-full h-1 bg-[var(--theme-card-border)] rounded-lg appearance-none cursor-pointer accent-[var(--theme-accent)]"
                />
                
                {/* Scale presets buttons */}
                <div className="flex flex-wrap gap-1.5 justify-between pt-1">
                  {[25, 50, 75, 100, 150, 200].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => handlePercentageChange(pct)}
                      className={`text-[9px] font-mono font-black border px-2 py-1 rounded transition-all ${
                        percentage === pct 
                          ? 'bg-[var(--theme-accent)] border-[var(--theme-accent)] text-[var(--theme-accent-text)]'
                          : 'bg-[var(--theme-bg)] border-[var(--theme-card-border)] text-[var(--theme-text-muted)] hover:border-[var(--theme-text)]'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Social Presets */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-[var(--theme-text)] uppercase tracking-wider block">Target Standard Presets</span>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map((p) => {
                    const isSelected = targetWidth === p.width && (lockAspectRatio || targetHeight === p.height);
                    return (
                      <button
                        key={p.name}
                        onClick={() => handlePresetSelect(p)}
                        className={`text-left p-2.5 border rounded-lg transition-all flex flex-col justify-between ${
                          isSelected 
                            ? 'bg-[var(--theme-accent)]/5 border-[var(--theme-accent)]' 
                            : 'bg-[var(--theme-bg)]/60 border-[var(--theme-card-border)] hover:border-[var(--theme-accent)]'
                        }`}
                      >
                        <span className="text-[10px] font-bold text-[var(--theme-text)] line-clamp-1">{p.name}</span>
                        <span className="text-[9px] font-mono text-[var(--theme-text-muted)] mt-1">{p.width} &times; {p.height} px</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Compression Quality & Format selector combo */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-[var(--theme-text)] uppercase tracking-wider block">Output Format Configurations</span>
                
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'PNG Lossless', val: 'image/png' },
                    { label: 'JPEG Lossy', val: 'image/jpeg' },
                    { label: 'WEBP Smart', val: 'image/webp' }
                  ].map((fmt) => (
                    <button
                      key={fmt.val}
                      onClick={() => setFormat(fmt.val)}
                      className={`text-[10px] font-mono font-bold uppercase py-2 border rounded-md text-center transition-all ${
                        format === fmt.val 
                          ? 'bg-[var(--theme-accent)] border-[var(--theme-accent)] text-[var(--theme-accent-text)]'
                          : 'bg-[var(--theme-bg)] border-[var(--theme-card-border)] text-[var(--theme-text-muted)] hover:border-[var(--theme-text)]'
                      }`}
                    >
                      {fmt.label.split(' ')[0]}
                    </button>
                  ))}
                </div>

                {format !== 'image/png' && (
                  <div className="space-y-2 pt-2 border-t border-[var(--theme-card-border)] border-dashed">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[var(--theme-text-muted)]">Image Quality:</span>
                      <span className="font-mono text-[var(--theme-accent)] font-bold">{quality}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={quality}
                      onChange={(e) => setQuality(parseInt(e.target.value))}
                      className="w-full h-1 bg-[var(--theme-card-border)] rounded-lg appearance-none cursor-pointer accent-[var(--theme-accent)]"
                    />
                  </div>
                )}
              </div>

              {/* Target File Size Settings */}
              <div className="space-y-4 border-t border-[var(--theme-card-border)] pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--theme-text)] uppercase tracking-wider block">
                    Target File Size Limit
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableSizeLimit}
                      onChange={(e) => setEnableSizeLimit(e.target.checked)}
                      className="rounded border-[var(--theme-card-border)] text-[var(--theme-accent)] focus:ring-[var(--theme-accent)] w-3.5 h-3.5"
                    />
                    <span className="text-[10px] font-mono font-bold text-[var(--theme-text-muted)] uppercase tracking-wider">
                      Enable Limit
                    </span>
                  </label>
                </div>

                {enableSizeLimit && (
                  <div className="space-y-3 bg-[var(--theme-bg)]/60 border border-[var(--theme-card-border)] p-3.5 rounded-lg animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="flex-grow space-y-1">
                        <span className="text-[9px] font-mono font-bold text-[var(--theme-text-muted)] uppercase tracking-wider block">Max Target Value</span>
                        <input
                          type="number"
                          min="1"
                          max={targetSizeUnit === 'MB' ? 100 : 20000}
                          value={targetSizeVal || ''}
                          onChange={(e) => setTargetSizeVal(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-text)] px-3 py-1.5 text-xs font-semibold rounded outline-none focus:border-[var(--theme-accent)] text-[var(--theme-text)]"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono font-bold text-[var(--theme-text-muted)] uppercase tracking-wider block">Unit</span>
                        <div className="flex border border-[var(--theme-card-border)] rounded-md overflow-hidden bg-[var(--theme-bg)]">
                          {(['KB', 'MB'] as const).map((unit) => (
                            <button
                              key={unit}
                              type="button"
                              onClick={() => {
                                setTargetSizeUnit(unit);
                                // Set interactive default values
                                setTargetSizeVal(unit === 'KB' ? 150 : 2);
                              }}
                              className={`px-3 py-1.5 text-[10px] font-mono font-bold transition-all ${
                                targetSizeUnit === unit
                                  ? 'bg-[var(--theme-accent)] text-[var(--theme-accent-text)]'
                                  : 'text-[var(--theme-text-muted)] hover:bg-[var(--theme-bg)]'
                              }`}
                            >
                              {unit}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <p className="text-[9px] font-medium text-[var(--theme-text-muted)] leading-relaxed">
                      💡 The export engine will adjust image compression quality parameters to ensure the output file stays strictly under <span className="font-bold text-[var(--theme-text)]">{targetSizeVal} {targetSizeUnit}</span> while maintaining your exact specified pixel dimensions. Note: Lossless PNG does not support compression quality reduction; please switch to JPEG/WEBP if the file exceeds your limit.
                    </p>
                  </div>
                )}
              </div>

              {/* Resize Actions buttons */}
              <div className="pt-2">
                <button
                  onClick={handleResizeAndDownload}
                  disabled={downloading || targetWidth <= 0 || targetHeight <= 0}
                  className="w-full bg-[var(--theme-text)] text-[var(--theme-bg)] hover:opacity-90 active:scale-[0.98] py-3.5 px-4 text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderRadius: 'calc(var(--theme-border-radius) / 1.5 || 8px)' }}
                >
                  {downloadSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500 animate-pulse" />
                      <span>RESIZED PIPELINE DOWNLOADED!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Resize and Download Image</span>
                    </>
                  )}
                </button>
                {downloadSuccess && (
                  <div className="mt-3.5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-left animate-fade-in space-y-1.5">
                    <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold tracking-wider uppercase">
                      ✓ DOWNLOAD STREAM PROCESSED SUCCESSFULLY
                    </p>
                    {finalProcessedInfo && (
                      <div className="text-[9px] font-mono text-[var(--theme-text)] space-y-0.5">
                        <div className="flex justify-between">
                          <span>Final Size Budget:</span>
                          <span className="font-bold">
                            {finalProcessedInfo.fileSizeBytes < 1024 * 1024
                              ? `${(finalProcessedInfo.fileSizeBytes / 1024).toFixed(1)} KB`
                              : `${(finalProcessedInfo.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Scale Dimensions:</span>
                          <span className="font-bold">{finalProcessedInfo.width} &times; {finalProcessedInfo.height} px</span>
                        </div>
                        {format !== 'image/png' && (
                          <div className="flex justify-between">
                            <span>Optimal Quality:</span>
                            <span className="font-bold text-[var(--theme-accent)]">{finalProcessedInfo.quality}%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      )}
    </div>
  );
}
