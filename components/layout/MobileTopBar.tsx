'use client';

import React from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { SITE_CONFIG } from '@/config/site';

interface MobileTopBarProps {
  onOpenSidebar: () => void;
}

export function MobileTopBar({ onOpenSidebar }: MobileTopBarProps) {
  return (
    <header className="lg:hidden sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border/50 bg-card/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Open Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <LogoMark size={18} />
          </div>
          <span className="font-display font-bold tracking-tight text-foreground text-base">
            {SITE_CONFIG.BRAND_NAME}
          </span>
          <span className="rounded-full border border-orange-500/30 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-orange-500">
            {SITE_CONFIG.BADGE_TEXT}
          </span>
        </Link>
      </div>
    </header>
  );
}
