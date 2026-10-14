'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  BarChart3,
  LayoutGrid,
  HelpCircle,
  Settings as SettingsIcon,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { TOOLS_REGISTRY } from '@/config/tools';
import { cn } from '@/lib/utils';
import { LogoMark } from '@/components/Logo';
import { SidebarItem } from './SidebarItem';
import { ThemeToggle } from './ThemeToggle';
import { ProfileCard } from './ProfileCard';
import { HelpDialog } from './HelpDialog';
import { SettingsDialog } from './SettingsDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  className?: string;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  onCloseMobile,
  className,
}: SidebarProps) {
  const pathname = usePathname();
  const [openHelp, setOpenHelp] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);

  return (
    <>
      <aside
        className={cn(
          'sticky top-0 h-screen flex flex-col border-r border-border/50 bg-card overflow-hidden z-40 shrink-0 transition-[width] duration-300 ease-out select-none',
          collapsed ? 'w-[72px]' : 'w-[260px]',
          className
        )}
      >
        {/* 1. Header */}
        <div className="h-16 px-4 flex items-center gap-3 border-b border-border/50 shrink-0">
          <Link
            href="/generator"
            onClick={onCloseMobile}
            className="flex items-center gap-3 group focus:outline-none"
          >
            {/* Logo Tile */}
            <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 transition-transform group-hover:scale-105 shrink-0">
              <LogoMark size={22} />
            </div>

            {!collapsed && (
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-display font-bold tracking-tight text-foreground leading-none">
                    {SITE_CONFIG.BRAND_NAME}
                  </span>
                  {/* Shimmer Badge */}
                  <div className="relative overflow-hidden rounded-full border border-orange-500/30 px-1.5 py-0.5 shrink-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                      {SITE_CONFIG.BADGE_TEXT}
                    </span>
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer pointer-events-none" />
                  </div>
                </div>
                <span className="text-[9px] font-medium text-muted-foreground mt-0.5 tracking-wider uppercase truncate">
                  {SITE_CONFIG.BRAND_CAPTION}
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* 2. Optional Chrome Extension badge */}
        {!collapsed && SITE_CONFIG.CHROME_EXTENSION_URL && (
          <a
            href={SITE_CONFIG.CHROME_EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-3 mt-3 flex items-center gap-2.5 p-2.5 rounded-xl bg-primary/[0.08] border border-primary/10 hover:bg-primary/[0.12] transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Zap className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-foreground leading-tight">
                Get Extension
              </p>
              <p className="text-[10px] text-muted-foreground">Chrome Web Store</p>
            </div>
            <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
          </a>
        )}

        {/* 3. Navigation Menu */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto min-h-0">
          {!collapsed && (
            <div className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              MAIN NAVIGATION
            </div>
          )}

          {/* 1. Generator */}
          <SidebarItem
            href="/generator"
            label="Generator"
            icon={<Sparkles className="h-5 w-5" />}
            collapsed={collapsed}
            onClick={onCloseMobile}
          />

          {/* 2. Adobe Analytics */}
          <SidebarItem
            href="/adobe-analytics"
            label="Adobe Analytics"
            icon={<BarChart3 className="h-5 w-5" />}
            collapsed={collapsed}
            onClick={onCloseMobile}
          />

          {/* 3. All Tools (Direct Link + Quick Menu) */}
          <div className="relative group">
            <SidebarItem
              href="/tools"
              label="All Tools"
              icon={<LayoutGrid className="h-5 w-5" />}
              collapsed={collapsed}
              onClick={onCloseMobile}
            />

            {/* Quick Catalog flyout for expanded sidebar */}
            {!collapsed && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="View Quick Tools Catalog"
                      className="p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="right"
                    align="start"
                    className="w-72 p-2 rounded-2xl"
                  >
                    <DropdownMenuLabel className="flex items-center justify-between">
                      <span>DOCTORx Toolkit Catalog</span>
                      <Link
                        href="/tools"
                        onClick={onCloseMobile}
                        className="text-[10px] text-primary lowercase hover:underline font-normal"
                      >
                        view all &rarr;
                      </Link>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {TOOLS_REGISTRY.map((tool) => {
                      const isLive = tool.status === 'live';
                      return (
                        <DropdownMenuItem
                          key={tool.id}
                          disabled={!isLive}
                          asChild={isLive}
                          className="p-2 cursor-pointer rounded-xl flex items-start gap-2.5"
                        >
                          {isLive ? (
                            <Link
                              href={tool.href}
                              onClick={onCloseMobile}
                              className="flex items-start gap-2.5 w-full"
                            >
                              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                                {tool.name.slice(0, 2)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-foreground">
                                    {tool.name}
                                  </span>
                                  {tool.badge && (
                                    <span className="text-[9px] bg-primary/10 text-primary font-bold px-1.5 py-0.2 rounded-full">
                                      {tool.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                                  {tool.description}
                                </p>
                              </div>
                            </Link>
                          ) : (
                            <div className="flex items-start gap-2.5 w-full opacity-60">
                              <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold">
                                {tool.name.slice(0, 2)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-foreground">
                                    {tool.name}
                                  </span>
                                  <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                                    Soon
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                                  {tool.description}
                                </p>
                              </div>
                            </div>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Section Divider */}
          <div className="pt-4 pb-1">
            {!collapsed && (
              <div className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border/40 pt-4">
                SYSTEM &amp; SUPPORT
              </div>
            )}
            {collapsed && <div className="border-t border-border/40 my-2" />}
          </div>

          {/* 4. Help Component */}
          <SidebarItem
            label="Help & Guide"
            icon={<HelpCircle className="h-5 w-5" />}
            collapsed={collapsed}
            onClick={() => {
              setOpenHelp(true);
              onCloseMobile?.();
            }}
          />

          {/* 5. Settings Component */}
          <SidebarItem
            label="Settings"
            icon={<SettingsIcon className="h-5 w-5" />}
            collapsed={collapsed}
            onClick={() => {
              setOpenSettings(true);
              onCloseMobile?.();
            }}
          />
        </div>

        {/* 4. Footer Block */}
        <div className="px-3 pb-4 space-y-3 border-t border-border/40 pt-3 shrink-0">
          <ThemeToggle
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
          />
          <ProfileCard collapsed={collapsed} />
        </div>
      </aside>

      {/* Global Interactive Dialogs */}
      <HelpDialog open={openHelp} onOpenChange={setOpenHelp} />
      <SettingsDialog open={openSettings} onOpenChange={setOpenSettings} />
    </>
  );
}
