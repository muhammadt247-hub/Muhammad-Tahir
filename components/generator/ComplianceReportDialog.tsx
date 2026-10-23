'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PreExportReport } from '@/lib/compliance/report';
import { GeneratorItemState } from '@/lib/generator/queue';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  UserCheck,
  Layers,
  ArrowRight,
  Maximize2,
  Wand2,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComplianceReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: PreExportReport;
  items: GeneratorItemState[];
  activeMinSizeCheck: 'exclude' | 'warn' | 'off';
  onProceedExport: (options: { includeSimilar: boolean; includeBlocked: boolean; includeOver45Mb: boolean }) => void;
  onFixTitle: (itemId: string, term?: string) => void;
  onApproveAmbiguous: (itemId: string, term: string) => void;
  onFixSimilarTitles?: () => void;
  onIncludeAnyway: (itemId: string) => void;
}

export function countExportableItems(
  items: GeneratorItemState[],
  options: { includeSimilar: boolean; includeBlocked: boolean; includeOver45Mb: boolean },
  activeMinSizeCheck: 'exclude' | 'warn' | 'off'
): number {
  return items.filter((i) => {
    if (i.status !== 'done') return false;
    if (i.manualInclude) return true;

    const hasBlocked = i.blockedTermsFound?.some((b) => !b.isAmbiguous);
    const hasSimilar = i.similarTo && i.similarTo.length > 0;
    const isOver45 = (i.fileData.originalSize || 0) > 45 * 1024 * 1024;

    if (hasBlocked && !options.includeBlocked) return false;
    if (hasSimilar && !options.includeSimilar) return false;
    if (isOver45 && !options.includeOver45Mb) return false;

    const isVector = i.isVector || i.fileData?.isVector;
    const isVideo = i.isVideo || i.fileData?.isVideo;
    const mp = (i.fileData.width && i.fileData.height) ? (i.fileData.width * i.fileData.height) / 1_000_000 : 0;
    if (!isVector && !isVideo && activeMinSizeCheck === 'exclude' && mp < 4.0 && !i.manualInclude) {
      return false;
    }

    if (i.isExcluded && !i.excludedReason?.includes('4 MP')) {
      if (hasBlocked && !options.includeBlocked) return false;
      if (hasSimilar && !options.includeSimilar) return false;
    }

    return true;
  }).length;
}

