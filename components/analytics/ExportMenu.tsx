'use client';

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Asset, SearchParams } from '@/types/asset';
import { exportAssetsToCsv, exportAssetsToXlsx, exportAssetsToJson } from '@/lib/csv';
import { Download, ChevronDown, FileSpreadsheet, FileJson, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface ExportMenuProps {
  assets: Asset[];
  allAssets: Asset[];
  currentQuery: string;
  filtersDescription: string;
  searchParams: SearchParams;
  onFetchMoreAndExport: (pagesToFetch: number, format: 'csv' | 'xlsx' | 'json') => Promise<void>;
  disabled?: boolean;
}

export function ExportMenu({
  assets,
  allAssets,
  currentQuery,
  filtersDescription,
  onFetchMoreAndExport,
  disabled = false,
}: ExportMenuProps) {
  const [scope, setScope] = useState<'page' | 'all'>('page');

  const getTargetAssets = () => {
    return scope === 'page' ? assets : allAssets;
  };

  const handleExport = (format: 'csv' | 'xlsx' | 'json') => {
    const list = getTargetAssets();
    if (!list || list.length === 0) {
      toast.info('No assets to export');
      return;
    }

    if (format === 'csv') {
      exportAssetsToCsv(list, currentQuery, filtersDescription);
      toast.success(`Exported ${list.length} assets to CSV`);
    } else if (format === 'xlsx') {
      exportAssetsToXlsx(list, currentQuery, filtersDescription);
      toast.success(`Exported ${list.length} assets to Excel`);
    } else {
      exportAssetsToJson(list, currentQuery);
      toast.success(`Exported ${list.length} assets to JSON`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled || assets.length === 0}
          title={disabled || assets.length === 0 ? 'Run an analysis first' : 'Download and export search results'}
          className="h-12 sm:h-14 px-6 sm:px-8 rounded-xl text-sm sm:text-base font-semibold gap-2 border-border/50 bg-background/50 hover:bg-accent shrink-0"
        >
          <Download className="h-5 w-5" />
          <span>Download</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-xl">
        <DropdownMenuLabel>Export Scope</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={scope}
          onValueChange={(val) => setScope(val as 'page' | 'all')}
        >
          <DropdownMenuRadioItem value="page" className="text-xs">
            Current page ({assets.length} items)
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="all" className="text-xs">
            All loaded results ({allAssets.length} items)
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleExport('csv')} className="text-xs gap-2">
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
          Comma-Separated (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('xlsx')} className="text-xs gap-2">
          <FileSpreadsheet className="h-3.5 w-3.5 text-orange-500" />
          Microsoft Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')} className="text-xs gap-2">
          <FileJson className="h-3.5 w-3.5 text-amber-500" />
          Structured JSON (.json)
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={async () => {
            const num = window.prompt('How many additional pages to fetch and export? (1 - 10):', '3');
            if (num) {
              const parsed = Math.min(10, Math.max(1, parseInt(num, 10) || 1));
              await onFetchMoreAndExport(parsed, 'csv');
            }
          }}
          className="text-xs gap-2 text-primary font-medium"
        >
          <Layers className="h-3.5 w-3.5" />
          Fetch more pages &amp; export...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
