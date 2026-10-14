'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Database, Trash2, Calendar, HardDrive, Info, AlertCircle } from 'lucide-react';
import {
  LibraryFingerprintEntry,
  getLibraryEntries,
  deleteLibraryEntry,
  clearLibraryStore,
} from '@/lib/generator/db';
import { SIMILARITY_HONESTY_NOTE } from '@/config/similarity';
import { toast } from 'sonner';

interface LibraryManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLibraryChanged?: () => void;
}

function Thumbnail32({ data }: { data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length < 1024) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(32, 32);
    for (let i = 0; i < 1024; i++) {
      const g = data[i] ?? 128;
      const idx = i * 4;
      imgData.data[idx] = g;
      imgData.data[idx + 1] = g;
      imgData.data[idx + 2] = g;
      imgData.data[idx + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={32}
      className="w-10 h-10 rounded-lg border border-border/60 bg-black/40 shrink-0 [image-rendering:pixelated]"
    />
  );
}

export function LibraryManageDialog({
  open,
  onOpenChange,
  onLibraryChanged,
}: LibraryManageDialogProps) {
  const [entries, setEntries] = useState<LibraryFingerprintEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = await getLibraryEntries();
      // Sort newest first
      setEntries(data.sort((a, b) => b.exportedAt - a.exportedAt));
    } catch (e) {
      console.error('Failed to load library entries:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      let isMounted = true;
      getLibraryEntries()
        .then((data) => {
          if (isMounted) {
            setEntries(data.sort((a, b) => b.exportedAt - a.exportedAt));
          }
        })
        .catch((e) => console.error('Failed to load library entries:', e));

      return () => {
        isMounted = false;
      };
    }
  }, [open]);

  const handleDelete = async (id: string, filename: string) => {
    try {
      await deleteLibraryEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success(`Removed "${filename}" from library`);
      onLibraryChanged?.();
    } catch {
      toast.error('Failed to remove entry');
    }
  };

  const handleClear = async () => {
    try {
      await clearLibraryStore();
      setEntries([]);
      setConfirmClear(false);
      toast.success('Cleared exported images library');
      onLibraryChanged?.();
    } catch {
      toast.error('Failed to clear library');
    }
  };

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) setConfirmClear(false);
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Database className="h-5 w-5 text-primary" />
              <span>Exported Images Library</span>
            </DialogTitle>
            <span className="text-xs px-2.5 py-1 rounded-full bg-accent/40 font-mono text-muted-foreground">
              {entries.length} saved fingerprint{entries.length === 1 ? '' : 's'}
            </span>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            DOCTORx saves mathematical fingerprints (never full photos) of files you export. New uploads are checked against this library to prevent submitting near-identical files across different sessions.
          </DialogDescription>
        </DialogHeader>

        {/* Entries List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading library entries...
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <HardDrive className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-semibold text-foreground">Your library is empty</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                When &quot;Remember my exported images&quot; is enabled, each image exported in a CSV will be fingerprinted here.
              </p>
            </div>
          ) : (
            entries.map((entry) => {
              const dateStr = new Date(entry.exportedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-accent/20 border border-border/40 hover:border-border transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Thumbnail32 data={entry.thumbnail32 || entry.fingerprint?.thumbnail32} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {entry.filename}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Exported {dateStr}</span>
                        </span>
                        <span>
                          {entry.fingerprint?.quality?.width || 0}x{entry.fingerprint?.quality?.height || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(entry.id, entry.filename)}
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Remove from library"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Honesty Note & Footer */}
        <div className="p-4 border-t border-border/40 bg-accent/10 space-y-3">
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-orange-500/10 border border-primary/25 text-[11px] text-foreground/80">
            <Info className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
            <p className="leading-tight">{SIMILARITY_HONESTY_NOTE}</p>
          </div>

          <DialogFooter className="flex items-center justify-between w-full sm:justify-between">
            {entries.length > 0 && !confirmClear && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmClear(true)}
                className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              >
                Clear entire library
              </Button>
            )}

            {confirmClear && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive font-semibold flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Confirm clear?
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleClear}
                  className="text-xs h-7"
                >
                  Yes, clear all
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmClear(false)}
                  className="text-xs h-7"
                >
                  Cancel
                </Button>
              </div>
            )}

            <Button
              type="button"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs ml-auto"
            >
              Done
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
