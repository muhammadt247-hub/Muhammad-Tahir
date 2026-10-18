'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Upload, FileText, X, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Papa from 'papaparse';

export interface UploadedFileItem {
  id: string;
  filename: string;
  previewUrl: string;
  dataBase64?: string; // downscaled 1024px JPEG data
  file?: File;
}

interface UploadZoneProps {
  files: UploadedFileItem[];
  onAddFiles: (items: UploadedFileItem[]) => void;
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
  disabled?: boolean;
  hasSavedBatch?: boolean;
  onRestoreBatch?: () => void;
}

// Client-side image resize helper: downsamples to 1024px JPEG (quality 0.8) for Gemini
// and creates an optimized thumbnail object URL.
async function processImageFile(file: File): Promise<{ previewUrl: string; base64: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        // Compute scaled dimensions (max 1024px)
        const maxDim = 1024;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64Data = dataUrl.split(',')[1];
        const previewUrl = URL.createObjectURL(file);

        resolve({ previewUrl, base64: base64Data });
      };
      img.onerror = () => {
        const previewUrl = URL.createObjectURL(file);
        resolve({ previewUrl, base64: '' });
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      const previewUrl = URL.createObjectURL(file);
      resolve({ previewUrl, base64: '' });
    };
    reader.readAsDataURL(file);
  });
}

export function UploadZone({
  files,
  onAddFiles,
  onRemoveFile,
  onClearAll,
  disabled = false,
  hasSavedBatch = false,
  onRestoreBatch,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRawFiles = useCallback(async (fileList: File[]) => {
    if (disabled) return;
    setProcessing(true);

    const remainingSlots = 200 - files.length;
    if (remainingSlots <= 0) {
      toast.error('Maximum batch limit of 200 files reached');
      setProcessing(false);
      return;
    }

    const targetFiles = fileList.slice(0, remainingSlots);
    const newItems: UploadedFileItem[] = [];

    for (let i = 0; i < targetFiles.length; i++) {
      const file = targetFiles[i];

      // Check if file is a CSV of filenames
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true });
        const rows = (parsed.data as Record<string, string>[]).filter(Boolean);

        for (const row of rows) {
          const filename = row['Filename'] || row['File name'] || row['filename'] || Object.values(row)[0];
          if (filename && newItems.length + files.length < 200) {
            newItems.push({
              id: 'csv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              filename: String(filename).trim(),
              previewUrl: '',
            });
          }
        }
        continue;
      }

      // If image file
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const { previewUrl, base64 } = await processImageFile(file);
        newItems.push({
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + i,
          filename: file.name,
          previewUrl,
          dataBase64: base64,
          file,
        });
      }
    }

    if (newItems.length > 0) {
      onAddFiles(newItems);
      toast.success(`Added ${newItems.length} assets to batch`);
    }

    if (fileList.length > remainingSlots) {
      toast.info(`Capped at 200 files. Skipped ${fileList.length - remainingSlots} files.`);
    }

    setProcessing(false);
  }, [disabled, files.length, onAddFiles]);

  // Paste from clipboard support
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        handleRawFiles(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled, handleRawFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      await handleRawFiles(droppedFiles);
    }
  };

  return (
    <div className="space-y-4">
      {/* Restore Last Batch Banner if available */}
      {hasSavedBatch && onRestoreBatch && files.length === 0 && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 text-primary text-xs">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span>A previous batch progress was saved in this browser.</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onRestoreBatch}
            className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
          >
            Restore Last Batch
          </Button>
        </div>
      )}

      {/* Main Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        data-no-pop
        className={`dropzone-static relative flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl border-2 border-dashed transition-colors cursor-pointer overflow-hidden ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border/60 bg-card/40 hover:border-border hover:bg-card/70'
        } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/*,.csv"
          onChange={(e) => {
            if (e.target.files) {
              handleRawFiles(Array.from(e.target.files));
              e.target.value = '';
            }
          }}
          className="hidden"
          data-no-pop
        />

        <div data-no-pop className="w-14 h-14 rounded-2xl bg-foreground text-background flex items-center justify-center shadow-md shadow-foreground/10 mb-4">
          {processing ? (
            <RefreshCw className="h-6 w-6 animate-spin text-background" />
          ) : (
            <Upload className="h-6 w-6 text-background" />
          )}
        </div>

        <div className="space-y-1 text-center">
          <p className="text-base sm:text-lg font-bold text-foreground">
            {processing ? 'Downscaling and preparing files...' : 'Drag & drop image files or click to browse'}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md">
            Accepts JPG, PNG, WEBP, video thumbnails, or existing CSV of filenames.
            Supports batch queue up to <strong className="text-foreground">200 files</strong>.
          </p>
          <p className="text-[11px] text-muted-foreground pt-1">
            Tip: You can also press <kbd className="px-1.5 py-0.5 rounded border border-border/50 bg-muted text-[10px]">Ctrl+V</kbd> / <kbd className="px-1.5 py-0.5 rounded border border-border/50 bg-muted text-[10px]">Cmd+V</kbd> anywhere to paste images.
          </p>
        </div>
      </div>

      {/* Batch Preview Toolbar & Counter */}
      {files.length > 0 && (
        <div className="flex items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">
              {files.length} / 200 files in batch
            </span>
            {files.length >= 200 && (
              <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Max batch size
              </span>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            disabled={disabled}
            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2.5"
          >
            Clear all files
          </Button>
        </div>
      )}

      {/* Compact Files Grid Preview (First 24 shown with overflow) */}
      {files.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl border border-border/40 bg-background/50">
          {files.map((file) => (
            <div
              key={file.id}
              className="group relative aspect-square rounded-lg overflow-hidden border border-border/50 bg-muted/40"
              title={file.filename}
            >
              {file.previewUrl ? (
                <Image
                  src={file.previewUrl}
                  alt={file.filename}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground p-1 text-center">
                  <FileText className="h-4 w-4" />
                </div>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile(file.id);
                }}
                disabled={disabled}
                className="absolute top-1 right-1 h-4 w-4 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
