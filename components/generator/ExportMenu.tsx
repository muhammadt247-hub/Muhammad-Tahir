'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { GeneratorItem } from '@/types/generator';
import {
  buildPlatformCsvString,
  exportGeneratorBatch,
  downloadBlob,
} from '@/lib/csv';
import * as XLSX from 'xlsx';
import { Download, ChevronDown, FileSpreadsheet, Archive, FileJson } from 'lucide-react';
import { toast } from 'sonner';

interface GeneratorExportMenuProps {
  items: GeneratorItem[];
  selectedPlatforms: ('adobe' | 'shutterstock' | 'freepik' | 'generic')[];
  disabled?: boolean;
}

export function GeneratorExportMenu({
  items,
  selectedPlatforms,
  disabled = false,
}: GeneratorExportMenuProps) {
  const doneItems = items.filter((i) => i.status === 'done');
  const hasFinished = doneItems.length > 0;

  const handleExportZip = async () => {
    if (!hasFinished) return;
    try {
      await exportGeneratorBatch(selectedPlatforms, doneItems);
      toast.success(`Exported ${doneItems.length} rows to multi-platform ZIP`);
    } catch {
      toast.error('Failed to generate ZIP archive');
    }
  };

  const handleExportSinglePlatform = (platform: 'adobe' | 'shutterstock' | 'freepik' | 'generic') => {
    if (!hasFinished) return;
    const csvContent = buildPlatformCsvString(platform, doneItems);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = platform === 'adobe' ? 'orbinexacsv_adobe-stock_export.csv' : `${platform}_metadata_${dateStr}.csv`;
    downloadBlob(blob, filename);
    toast.success(`Exported ${doneItems.length} rows for ${platform}`);
  };

  const handleExportXlsx = () => {
    if (!hasFinished) return;
    const rows = doneItems.map((i) => ({
      Filename: i.filename,
      Title: i.title,
      Description: i.description,
      Keywords: i.keywords.join(', '),
      Category: i.category,
      Is_AI: i.isAi ? 'Yes' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Metadata');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `metadata_export_${dateStr}.xlsx`);
    toast.success(`Exported ${doneItems.length} rows to Excel`);
  };

  const handleExportJson = () => {
    if (!hasFinished) return;
    const jsonStr = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        count: doneItems.length,
        items: doneItems.map((i) => ({
          filename: i.filename,
          title: i.title,
          description: i.description,
          keywords: i.keywords,
          category: i.category,
          isAi: i.isAi,
        })),
      },
      null,
      2
    );
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `metadata_export_${dateStr}.json`);
    toast.success(`Exported ${doneItems.length} rows to JSON`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled || !hasFinished}
          title={!hasFinished ? 'Complete at least 1 file to export' : 'Export generated metadata'}
          className="h-12 px-6 rounded-xl text-sm font-semibold gap-2 border-border/50 bg-background/50 hover:bg-accent shrink-0"
        >
          <Download className="h-4 w-4" />
          <span>Export Batch ({doneItems.length})</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-xl">
        <DropdownMenuLabel>Primary Export</DropdownMenuLabel>

        {selectedPlatforms.length > 1 ? (
          <DropdownMenuItem onClick={handleExportZip} className="text-xs gap-2 font-semibold text-primary">
            <Archive className="h-3.5 w-3.5" />
            Export Multi-Platform ZIP ({selectedPlatforms.length} CSVs)
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => handleExportSinglePlatform(selectedPlatforms[0])}
            className="text-xs gap-2 font-semibold text-primary"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export {selectedPlatforms[0].toUpperCase()} CSV
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Individual Marketplace CSVs</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleExportSinglePlatform('adobe')} className="text-xs gap-2">
          <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
          Adobe Stock CSV Template
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExportSinglePlatform('shutterstock')} className="text-xs gap-2">
          <FileSpreadsheet className="h-3.5 w-3.5 text-red-500" />
          Shutterstock CSV Template
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExportSinglePlatform('freepik')} className="text-xs gap-2">
          <FileSpreadsheet className="h-3.5 w-3.5 text-orange-500" />
          Freepik CSV Template
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExportSinglePlatform('generic')} className="text-xs gap-2">
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
          Generic All-Purpose CSV
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Alternative Formats</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleExportXlsx} className="text-xs gap-2">
          <FileSpreadsheet className="h-3.5 w-3.5 text-orange-500" />
          Microsoft Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJson} className="text-xs gap-2">
          <FileJson className="h-3.5 w-3.5 text-amber-500" />
          Structured JSON (.json)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