export function ComplianceReportDialog({
  open,
  onOpenChange,
  report,
  items,
  activeMinSizeCheck,
  onProceedExport,
  onFixTitle,
  onApproveAmbiguous,
  onFixSimilarTitles,
  onIncludeAnyway,
}: ComplianceReportDialogProps) {
  const [includeSimilar, setIncludeSimilar] = useState(true);
  const [includeBlocked, setIncludeBlocked] = useState(false);
  const [includeOver45Mb, setIncludeOver45Mb] = useState(false);

  const {
    totalItems,
    excludedItems,
    blockedItemsCount,
    warningItemsCount,
    blockedTermIssues,
    ambiguousTermIssues,
    visualFlagIssues,
    similarTitleIssues,
    resolutionIssues,
    varietyIssues,
    rowFileMatch,
    canExportSafely,
  } = report;

  const realExportCount = countExportableItems(
    items,
    { includeSimilar, includeBlocked, includeOver45Mb },
    activeMinSizeCheck
  );

  const redResolutionIssues = resolutionIssues.filter((r) => r.isRed);
  const warnResolutionIssues = resolutionIssues.filter((r) => !r.isRed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                blockedItemsCount > 0
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              )}
            >
              {blockedItemsCount > 0 ? (
                <ShieldAlert className="h-4 w-4" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Pre-Export Compliance & Quality Report
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Audit before generating CSV or embedding metadata. Exporting is always available.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-4 gap-2 pt-2">
          <div className="p-2.5 rounded-xl bg-accent/20 border border-border/40 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total</p>
            <p className="text-base font-bold text-foreground mt-0.5">{totalItems}</p>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-semibold">Export Rows</p>
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{realExportCount}</p>
          </div>

          <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-center">
            <p className="text-[10px] text-destructive uppercase tracking-wider font-semibold">Blocked / Refused</p>
            <p className="text-base font-bold text-destructive mt-0.5">{blockedItemsCount}</p>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider font-semibold">Warnings</p>
            <p className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">{warningItemsCount}</p>
          </div>
        </div>

        {/* Scrollable Issues List */}
        <div className="flex-1 overflow-y-auto space-y-4 pt-2 pr-1">
          {/* Hard Blocked Errors */}
          {blockedTermIssues.length > 0 && (
            <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                <XCircle className="h-4 w-4" />
                <span>Blocked Trademark Terms (blocked word)</span>
              </div>
              <div className="space-y-2">
                {blockedTermIssues.map((issue) => (
                  <div
                    key={issue.itemId}
                    className="flex items-center justify-between p-2 rounded-lg bg-card border border-destructive/20 text-xs gap-2"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">{issue.filename}</p>
                      <p className="text-[11px] text-destructive font-medium">
                        Reason: <span className="font-bold">blocked word</span> ({issue.terms.join(', ')})
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onFixTitle(issue.itemId, issue.terms[0])}
                        className="text-xs h-7"
                      >
                        Fix
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onIncludeAnyway(issue.itemId)}
                        className="text-xs h-7 text-muted-foreground hover:text-foreground"
                      >
                        Include anyway
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar Title Issues */}
          {similarTitleIssues.length > 0 && (
            <div className="p-3.5 rounded-xl border border-border/60 bg-accent/10 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Layers className="h-4 w-4 text-primary" />
                <span>Similar Titles in Batch ({similarTitleIssues.length})</span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {similarTitleIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-card border border-border/40 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">{issue.filename}</p>
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                        Reason: <span className="font-bold">similar title</span> (Similar to {issue.otherFilename})
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {onFixSimilarTitles && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={onFixSimilarTitles}
                          className="text-xs h-7"
                        >
                          Fix
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const matchingItem = items.find((it) => it.fileData.originalName === issue.filename);
                          if (matchingItem) onIncludeAnyway(matchingItem.id);
                        }}
                        className="text-xs h-7 text-muted-foreground hover:text-foreground"
                      >
                        Include anyway
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolution Check Red Errors */}
          {redResolutionIssues.length > 0 && (
            <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                <Maximize2 className="h-4 w-4" />
                <span>Resolution & Dimension Issues ({redResolutionIssues.length})</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {redResolutionIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-card border border-destructive/20 text-xs gap-2"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">{issue.filename}</p>
                      <p className="text-[11px] text-destructive font-medium">
                        Reason: <span className="font-bold">below 4 MP limit</span> ({issue.width} × {issue.height} = {issue.megapixels} MP)
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const matchingItem = items.find((it) => it.fileData.originalName === issue.filename);
                          if (matchingItem) onIncludeAnyway(matchingItem.id);
                        }}
                        className="text-xs h-7 text-muted-foreground hover:text-foreground"
                      >
                        Include anyway
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Checkboxes above Proceed to Export */}
        <div className="py-3 border-t border-border/50 space-y-2">
          <p className="text-xs font-bold text-foreground">Export Inclusion Overrides:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSimilar}
                onChange={(e) => setIncludeSimilar(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span className="text-foreground">Include files with similar titles</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeBlocked}
                onChange={(e) => setIncludeBlocked(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span className="text-foreground">Include files with blocked terms</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeOver45Mb}
                onChange={(e) => setIncludeOver45Mb(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span className="text-foreground">Include files over Adobe&apos;s 45 MB limit</span>
            </label>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border/50 flex items-center justify-between sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs">
            Review in Generator
          </Button>

          <Button
            onClick={() => {
              onOpenChange(false);
              onProceedExport({ includeSimilar, includeBlocked, includeOver45Mb });
            }}
            className="text-xs font-semibold bg-emerald-600 text-white hover:opacity-90 transition-opacity"
          >
            <span>Proceed to Export ({realExportCount} files)</span>
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
