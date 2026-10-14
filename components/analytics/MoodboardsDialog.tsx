'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMoodboards } from '@/hooks/useMoodboards';
import { Asset } from '@/types/asset';
import { exportMoodboardToCsv, exportMoodboardToJson, exportMoodboardToZip } from '@/lib/moodboards';
import { toast } from 'sonner';
import {
  Heart,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Wand2,
  FileSpreadsheet,
  FileJson,
  Archive,
  X,
  Sparkles,
  Search,
} from 'lucide-react';
import { PromptDialog } from './PromptDialog';

interface MoodboardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoodboardsDialog({ open, onOpenChange }: MoodboardsDialogProps) {
  const {
    boards,
    createBoard,
    renameBoard,
    duplicateBoard,
    deleteBoard,
    removeAssetFromBoard,
    clearBoard,
  } = useMoodboards();

  const [activeBoardId, setActiveBoardId] = useState<string>(
    boards[0]?.id || 'default-favorites'
  );
  const [newBoardName, setNewBoardName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [boardSearch, setBoardSearch] = useState('');
  const [boardSort, setBoardSort] = useState<'recent' | 'downloads' | 'newest'>('recent');
  const [promptAsset, setPromptAsset] = useState<Asset | null>(null);

  const activeBoard = boards.find((b) => b.id === activeBoardId) || boards[0];

  const handleCreateBoard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    const id = createBoard(newBoardName.trim());
    setActiveBoardId(id);
    setNewBoardName('');
    toast.success(`Created moodboard "${newBoardName.trim()}"`);
  };

  const handleCopyKeywords = () => {
    if (!activeBoard || activeBoard.assets.length === 0) return;
    const set = new Set<string>();
    activeBoard.assets.forEach((a) => {
      a.keywords?.forEach((k) => set.add(k));
    });
    const joined = Array.from(set).join(', ');
    navigator.clipboard.writeText(joined);
    toast.success(`Copied ${set.size} unique keywords from board`);
  };

  const handleExportCsv = () => {
    if (!activeBoard || activeBoard.assets.length === 0) {
      toast.info('No assets to export');
      return;
    }
    exportMoodboardToCsv(activeBoard.assets, activeBoard.name);
    toast.success('Board exported to CSV');
  };

  const handleExportJson = () => {
    if (!activeBoard || activeBoard.assets.length === 0) {
      toast.info('No assets to export');
      return;
    }
    exportMoodboardToJson(activeBoard.assets, activeBoard.name);
    toast.success('Board exported to JSON');
  };

  const handleExportZip = async () => {
    if (!activeBoard || activeBoard.assets.length === 0) {
      toast.info('No assets to export');
      return;
    }
    await exportMoodboardToZip(activeBoard.assets, activeBoard.name);
  };

  // Filter and sort board assets
  let displayAssets = activeBoard ? [...activeBoard.assets] : [];
  if (boardSearch.trim()) {
    const q = boardSearch.toLowerCase();
    displayAssets = displayAssets.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.creator_name.toLowerCase().includes(q) ||
        a.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }

  if (boardSort === 'downloads') {
    displayAssets.sort((a, b) => (b.nb_downloads || 0) - (a.nb_downloads || 0));
  } else if (boardSort === 'newest') {
    displayAssets.sort(
      (a, b) => new Date(b.creation_date).getTime() - new Date(a.creation_date).getTime()
    );
  }

  // Board statistics
  const totalItems = activeBoard?.assets.length || 0;
  const aiCount = activeBoard?.assets.filter((a) => a.is_generative_ai).length || 0;
  const nonAiCount = totalItems - aiCount;

