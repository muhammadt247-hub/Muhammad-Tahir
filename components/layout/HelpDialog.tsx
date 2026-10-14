'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  HelpCircle,
  Sparkles,
  BarChart3,
  FileText,
  Heart,
  Wand2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Download,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { SITE_CONFIG } from '@/config/site';

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabSection = 'overview' | 'generator' | 'embedding' | 'analytics' | 'prompts' | 'moodboards';

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const [activeTab, setActiveTab] = useState<TabSection>('overview');

  const navItems: { id: TabSection; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Welcome & Overview', icon: <Info className="h-4 w-4" /> },
    { id: 'generator', label: 'Metadata Generator', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'embedding', label: 'In-Place Embedding', icon: <FileText className="h-4 w-4" /> },
    { id: 'analytics', label: 'Adobe Analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'prompts', label: 'Reverse Image Prompts', icon: <Wand2 className="h-4 w-4" /> },
    { id: 'moodboards', label: 'Moodboards & Collections', icon: <Heart className="h-4 w-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-hidden flex flex-col p-6 rounded-2xl">
        <DialogHeader className="shrink-0 border-b border-border/40 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                DOCTORx Help &amp; Documentation
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Guides, workflow tips, and technical reference for microstock contributors.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 overflow-hidden">
          {/* Left Navigation */}
          <div className="md:col-span-4 flex flex-col gap-1 border-b md:border-b-0 md:border-r border-border/40 pr-0 md:pr-4 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  <ChevronRight
                    className={`h-3.5 w-3.5 opacity-60 transition-transform ${
                      isActive ? 'translate-x-0.5' : ''
                    }`}
                  />
                </button>
              );
            })}

            <div className="mt-auto pt-4 border-t border-border/40">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-[11px] space-y-1.5">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> 100% Free &amp; Offline
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  DOCTORx has zero credit meters, no subscriptions, and stores all workspaces locally in your browser.
                </p>
              </div>
            </div>
          </div>

          {/* Right Content Panel */}
          <div className="md:col-span-8 overflow-y-auto pr-1 space-y-4 text-xs leading-relaxed text-muted-foreground">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-foreground mb-1">
                    Welcome to DOCTORx
                  </h3>
                  <p>
                    DOCTORx is an all-in-one suite built for stock contributors, microstock photographers, vector illustrators, and generative AI creators uploading to Adobe Stock, Shutterstock, and Freepik.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl border border-border/50 bg-card/60 space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> Bulk Generator
                    </p>
                    <p className="text-[11px]">
                      Process up to 200 assets in batch with marketplace limits and automatic CSV/ZIP downloads.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-border/50 bg-card/60 space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5 text-primary" /> Adobe Analytics
                    </p>
                    <p className="text-[11px]">
                      Explore top-selling stock items, contributor rankings, and reverse-engineer successful prompts.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-border/50 bg-card/60 space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" /> Direct Embedding
                    </p>
                    <p className="text-[11px]">
                      Write Title, Description, and Keywords into JPEG/PNG bytes with byte-identical pixel fidelity.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-border/50 bg-card/60 space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5 text-primary" /> Moodboards
                    </p>
                    <p className="text-[11px]">
                      Curate asset collections with keyword frequency analysis and instant CSV/JSON exports.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="font-semibold text-foreground mb-1">Need direct support?</p>
                  <p>
                    Reach out to our team at{' '}
                    <a
                      href={`mailto:${SITE_CONFIG.SUPPORT_URL.replace('mailto:', '')}`}
                      className="text-primary font-medium hover:underline"
                    >
                      support@doctorx.ai
                    </a>
                    .
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'generator' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-foreground">
                  Bulk Metadata Generator (`/generator`)
                </h3>
                <p>
                  The Metadata Generator processes image batches, SVG vectors, and video clips into marketplace-ready metadata.
                </p>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">1. Upload Files (Up to 200)</p>
                    <p className="text-[11px]">
                      Drag and drop files or paste images from your clipboard (`Ctrl+V`). Files are compressed client-side to 1024px JPEGs before AI processing, ensuring your browser memory remains lean.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">2. Select Target Marketplace</p>
                    <p className="text-[11px]">
                      Switch between Adobe Stock (title + 49 tags), Shutterstock (title + description + 50 tags), Freepik, or Generic. Title and keyword counters alert you in amber if marketplace limits are exceeded.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">3. Bulk Tools</p>
                    <p className="text-[11px]">
                      Use the bulk toolbar to Find &amp; Replace across titles and keywords, Trim all tags to marketplace limits, and Remove duplicate tags across all rows.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">4. Export Formats</p>
                    <p className="text-[11px]">
                      Download individual marketplace CSVs, or export all platform CSVs simultaneously in a single structured ZIP archive.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'embedding' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-foreground">
                  In-Place Metadata Embedding
                </h3>
                <p>
                  Click the <strong>Embed Metadata</strong> button in the Generator action bar to inject Title, Description, and Keywords directly into your source files.
                </p>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">Byte-Identical Pixel Preservation</p>
                    <p className="text-[11px]">
                      Unlike standard graphic editors, DOCTORx never re-encodes image pixels. It parses container segments, replaces metadata headers (APP1 XMP, APP13 IPTC, and PNG iTXt chunks), and leaves image pixels untouched.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">JPEG Standards</p>
                    <p className="text-[11px]">
                      Writes to standard EXIF tags (`ImageDescription`, `XPTitle`, `XPKeywords`), IPTC Application Record 2 (`ObjectName`, `Headline`, `Caption-Abstract`, `Keywords`), and XMP RDF packets (`dc:title`, `dc:description`, `dc:subject`).
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">PNG Standards</p>
                    <p className="text-[11px]">
                      Injects an Adobe-compliant XMP packet inside an `iTXt` chunk with keyword `XML:com.adobe.xmp` and a valid IEEE 802.3 CRC-32 checksum.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-foreground">
                  Adobe Stock Market Analytics (`/adobe-analytics`)
                </h3>
                <p>
                  Gain insights into real-time stock demand, popular themes, and top-selling portfolio structures.
                </p>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">Dual Search Modes</p>
                    <p className="text-[11px]">
                      Search by keyword (e.g. &ldquo;sustainable energy&rdquo;) or paste an Adobe Stock Contributor ID to analyze specific competitor libraries.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">Filters &amp; Sorting</p>
                    <p className="text-[11px]">
                      Isolate Non-AI assets vs. Generative AI content. Sort by Most Downloads, Creation Date, Relevance, or Undiscovered assets to identify emerging trends.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">Asset Cards</p>
                    <p className="text-[11px]">
                      Each card displays download counts, upload dates, 10 keyword chips, and one-click copy buttons for both title and tags.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prompts' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-foreground">
                  Reverse Image Prompt Generator
                </h3>
                <p>
                  Click the <strong>Prompt</strong> button on any asset card to analyze its visual attributes using multimodal AI.
                </p>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">Generator Profiles</p>
                    <p className="text-[11px]">
                      Outputs prompts optimized for Midjourney v6 (with parameters like `--ar`, `--v 6.0`, `--style raw`), FLUX.1 / SDXL, and Gemini / Imagen 3.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">Visual Breakdown</p>
                    <p className="text-[11px]">
                      Examines camera angle, focal length, lighting conditions, composition balance, and extracts an accurate hex color palette.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'moodboards' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-foreground">
                  Moodboards &amp; Collections
                </h3>
                <p>
                  Click the bookmark icon on any asset card to save it into custom collections without signing in.
                </p>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">Keyword Frequency Analysis</p>
                    <p className="text-[11px]">
                      The moodboard viewer calculates the most frequent keywords across all saved items, revealing common high-demand tag clusters.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border/50 space-y-1">
                    <p className="font-semibold text-foreground">Exporting Boards</p>
                    <p className="text-[11px]">
                      Export your boards as CSV or JSON, download assets as a ZIP archive, or copy all deduplicated keywords in one click.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-border/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-xs rounded-xl"
            >
              <Link href="/tools" onClick={() => onOpenChange(false)}>
                Explore All Tools
              </Link>
            </Button>
          </div>

          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs rounded-xl"
          >
            Close Guide
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
