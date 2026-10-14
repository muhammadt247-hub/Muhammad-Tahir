'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ThemeToggleProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ThemeToggle({ collapsed = false, onToggleCollapse }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card text-foreground shadow-sm transition-all hover:bg-accent"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </TooltipContent>
        </Tooltip>

        {onToggleCollapse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent"
                aria-label="Expand Sidebar"
              >
                <ChevronLeft className="h-4 w-4 rotate-180 transition-transform duration-200" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand Sidebar</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex w-full items-center justify-between gap-0.5 rounded-full border border-border/60 bg-card p-1">
      <button
        onClick={toggleTheme}
        className="flex items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-transform active:scale-95"
      >
        {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
      </button>

      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent/60"
          title="Collapse Sidebar"
          aria-label="Collapse Sidebar"
        >
          <ChevronLeft className="h-4 w-4 transition-transform duration-200" />
        </button>
      )}
    </div>
  );
}