  // Top keywords frequency
  const keywordFreq: Record<string, number> = {};
  activeBoard?.assets.forEach((a) => {
    a.keywords?.forEach((k) => {
      keywordFreq[k] = (keywordFreq[k] || 0) + 1;
    });
  });
  const topKeywords = Object.entries(keywordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-6 rounded-2xl">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Heart className="h-4 w-4 fill-current" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Moodboards &amp; Collections</DialogTitle>
                  <DialogDescription className="text-xs">
                    Curate stock inspiration, analyze keyword frequency, and export asset lists.
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0 flex-1 overflow-hidden pt-2">
            {/* Left Sidebar: Boards List */}
            <div className="md:col-span-4 flex flex-col border-r border-border/40 pr-4 space-y-4 min-h-0 overflow-y-auto">
              <form onSubmit={handleCreateBoard} className="flex gap-2">
                <Input
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="New board name..."
                  className="h-9 text-xs"
                />
                <Button type="submit" size="sm" className="h-9 px-3 shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>

              <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
                {boards.map((b) => {
                  const isActive = b.id === activeBoard?.id;
                  const firstThumb = b.assets[0]?.thumbnail_url;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setActiveBoardId(b.id)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors text-left border ${
                        isActive
                          ? 'bg-foreground text-background border-transparent shadow-sm'
                          : 'hover:bg-accent border-border/40 bg-card/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-muted/60 shrink-0 border border-border/40">
                          {firstThumb ? (
                            <Image
                              src={firstThumb}
                              alt=""
                              fill
                              className="object-cover"
                              referrerPolicy="no-referrer"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <Heart className="h-3.5 w-3.5 opacity-40" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate leading-tight">
                            {b.name}
                          </p>
                          <p className={`text-[10px] mt-0.5 ${isActive ? 'opacity-70' : 'text-muted-foreground'}`}>
                            {b.assets.length} {b.assets.length === 1 ? 'asset' : 'assets'}
                          </p>
                        </div>
                      </div>

                      {/* Duplicate & Delete */}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateBoard(b.id);
                            toast.success(`Duplicated "${b.name}"`);
                          }}
                          title="Duplicate board"
                          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        {boards.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBoard(b.id);
                              toast.info(`Deleted "${b.name}"`);
                            }}
                            title="Delete board"
                            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Pane: Selected Board Assets & Stats */}
            <div className="md:col-span-8 flex flex-col min-h-0 overflow-y-auto space-y-4 pl-1">
              {activeBoard ? (
                <>
                  {/* Top Stats & Actions Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
                    <div>
                      {editingName ? (
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={activeBoard.name}
                            autoFocus
                            onBlur={(e) => {
                              renameBoard(activeBoard.id, e.target.value);
                              setEditingName(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                renameBoard(activeBoard.id, (e.target as HTMLInputElement).value);
                                setEditingName(false);
                              }
                            }}
                            className="h-8 text-sm font-bold"
                          />
                        </div>
                      ) : (
                        <div
                          onClick={() => setEditingName(true)}
                          className="group flex items-center gap-1.5 cursor-pointer"
                          title="Click to rename"
                        >
                          <h3 className="text-base font-bold text-foreground">
                            {activeBoard.name}
                          </h3>
                          <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
                            (edit)
                          </span>
                        </div>
                      )}

                      {/* Stat pills */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">
                          {totalItems} assets
                        </span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-semibold">
                          {nonAiCount} Non-AI
                        </span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full border border-primary/30 text-primary bg-primary/10 font-semibold flex items-center gap-1">
                          <Sparkles className="h-2.5 w-2.5" />
                          {aiCount} AI
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyKeywords}
                        className="h-8 text-xs gap-1"
                        title="Copy all deduplicated keywords"
                      >
                        <Copy className="h-3 w-3" />
                        Keywords
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCsv}
                        className="h-8 text-xs gap-1"
                      >
                        <FileSpreadsheet className="h-3 w-3" />
                        CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportJson}
                        className="h-8 text-xs gap-1"
                      >
                        <FileJson className="h-3 w-3" />
                        JSON
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          clearBoard(activeBoard.id);
                          toast.info('Cleared moodboard');
                        }}
                        className="h-8 text-xs text-destructive hover:text-destructive/80 px-2"
                        title="Clear all assets from this board"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Top keywords frequency preview */}
                  {topKeywords.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Frequent Tags:
                      </span>
                      {topKeywords.map(([kw, count]) => (
                        <span
                          key={kw}
                          className="rounded-full border border-border/40 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground font-medium"
                        >
                          {kw} <span className="opacity-60">({count})</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Search and Sort within board */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={boardSearch}
                        onChange={(e) => setBoardSearch(e.target.value)}
                        placeholder="Search saved assets..."
                        className="h-8 pl-8 text-xs rounded-xl"
                      />
                    </div>
                    <Select
                      value={boardSort}
                      onValueChange={(val) => setBoardSort(val as 'recent' | 'downloads' | 'newest')}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recent">Recently Added</SelectItem>
                        <SelectItem value="downloads">Downloads</SelectItem>
                        <SelectItem value="newest">Newest First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assets Grid */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {displayAssets.length === 0 ? (
                      <div className="h-48 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/50 rounded-xl">
                        <Heart className="h-8 w-8 text-muted-foreground opacity-30 mb-2" />
                        <p className="text-sm font-semibold text-foreground">
                          {boardSearch ? 'No matching assets found' : 'This board is empty'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Bookmark assets from the search results to save them here.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {displayAssets.map((asset) => (
                          <div
                            key={asset.id}
                            className="group relative rounded-xl border border-border/50 bg-card/60 p-2.5 flex flex-col space-y-2 hover:border-primary/40 transition-all shadow-xs"
                          >
                            <div className="relative aspect-[3/2] w-full rounded-lg overflow-hidden bg-muted/40">
                              <Image
                                src={asset.thumbnail_url}
                                alt={asset.title}
                                fill
                                className="object-cover"
                                referrerPolicy="no-referrer"
                                unoptimized
                              />
                              <button
                                onClick={() => removeAssetFromBoard(activeBoard.id, asset.id)}
                                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-destructive transition-colors shadow-sm"
                                title="Remove from board"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>

                            <p className="text-xs font-semibold text-foreground truncate" title={asset.title}>
                              {asset.title}
                            </p>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                              <span className="truncate max-w-[100px]">{asset.creator_name}</span>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => setPromptAsset(asset)}
                                  className="text-primary font-semibold hover:underline flex items-center gap-0.5"
                                  title="Reverse Prompt"
                                >
                                  <Wand2 className="h-2.5 w-2.5" /> Prompt
                                </button>
                                <a
                                  href={asset.details_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-primary"
                                  title="Open in Stock"
                                >
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {promptAsset && (
        <PromptDialog
          asset={promptAsset}
          open={!!promptAsset}
          onOpenChange={(op) => !op && setPromptAsset(null)}
        />
      )}
    </>
  );
}
