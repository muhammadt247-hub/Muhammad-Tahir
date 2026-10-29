'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  Sparkles,
  Scissors,
  FileImage,
  Maximize2,
  Shapes,
  Wand2,
  CalendarDays,
  ArrowRight,
  X,
} from 'lucide-react';
import { TOOLS_REGISTRY, ToolTag } from '@/config/tools';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Scissors,
  FileImage,
  Maximize2,
  Shapes,
  Wand2,
  CalendarDays,
};

const ALL_PILL_CATEGORIES: ToolTag[] = [
  'Generate',
  'Convert & Prepare',
  'Enhance',
  'Plan',
];

export default function AllToolsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('All');

  // Filter pills: show only tags that have at least one tool
  const availablePills = useMemo(() => {
    const valid = ALL_PILL_CATEGORIES.filter((cat) =>
      TOOLS_REGISTRY.some((tool) => tool.tag === cat)
    );
    return ['All', ...valid];
  }, []);

  // Filter tools by search query and selected tag
  // Live tools first, then upcoming tools
  const filteredTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matches = TOOLS_REGISTRY.filter((tool) => {
      const matchesTag = selectedTag === 'All' || tool.tag === selectedTag;
      if (!matchesTag) return false;

      if (!q) return true;
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.tag.toLowerCase().includes(q)
      );
    });

    // Ensure live tools come first, then upcoming tools
    return matches.sort((a, b) => {
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (a.status !== 'live' && b.status === 'live') return 1;
      return 0;
    });
  }, [searchQuery, selectedTag]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Heading & short line */}
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          All tools
        </h1>
        <div className="w-12 h-1 bg-gradient-to-r from-orange-600 to-amber-500 rounded-full" />
        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
          A suite of creator tools designed to streamline your stock photography workflow.
        </p>
      </div>

      {/* Controls: Search box and filter pills */}
      <div className="space-y-4">
        {/* Search input */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-border/60 bg-card text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-md"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {availablePills.map((pill) => {
            const isSelected = selectedTag === pill;
            return (
              <button
                key={pill}
                type="button"
                onClick={() => setSelectedTag(pill)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-2 ring-primary/40'
                    : 'bg-card text-muted-foreground hover:text-foreground hover:bg-accent border border-border/60'
                )}
              >
                {pill}
              </button>
            );
          })}
        </div>
      </div>

      {/* Responsive grid of cards (3 columns on desktop, 1 on mobile) */}
      {filteredTools.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool) => {
            const Icon = ICON_MAP[tool.iconName] || Sparkles;
            const isLive = tool.status === 'live' && tool.href;
            const isGreenBadge = tool.badge === 'LIVE' || tool.badge === 'NEW';
            const isUpcoming = tool.badge === 'UPCOMING';

            const badgeClasses = isGreenBadge
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : isUpcoming
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              : 'bg-primary/10 text-primary border-primary/25';

            if (isLive) {
              return (
                <div
                  key={tool.id}
                  className="glass-card rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 group"
                >
                  <div className="space-y-4">
                    {/* Icon & Badge header */}
                    <div className="flex items-center justify-between">
                      <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center transition-transform group-hover:scale-105">
                        <Icon className="h-5 w-5" />
                      </div>

                      <span
                        className={cn(
                          'text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full border',
                          badgeClasses
                        )}
                      >
                        {tool.badge}
                      </span>
                    </div>

                    {/* Name & description */}
                    <div>
                      <h2 className="text-lg font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
                        {tool.name}
                      </h2>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                        {tool.description}
                      </p>
                    </div>
                  </div>

                  {/* Open tool link */}
                  <div className="pt-6 mt-2 border-t border-border/40">
                    <Link
                      href={tool.href!}
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary hover:text-primary/80 transition-colors group/link"
                    >
                      <span>Open tool</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
                    </Link>
                  </div>
                </div>
              );
            }

            // Upcoming card: softer look, no hover grow, no link, grey Coming soon text
            return (
              <div
                key={tool.id}
                className="glass-card rounded-2xl p-6 flex flex-col justify-between border-border/50 opacity-80"
              >
                <div className="space-y-4">
                  {/* Icon & Badge header */}
                  <div className="flex items-center justify-between">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>

                    <span
                      className={cn(
                        'text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full border',
                        badgeClasses
                      )}
                    >
                      {tool.badge}
                    </span>
                  </div>

                  {/* Name & description */}
                  <div>
                    <h2 className="text-lg font-bold text-foreground tracking-tight">
                      {tool.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                      {tool.description}
                    </p>
                  </div>
                </div>

                {/* Coming soon label */}
                <div className="pt-6 mt-2 border-t border-border/40">
                  <span className="text-xs text-muted-foreground font-medium">
                    Coming soon
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-12 text-center space-y-3">
          <p className="text-muted-foreground text-sm">
            No tools match your search criteria.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedTag('All');
            }}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
