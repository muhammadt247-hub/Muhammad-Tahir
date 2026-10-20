'use client';

import React from 'react';
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
  AlertCircle,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComplianceReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: PreExportReport;
  onProceedExport: () => void;
  onFixTitle: (itemId: string) => void;
  onApproveAmbiguous: (itemId: string, term: string) => void;
  onFixSimilarTitles?: () => void;
}

export function ComplianceReportDialog({
  open,
  onOpenChange,
  report,
  onProceedExport,
  onFixTitle,
  onApproveAmbiguous,
  onFixSimilarTitles,
}: ComplianceReportDialogProps) {
  const {
    totalItems,
    readyItems,
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
                Audit before generating CSV or embedding metadata to prevent stock rejections.
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
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{readyItems}</p>
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
          {/* Resolution Check Red Errors */}
          {redResolutionIssues.length > 0 && (
            <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                <Maximize2 className="h-4 w-4" />
                <span>Resolution & Dimension Issues ({redResolutionIssues.length})</span>
              </div>
              <p className="text-[10px] text-destructive/90">
                Adobe Stock requires images to be at least 4 MP, under 100 MP, and under 45 MB. Files under 4 MP are excluded from export by default.
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {redResolutionIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-card border border-destructive/20 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">{issue.filename}</p>
                      <p className="text-[11px] text-destructive font-medium">
                        {issue.message} ({issue.width} × {issue.height} = {issue.megapixels} MP)
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-destructive/15 text-destructive shrink-0">
                      Excluded from CSV
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hard Blocked Errors */}
          {blockedTermIssues.length > 0 && (
            <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                <XCircle className="h-4 w-4" />
                <span>Blocked Trademark Terms (Must fix or exclude before export)</span>
              </div>
              <div className="space-y-2">
                {blockedTermIssues.map((issue) => (
                  <div
                    key={issue.itemId}
                    className="flex items-center justify-between p-2 rounded-lg bg-card border border-destructive/20 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">{issue.filename}</p>
                      <p className="text-[11px] text-destructive">
                        Blocked: <span className="font-bold">{issue.terms.join(', ')}</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onFixTitle(issue.itemId)}
                      className="text-xs shrink-0"
                    >
                      Fix Title
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolution Warnings (e.g. Below 4 MP in Warn Only mode) */}
          {warnResolutionIssues.length > 0 && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                <Maximize2 className="h-4 w-4 text-amber-500" />
                <span>Resolution Warnings ({warnResolutionIssues.length})</span>
              </div>
              <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80">
                Images below 4 MP will still be generated and exported in CSV, but stock platforms like Adobe Stock may refuse them.
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {warnResolutionIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-card border border-amber-500/20 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">{issue.filename}</p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                        {issue.message} ({issue.width} × {issue.height} = {issue.megapixels} MP)
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0">
                      Warning
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variety Warnings: Repetitive Openings & Overused Keywords */}
          {(varietyIssues.repetitiveFirstWords.length > 0 || varietyIssues.overusedKeywords.length > 0) && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>Variety & Repetition Warnings</span>
                </div>
                {varietyIssues.repetitiveFirstWords.length > 0 && onFixSimilarTitles && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onFixSimilarTitles}
                    className="h-7 text-xs font-semibold gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30"
                  >
                    <Wand2 className="h-3 w-3" />
                    <span>Fix similar titles</span>
                  </Button>
                )}
              </div>

              {/* Repetitive Openings */}
              {varietyIssues.repetitiveFirstWords.map((issue, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-card border border-amber-500/25 text-xs flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-foreground">
                      Opening word repetition: <span className="text-amber-700 dark:text-amber-400 font-bold">&quot;{issue.word}&quot;</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      More than 3 titles in this batch ({issue.count} titles) start with the same first word.
                    </p>
                  </div>
                </div>
              ))}

              {/* Overused Keywords (> 40%) */}
              {varietyIssues.overusedKeywords.map((issue, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-card border border-amber-500/25 text-xs flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-foreground">
                      Shared keyword spam risk: <span className="text-amber-700 dark:text-amber-400 font-bold">&quot;{issue.keyword}&quot;</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Shared by {issue.percentage}% of files in batch ({issue.count} files). Stock agencies penalize over-indexing on identical keywords.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 shrink-0">
                    {issue.percentage}% share
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Row / File Match Check */}
          <div className="p-3.5 rounded-xl border border-border/60 bg-accent/10 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <span>Row / File Match Verification</span>
            </div>

            {rowFileMatch.isPerfectMatch ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>100% 1:1 Match: Every uploaded image has a ready CSV row, and every row matches an image.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Files that have no row */}
                {rowFileMatch.filesWithoutRow.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      Files with no export row ({rowFileMatch.filesWithoutRow.length}):
                    </p>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {rowFileMatch.filesWithoutRow.map((f) => (
                        <div
                          key={f.itemId}
                          className="flex items-center justify-between p-1.5 rounded-md bg-card border border-border/40 text-[11px]"
                        >
                          <span className="font-medium text-foreground truncate max-w-[240px]">
                            {f.filename}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {f.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rows that have no file */}
                {rowFileMatch.rowsWithoutFile.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="text-[11px] font-semibold text-destructive">
                      Rows with no uploaded file ({rowFileMatch.rowsWithoutFile.length}):
                    </p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {rowFileMatch.rowsWithoutFile.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-1.5 rounded-md bg-card border border-destructive/20 text-[11px]"
                        >
                          <span className="font-medium text-destructive truncate max-w-[240px]">
                            {r.filename}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {r.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ambiguous Term Warnings */}
          {ambiguousTermIssues.length > 0 && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span>Ambiguous Terms (Fruit/River vs Brand)</span>
              </div>
              <div className="space-y-2">
                {ambiguousTermIssues.map((issue) => (
                  <div
                    key={issue.itemId}
                    className="flex items-center justify-between p-2 rounded-lg bg-card border border-amber-500/20 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">{issue.filename}</p>
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        Term: <span className="font-bold">{issue.terms.join(', ')}</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onApproveAmbiguous(issue.itemId, issue.terms[0])}
                      className="text-xs shrink-0 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      This is fine
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual Flag Warnings */}
          {visualFlagIssues.length > 0 && (
            <div className="p-3.5 rounded-xl border border-border/60 bg-accent/10 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <UserCheck className="h-4 w-4 text-primary" />
                <span>AI Visual Release & Editorial Advisories ({visualFlagIssues.length})</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                AI detection is advisory. Ensure model/property releases are attached in Adobe Contributor Portal if required.
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {visualFlagIssues.map((issue) => (
                  <div
                    key={issue.itemId}
                    className="p-2 rounded-lg bg-card border border-border/40 text-xs flex items-center justify-between"
                  >
                    <span className="font-medium text-foreground truncate max-w-[200px]">
                      {issue.filename}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {issue.reasons.join(' • ') || 'Potential release required'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar Title Warnings */}
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
                    className="p-2 rounded-lg bg-card border border-border/40 text-xs flex items-center justify-between"
                  >
                    <span className="font-medium text-foreground truncate max-w-[200px]">
                      {issue.filename}
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                      Similar to {issue.otherFilename} ({Math.round(issue.score * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canExportSafely && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              <span>All items meet compliance criteria and are ready for export.</span>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border/50 flex items-center justify-between sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs">
            Review in Generator
          </Button>

          <Button
            onClick={() => {
              onOpenChange(false);
              onProceedExport();
            }}
            disabled={!canExportSafely}
            className="text-xs font-semibold"
          >
            <span>Proceed to Export ({readyItems} files)</span>
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
