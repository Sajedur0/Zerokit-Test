/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument, degrees, PageSizes, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Plus,
  RotateCw,
  Split,
  Layers,
  Eye,
  CheckSquare,
  Square,
  RefreshCw,
  AlertCircle,
  FilePlus,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  X,
  Copy,
  ArrowUp,
  ArrowDown,
  Check,
  FileCheck
} from 'lucide-react';

// Configure PDF.js worker (bundled locally so the tool works fully offline)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export interface PdfPageItem {
  id: string;
  docId: string;
  docName: string;
  originalPageIndex: number; // 0-based index in source PDF (or -1 if added image/blank)
  thumbnailUrl: string;
  rotation: number; // 0, 90, 180, 270
  selected: boolean;
  type: 'pdf-page' | 'image' | 'blank';
  imageDataUrl?: string;
  sourceFile?: File;
  sourceArrayBuffer?: ArrayBuffer;
}

export interface SourceDocument {
  id: string;
  name: string;
  file: File;
  arrayBuffer: ArrayBuffer;
  pageCount: number;
}

export default function PdfTool() {
  const [sourceDocs, setSourceDocs] = useState<SourceDocument[]>([]);
  const [pages, setPages] = useState<PdfPageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Preview modal state
  const [previewPageIndex, setPreviewPageIndex] = useState<number | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);

  // Drag and drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggedPageIndex, setDraggedPageIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Auto hide alerts after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Render a PDF page to data URL thumbnail using PDF.js
  const renderPdfPageThumbnail = async (
    pdfjsDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number // 1-based
  ): Promise<string> => {
    try {
      const page = await pdfjsDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.35 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas context unavailable');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      }).promise;

      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (err) {
      console.warn(`Thumbnail rendering failed for page ${pageNumber}`, err);
      // Fallback SVG thumbnail
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="200" viewBox="0 0 150 200"><rect width="100%" height="100%" fill="%23f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%2364748b">Page ${pageNumber}</text></svg>`;
    }
  };

  // Process uploaded PDF files
  const MAX_PDF_BYTES = 60 * 1024 * 1024; // 60 MB client-side safety cap

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const processFiles = async (files: File[], isAppending = false) => {
    const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      setErrorMessage('Please select valid PDF files (.pdf)');
      return;
    }

    const oversized = pdfFiles.find(f => f.size > MAX_PDF_BYTES);
    if (oversized) {
      setErrorMessage(
        `${oversized.name} is ${formatBytes(oversized.size)} — over the ${formatBytes(MAX_PDF_BYTES)} in-browser limit. ` +
        `Split the PDF into smaller files first to avoid freezing the tab.`
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setLoadingMessage('Loading PDF documents...');

    try {
      const newSourceDocs: SourceDocument[] = [];
      const newPages: PdfPageItem[] = [];

      for (let fIdx = 0; fIdx < pdfFiles.length; fIdx++) {
        const file = pdfFiles[fIdx];
        setLoadingMessage(`Reading ${file.name} (${fIdx + 1}/${pdfFiles.length})...`);
        
        const arrayBuffer = await file.arrayBuffer();
        const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        // Load with PDF.js for rendering
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
        const pdfjsDoc = await loadingTask.promise;
        const pageCount = pdfjsDoc.numPages;

        newSourceDocs.push({
          id: docId,
          name: file.name,
          file,
          arrayBuffer,
          pageCount
        });

        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
          setLoadingMessage(`Generating thumbnail ${pageNum}/${pageCount} for ${file.name}...`);
          const thumbnailUrl = await renderPdfPageThumbnail(pdfjsDoc, pageNum);

          newPages.push({
            id: `page_${docId}_${pageNum}_${Math.random().toString(36).substring(2, 6)}`,
            docId,
            docName: file.name,
            originalPageIndex: pageNum - 1, // 0-based
            thumbnailUrl,
            rotation: 0,
            selected: false,
            type: 'pdf-page',
            sourceArrayBuffer: arrayBuffer
          });
        }
      }

      if (isAppending) {
        setSourceDocs(prev => [...prev, ...newSourceDocs]);
        setPages(prev => [...prev, ...newPages]);
        setSuccessMessage(`Added ${newPages.length} pages from ${pdfFiles.length} file(s)`);
      } else {
        setSourceDocs(newSourceDocs);
        setPages(newPages);
        setSuccessMessage(`Loaded ${newPages.length} pages from ${pdfFiles.length} PDF file(s)`);
      }
    } catch (err: unknown) {
      console.error('Error reading PDF files:', err);
      const msg = err instanceof Error ? err.message : 'Failed to parse PDF file. Ensure it is not corrupted or password protected.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files) as File[], false);
    }
  };

  const handleAppendFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files) as File[], true);
    }
  };

  // Add Image as a new PDF Page
  const handleImageAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files) as File[];
    const imageFiles = fileList.filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      setErrorMessage('Please select valid image files (PNG, JPG, WebP)');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Converting images to PDF pages...');

    try {
      const newPages: PdfPageItem[] = [];

      for (const imageFile of imageFiles) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });

        const docId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        newPages.push({
          id: `page_${docId}_${Math.random().toString(36).substring(2, 6)}`,
          docId,
          docName: imageFile.name,
          originalPageIndex: -1,
          thumbnailUrl: dataUrl,
          imageDataUrl: dataUrl,
          sourceFile: imageFile,
          rotation: 0,
          selected: false,
          type: 'image'
        });
      }

      setPages(prev => [...prev, ...newPages]);
      setSuccessMessage(`Added ${newPages.length} image page(s)`);
    } catch (err: unknown) {
      setErrorMessage('Failed to process image file');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  // Add Blank Page
  const handleAddBlankPage = () => {
    // Generate simple blank page SVG data URL
    const blankSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="200" viewBox="0 0 150 200"><rect width="100%" height="100%" fill="%23ffffff" stroke="%23e2e8f0" stroke-width="2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%2394a3b8">Blank Page</text></svg>`;
    const docId = `blank_${Date.now()}`;

    const newPage: PdfPageItem = {
      id: `page_${docId}_${Math.random().toString(36).substring(2, 6)}`,
      docId,
      docName: 'Blank Page',
      originalPageIndex: -1,
      thumbnailUrl: blankSvg,
      rotation: 0,
      selected: false,
      type: 'blank'
    };

    setPages(prev => [...prev, newPage]);
    setSuccessMessage('Blank page added');
  };

  // Page Selection Toggle
  const togglePageSelect = (pageId: string) => {
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, selected: !p.selected } : p));
  };

  const selectAllPages = () => {
    const allSelected = pages.every(p => p.selected);
    setPages(prev => prev.map(p => ({ ...p, selected: !allSelected })));
  };

  // Page Actions
  const rotatePage = (pageId: string, deltaDegrees: number) => {
    setPages(prev => prev.map(p => {
      if (p.id === pageId) {
        const newRot = (p.rotation + deltaDegrees + 360) % 360;
        return { ...p, rotation: newRot };
      }
      return p;
    }));
  };

  const rotateAllSelected = (deltaDegrees: number) => {
    setPages(prev => prev.map(p => {
      if (p.selected) {
        const newRot = (p.rotation + deltaDegrees + 360) % 360;
        return { ...p, rotation: newRot };
      }
      return p;
    }));
  };

  const deletePage = (pageId: string) => {
    setPages(prev => prev.filter(p => p.id !== pageId));
    setSuccessMessage('Page deleted');
  };

  const deleteSelectedPages = () => {
    const selectedCount = pages.filter(p => p.selected).length;
    if (selectedCount === 0) {
      setErrorMessage('No pages selected to delete');
      return;
    }
    setPages(prev => prev.filter(p => !p.selected));
    setSuccessMessage(`Deleted ${selectedCount} selected page(s)`);
  };

  const movePage = (currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    setPages(prev => {
      const copy = [...prev];
      const temp = copy[currentIndex];
      copy[currentIndex] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const duplicatePage = (pageItem: PdfPageItem, index: number) => {
    const duplicated: PdfPageItem = {
      ...pageItem,
      id: `page_${pageItem.docId}_dup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      selected: false
    };

    setPages(prev => {
      const copy = [...prev];
      copy.splice(index + 1, 0, duplicated);
      return copy;
    });
    setSuccessMessage('Page duplicated');
  };

  // Drag & drop reordering
  const handleDragStart = (index: number) => {
    setDraggedPageIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedPageIndex === null || draggedPageIndex === index) return;

    setPages(prev => {
      const copy = [...prev];
      const item = copy.splice(draggedPageIndex, 1)[0];
      copy.splice(index, 0, item);
      return copy;
    });
    setDraggedPageIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedPageIndex(null);
  };

  // Build and export modified PDF document
  const compilePdfDocument = async (pagesToExport: PdfPageItem[]): Promise<Uint8Array> => {
    const outputPdf = await PDFDocument.create();
    
    // Cache PDFDocument instances for source ArrayBuffers to avoid re-parsing
    const sourceDocCache = new Map<ArrayBuffer, PDFDocument>();

    for (const pageItem of pagesToExport) {
      if (pageItem.type === 'pdf-page' && pageItem.sourceArrayBuffer) {
        let srcPdfDoc = sourceDocCache.get(pageItem.sourceArrayBuffer);
        if (!srcPdfDoc) {
          srcPdfDoc = await PDFDocument.load(pageItem.sourceArrayBuffer);
          sourceDocCache.set(pageItem.sourceArrayBuffer, srcPdfDoc);
        }

        const [copiedPage] = await outputPdf.copyPages(srcPdfDoc, [pageItem.originalPageIndex]);
        if (pageItem.rotation !== 0) {
          copiedPage.setRotation(degrees((copiedPage.getRotation().angle + pageItem.rotation) % 360));
        }
        outputPdf.addPage(copiedPage);

      } else if (pageItem.type === 'image' && pageItem.imageDataUrl) {
        const imageBytes = await fetch(pageItem.imageDataUrl).then(res => res.arrayBuffer());
        let embeddedImage;

        if (pageItem.sourceFile?.type === 'image/png' || pageItem.imageDataUrl.startsWith('data:image/png')) {
          embeddedImage = await outputPdf.embedPng(imageBytes);
        } else {
          // Default JPG
          embeddedImage = await outputPdf.embedJpg(imageBytes);
        }

        const { width, height } = embeddedImage;
        // Standard A4 dimensions or image dimensions
        const page = outputPdf.addPage([width, height]);
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width,
          height,
        });
        if (pageItem.rotation !== 0) {
          page.setRotation(degrees(pageItem.rotation));
        }

      } else if (pageItem.type === 'blank') {
        const page = outputPdf.addPage(PageSizes.A4);
        if (pageItem.rotation !== 0) {
          page.setRotation(degrees(pageItem.rotation));
        }
      }
    }

    return await outputPdf.save();
  };

  // Download export helper
  const triggerDownload = (uint8Array: Uint8Array, filename: string) => {
    const blob = new Blob([uint8Array], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Combined Document (Merge / Reordered result)
  const handleExportFullPdf = async () => {
    if (pages.length === 0) {
      setErrorMessage('No pages to export');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Compiling final PDF document...');

    try {
      const pdfBytes = await compilePdfDocument(pages);
      const filename = sourceDocs.length === 1 
        ? `edited_${sourceDocs[0].name}`
        : `merged_document_${Date.now()}.pdf`;

      triggerDownload(pdfBytes, filename);
      setSuccessMessage('PDF exported successfully!');
    } catch (err: unknown) {
      console.error('Export failed:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMessage('Failed to generate PDF document: ' + msg);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Split: Export Selected Pages as a separate PDF
  const handleExportSelectedPdf = async () => {
    const selectedPages = pages.filter(p => p.selected);
    if (selectedPages.length === 0) {
      setErrorMessage('Please select pages to split/extract into a new PDF');
      return;
    }

    setIsLoading(true);
    setLoadingMessage(`Extracting ${selectedPages.length} selected page(s)...`);

    try {
      const pdfBytes = await compilePdfDocument(selectedPages);
      triggerDownload(pdfBytes, `extracted_pages_${Date.now()}.pdf`);
      setSuccessMessage(`Extracted ${selectedPages.length} page(s) into a new PDF!`);
    } catch (err: unknown) {
      console.error('Split export failed:', err);
      setErrorMessage('Failed to extract selected pages');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Split All Pages into Individual PDFs
  const handleSplitAllIndividual = async () => {
    if (pages.length === 0) return;

    setIsLoading(true);
    setLoadingMessage(`Splitting PDF into ${pages.length} individual files...`);

    try {
      for (let i = 0; i < pages.length; i++) {
        setLoadingMessage(`Exporting page ${i + 1} of ${pages.length}...`);
        const pdfBytes = await compilePdfDocument([pages[i]]);
        triggerDownload(pdfBytes, `page_${i + 1}_${pages[i].docName}`);
        // Brief pause to prevent browser blocking downloads
        await new Promise(r => setTimeout(r, 200));
      }
      setSuccessMessage(`Split ${pages.length} pages into individual PDF files!`);
    } catch (err: unknown) {
      setErrorMessage('Failed to split all pages');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Dropzone drag & drop handlers for main area
  const handleMainDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleMainDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleMainDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files) as File[], pages.length > 0);
    }
  };

  const resetAll = () => {
    setPages([]);
    setSourceDocs([]);
    setErrorMessage(null);
    setSuccessMessage('Workspace cleared');
  };

  const selectedCount = pages.filter(p => p.selected).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={appendFileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        onChange={handleAppendFileChange}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        multiple
        onChange={handleImageAdd}
        className="hidden"
      />

      {/* Main Header / Tool Title */}
      <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--theme-text)] tracking-tight">
                PDF Tools & Editor
              </h2>
              <p className="text-xs text-[var(--theme-text-muted)] mt-0.5">
                Merge multiple PDFs, split pages, delete/add pages, reorder, and preview live in real time offline.
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar Actions when pages exist */}
        {pages.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              onClick={() => appendFileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] rounded-xl text-xs font-bold text-[var(--theme-text)] transition-all"
              title="Add another PDF file to merge"
            >
              <FilePlus className="w-4 h-4 text-emerald-600" />
              <span>Add PDF File</span>
            </button>

            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] rounded-xl text-xs font-bold text-[var(--theme-text)] transition-all"
              title="Add image as PDF page"
            >
              <ImageIcon className="w-4 h-4 text-sky-600" />
              <span>Add Image</span>
            </button>

            <button
              onClick={handleAddBlankPage}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] rounded-xl text-xs font-bold text-[var(--theme-text)] transition-all"
              title="Add blank A4 page"
            >
              <Plus className="w-4 h-4 text-violet-600" />
              <span>Add Blank Page</span>
            </button>

            <button
              onClick={resetAll}
              className="px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl text-xs font-bold transition-all"
              title="Clear workspace"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-bold text-red-800 hover:opacity-80">✕</button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold text-emerald-900 hover:opacity-80">✕</button>
        </div>
      )}

      {/* Main Workspace: Either Dropzone or Page Live Preview Grid */}
      {pages.length === 0 ? (
        /* Dropzone view */
        <div
          onDragOver={handleMainDragOver}
          onDragLeave={handleMainDragLeave}
          onDrop={handleMainDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-12 sm:p-16 text-center cursor-pointer transition-all duration-300 ${
            isDraggingOver
              ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/5 scale-[1.01]'
              : 'border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] bg-[var(--theme-card-bg)]'
          }`}
        >
          <div className="max-w-md mx-auto space-y-4 pointer-events-none">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center mx-auto shadow-sm">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[var(--theme-text)]">
                Upload PDF File(s)
              </h3>
              <p className="text-xs text-[var(--theme-text-muted)] mt-1 leading-relaxed">
                Drag & drop single or multiple PDF files here, or click to browse.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2 text-[10px] font-mono text-[var(--theme-text-muted)] uppercase tracking-wider">
              <span className="px-2.5 py-1 rounded-md bg-[var(--theme-bg)] border border-[var(--theme-card-border)]">
                100% Offline
              </span>
              <span className="px-2.5 py-1 rounded-md bg-[var(--theme-bg)] border border-[var(--theme-card-border)]">
                Live Preview
              </span>
              <span className="px-2.5 py-1 rounded-md bg-[var(--theme-bg)] border border-[var(--theme-card-border)]">
                Split & Merge
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Interactive Grid and Editor View */
        <div className="space-y-6">
          
          {/* Action & Filter Bar for Pages */}
          <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
            
            {/* Selection & Count Stats */}
            <div className="flex items-center gap-3">
              <button
                onClick={selectAllPages}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--theme-card-border)] bg-[var(--theme-bg)] text-[var(--theme-text)] hover:border-[var(--theme-accent)] transition-all font-bold"
              >
                {pages.every(p => p.selected) ? (
                  <>
                    <CheckSquare className="w-4 h-4 text-[var(--theme-accent)]" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 text-[var(--theme-text-muted)]" />
                    <span>Select All</span>
                  </>
                )}
              </button>

              <div className="text-[var(--theme-text-muted)]">
                Total: <span className="font-bold text-[var(--theme-text)]">{pages.length}</span> page(s)
                {selectedCount > 0 && (
                  <span className="ml-2 font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    {selectedCount} selected
                  </span>
                )}
              </div>
            </div>

            {/* Selected Page Batch Operations */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => rotateAllSelected(90)}
                disabled={selectedCount === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--theme-card-border)] bg-[var(--theme-bg)] text-[var(--theme-text)] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--theme-accent)] transition-all font-bold"
                title="Rotate selected pages 90°"
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-600" />
                <span>Rotate Selected</span>
              </button>

              <button
                onClick={deleteSelectedPages}
                disabled={selectedCount === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-100 transition-all font-bold"
                title="Delete selected pages"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedCount})</span>
              </button>

              <button
                onClick={handleExportSelectedPdf}
                disabled={selectedCount === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-all font-bold shadow-sm"
                title="Export selected pages into a new PDF file"
              >
                <Split className="w-3.5 h-3.5" />
                <span>Extract Selected to PDF</span>
              </button>
            </div>
          </div>

          {/* Page Grid Live View */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {pages.map((page, idx) => (
              <div
                key={page.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`group relative bg-[var(--theme-card-bg)] border-2 rounded-2xl p-3 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md ${
                  page.selected
                    ? 'border-blue-500 bg-blue-50/20 ring-2 ring-blue-500/20'
                    : 'border-[var(--theme-card-border)] hover:border-[var(--theme-accent)]'
                }`}
              >
                {/* Top Badge bar */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => togglePageSelect(page.id)}
                      className="p-1 rounded-md text-[var(--theme-text-muted)] hover:text-blue-600 transition-colors"
                      title="Toggle select page"
                    >
                      {page.selected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <span className="font-mono text-[11px] font-extrabold text-[var(--theme-text)]">
                      #{idx + 1}
                    </span>
                  </div>

                  {/* Move Up/Down Controls */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => movePage(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-[var(--theme-bg)] text-[var(--theme-text-muted)] disabled:opacity-30"
                      title="Move Left/Up"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => movePage(idx, 'down')}
                      disabled={idx === pages.length - 1}
                      className="p-1 rounded hover:bg-[var(--theme-bg)] text-[var(--theme-text-muted)] disabled:opacity-30"
                      title="Move Right/Down"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Thumbnail Preview Image with rotation */}
                <div
                  onClick={() => setPreviewPageIndex(idx)}
                  className="relative aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer border border-slate-200/80 group-hover:border-slate-300 transition-all my-1"
                >
                  <img
                    src={page.thumbnailUrl}
                    alt={`Page ${idx + 1}`}
                    style={{ transform: `rotate(${page.rotation}deg)` }}
                    className="max-h-full max-w-full object-contain transition-transform duration-300 shadow-sm"
                  />

                  {/* Zoom Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1 backdrop-blur-[1px]">
                    <ZoomIn className="w-4 h-4" />
                    <span>Preview</span>
                  </div>

                  {/* Rotation Indicator */}
                  {page.rotation > 0 && (
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white font-mono text-[9px] px-1.5 py-0.5 rounded">
                      {page.rotation}°
                    </span>
                  )}
                </div>

                {/* Footer Info & Single Page Quick Controls */}
                <div className="mt-2 space-y-1.5">
                  <div className="text-[10px] font-mono text-[var(--theme-text-muted)] truncate" title={page.docName}>
                    {page.docName}
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-[var(--theme-card-border)]">
                    <button
                      onClick={() => rotatePage(page.id, 90)}
                      className="p-1 rounded hover:bg-[var(--theme-bg)] text-[var(--theme-text-muted)] hover:text-amber-600 transition-colors"
                      title="Rotate 90° clockwise"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => duplicatePage(page, idx)}
                      className="p-1 rounded hover:bg-[var(--theme-bg)] text-[var(--theme-text-muted)] hover:text-blue-600 transition-colors"
                      title="Duplicate page"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => deletePage(page.id)}
                      className="p-1 rounded hover:bg-red-50 text-[var(--theme-text-muted)] hover:text-red-600 transition-colors"
                      title="Delete page"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Download & Save Section Bar */}
          <div className="bg-[var(--theme-card-bg)] border-2 border-[var(--theme-accent)] rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <h3 className="text-base font-extrabold text-[var(--theme-text)] flex items-center gap-2 justify-center md:justify-start">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <span>Ready to Download PDF</span>
              </h3>
              <p className="text-xs text-[var(--theme-text-muted)]">
                Compiled document contains <span className="font-bold text-[var(--theme-text)]">{pages.length} pages</span> in current order.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleSplitAllIndividual}
                className="px-4 py-2.5 bg-[var(--theme-bg)] border border-[var(--theme-card-border)] hover:border-[var(--theme-accent)] text-[var(--theme-text)] rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                title="Download every single page as an individual PDF"
              >
                <Split className="w-4 h-4 text-violet-600" />
                <span>Split All Pages to Individual PDFs</span>
              </button>

              <button
                onClick={handleExportFullPdf}
                disabled={isLoading}
                className="px-6 py-2.5 bg-[var(--theme-accent)] text-[var(--theme-accent-text)] rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm hover:opacity-95 active:scale-95 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Save & Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--theme-card-bg)] border border-[var(--theme-card-border)] rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl animate-fade-in">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mx-auto" />
            <div>
              <h4 className="text-base font-extrabold text-[var(--theme-text)]">
                Processing PDF...
              </h4>
              <p className="text-xs text-[var(--theme-text-muted)] mt-1 font-mono">
                {loadingMessage || 'Please wait standard rendering in progress...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* High-Res Page Preview Modal */}
      {previewPageIndex !== null && pages[previewPageIndex] && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-between p-4 sm:p-6 animate-fade-in">
          
          {/* Top Modal Navigation Header */}
          <div className="w-full max-w-4xl flex items-center justify-between text-white font-mono text-xs border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <span className="font-extrabold text-sm">
                Page {previewPageIndex + 1} of {pages.length}
              </span>
              <span className="text-slate-400 text-xs hidden sm:inline">
                ({pages[previewPageIndex].docName})
              </span>
            </div>

            {/* Zoom & Close */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.25))}
                  className="px-2 py-1 hover:bg-white/20 rounded font-bold"
                  title="Zoom Out"
                >
                  -
                </button>
                <span className="px-2 font-mono font-bold">{Math.round(previewZoom * 100)}%</span>
                <button
                  onClick={() => setPreviewZoom(z => Math.min(2.5, z + 0.25))}
                  className="px-2 py-1 hover:bg-white/20 rounded font-bold"
                  title="Zoom In"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => setPreviewPageIndex(null)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center High Res Rendered Page Container */}
          <div className="flex-1 w-full max-w-4xl flex items-center justify-center my-4 overflow-auto">
            <div
              style={{ transform: `scale(${previewZoom})` }}
              className="transition-transform duration-200 max-h-[80vh] flex items-center justify-center shadow-2xl rounded-lg bg-white p-2"
            >
              <img
                src={pages[previewPageIndex].thumbnailUrl}
                alt={`Preview Page ${previewPageIndex + 1}`}
                style={{ transform: `rotate(${pages[previewPageIndex].rotation}deg)` }}
                className="max-h-[75vh] object-contain rounded transition-transform"
              />
            </div>
          </div>

          {/* Bottom Prev/Next Controls */}
          <div className="w-full max-w-4xl flex items-center justify-between text-white font-mono text-xs border-t border-white/10 pt-3">
            <button
              onClick={() => setPreviewPageIndex(idx => idx! > 0 ? idx! - 1 : pages.length - 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 font-bold transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Page</span>
            </button>

            <button
              onClick={() => rotatePage(pages[previewPageIndex].id, 90)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-bold transition-all"
            >
              <RotateCw className="w-4 h-4" />
              <span>Rotate 90°</span>
            </button>

            <button
              onClick={() => setPreviewPageIndex(idx => idx! < pages.length - 1 ? idx! + 1 : 0)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 font-bold transition-all"
            >
              <span>Next Page</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
