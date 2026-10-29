'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Sparkles, Scissors, Wand2, ArrowRight, X } from 'lucide-react';
import { TOOLS_REGISTRY, ToolTag } from '@/config/tools';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Scissors,
  Wand2,
};

const ALL_PILL_CATEGORIES: ToolTag[] = ['Generate', 'Convert & Prepare', 'Enhance'];

export default function AllToolsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Only show pills that have at least one tool
  const availablePills = useMemo(() => {
    const valid = ALL_PILL_CATEGORIES.filter((category) =>
      TOOLS_REGISTRY.some((tool) => tool.tag === category || tool.category === category)
    );
    return ['All', ...valid];
  }, []);

  // Filter tools by search query and selected category
  const filteredTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return TOOLS_REGISTRY.filter((tool) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        tool.tag === selectedCategory ||
        tool.category === selectedCategory;

      if (!matchesCategory) return false;

      if (!q) return true;
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        (tool.tag && tool.tag.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header: Heading and short line under it */}
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
            const isSelected = selectedCategory === pill;
            return (
              <button
                key={pill}
                type="button"
                onClick={() => setSelectedCategory(pill)}
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

      {/* Grid of cards: 3 columns on desktop, 1 on mobile */}
      {filteredTools.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool) => {
            const Icon = ICON_MAP[tool.iconName] || Sparkles;
            const isNew = tool.badge === 'NEW';

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
                        isNew
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-sm'
                          : 'bg-primary/10 text-primary border-primary/25'
                      )}
                    >
                      {tool.badge}
                    </span>
                  </div>

                  {/* Name & One-line description */}
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
                    href={tool.href}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary hover:text-primary/80 transition-colors group/link"
                  >
                    <span>Open tool</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
                  </Link>
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
              setSelectedCategory('All');
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
