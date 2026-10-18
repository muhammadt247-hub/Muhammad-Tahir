'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, Video, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  currentCount: number;
  maxFiles?: number;
  disabled?: boolean;
}

export function DropZone({
  onFilesSelected,
  currentCount,
  maxFiles = 1000,
  disabled = false,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndFilterFiles = useCallback((fileList: FileList | File[]): File[] => {
    const rawFiles = Array.from(fileList);
    const valid: File[] = [];

    for (const f of rawFiles) {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      if (ext === '.eps' || ext === '.ai') {
        toast.error('EPS/AI is not supported. Export a JPG or PNG preview first.');
        continue;
      }

      const isAcceptedImage =
        f.type.startsWith('image/') ||
        /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f.name);
      const isAcceptedVideo =
        f.type.startsWith('video/') ||
        /\.(mp4|mov|webm)$/i.test(f.name);

      if (isAcceptedImage || isAcceptedVideo) {
        valid.push(f);
      } else {
        toast.error(`Unsupported file type: ${f.name}`);
      }
    }

    if (currentCount + valid.length > maxFiles) {
      const allowed = Math.max(0, maxFiles - currentCount);
      toast.warning(`Maximum limit is ${maxFiles} files. Adding only ${allowed} file(s).`);
      return valid.slice(0, allowed);
    }

    return valid;
  }, [currentCount, maxFiles]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const filtered = validateAndFilterFiles(e.dataTransfer.files);
      if (filtered.length > 0) {
        onFilesSelected(filtered);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filtered = validateAndFilterFiles(e.target.files);
      if (filtered.length > 0) {
        onFilesSelected(filtered);
      }
      e.target.value = '';
    }
  };

  // Clipboard paste support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }

      if (pastedFiles.length > 0) {
        const filtered = validateAndFilterFiles(pastedFiles);
        if (filtered.length > 0) {
          onFilesSelected(filtered);
          toast.success(`Pasted ${filtered.length} image(s) from clipboard`);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled, onFilesSelected, validateAndFilterFiles]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      data-no-pop
      className={cn(
        'dropzone-static rounded-2xl border-2 border-dashed border-border/60 bg-accent/20 min-h-[200px] flex flex-col items-center justify-center p-6 text-center transition-colors select-none overflow-hidden',
        isDragOver && 'border-primary bg-primary/5',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled}
        data-no-pop
      />

      <div data-no-pop className="w-14 h-14 rounded-2xl bg-card shadow-sm flex items-center justify-center text-primary mb-3">
        <UploadCloud className="h-7 w-7" />
      </div>

      <div data-no-pop className="flex items-center gap-1.5 mb-3">
        <span data-no-pop className="rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-2 py-1 flex items-center gap-1">
          <ImageIcon className="h-2.5 w-2.5" /> Images
        </span>
        <span data-no-pop className="rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-2 py-1 flex items-center gap-1">
          <Video className="h-2.5 w-2.5" /> Videos
        </span>
        <span data-no-pop className="rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-2 py-1 flex items-center gap-1">
          <FileCode className="h-2.5 w-2.5" /> SVG
        </span>
      </div>

      <p data-no-pop className="text-sm text-foreground">
        Drag &amp; drop files here, or{' '}
        <button
          type="button"
          data-no-pop
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="underline font-semibold text-primary hover:opacity-80 transition-opacity focus:outline-none"
        >
          browse
        </button>
      </p>

      <p data-no-pop className="text-[11px] text-muted-foreground mt-1">
        Supports image, video &amp; SVG · Large batch ready (up to {maxFiles} files)
      </p>
    </div>
  );
}
