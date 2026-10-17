'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Sparkles,
  BarChart3,
  TrendingUp,
  ShieldAlert,
  DollarSign,
  Wand2,
  FileEdit,
  LayoutGrid,
  ChevronDown,
  HelpCircle,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Menu,
  X,
  Zap,
  User as UserIcon,
  LogOut,
} from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { TOOLS_REGISTRY } from '@/config/tools';
import { LogoMark } from '@/components/Logo';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpDialog } from './HelpDialog';
import { SettingsDialog } from './SettingsDialog';
import { useAuth } from '@/components/AuthProvider';

const TOOL_ICONS: Record<string, React.ReactNode> = {
  Sparkles: <Sparkles className="h-4 w-4" />,
  BarChart3: <BarChart3 className="h-4 w-4" />,
  TrendingUp: <TrendingUp className="h-4 w-4" />,
  ShieldAlert: <ShieldAlert className="h-4 w-4" />,
  DollarSign: <DollarSign className="h-4 w-4" />,
  Wand2: <Wand2 className="h-4 w-4" />,
  FileEdit: <FileEdit className="h-4 w-4" />,
};

export function Header() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(() => typeof window !== 'undefined');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileToolsExpanded, setMobileToolsExpanded] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const { user, profile, loading: authLoading, signOut } = useAuth();
  const isLoggedIn = !!user;

  // Close mobile menu on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  const isDark = mounted && resolvedTheme === 'dark';
  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Creator';
  const avatarLetter = (displayName.charAt(0) || 'C').toUpperCase();

  // Active state determination
  const isGenerator =
    pathname === '/generator' || pathname.startsWith('/generator/');
  const isAnalytics =
    pathname === '/adobe-analytics' || pathname.startsWith('/adobe-analytics/');
  const isTools =
    pathname === '/tools' || pathname.startsWith('/tools/');

  return (
    <>
      <header
        ref={mobileMenuRef}
        className="sticky top-0 z-40 w-full h-16 bg-card/80 backdrop-blur-md border-b border-border/50 shadow-xs px-4 sm:px-6 select-none overflow-visible"
      >
        <div className="flex h-full items-center justify-between gap-4">
          {/* LEFT: Brand & Logo */}
          <Link
            href={isLoggedIn ? '/generator' : '/login'}
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl shrink-0"
            aria-label="OrbinexaCSV Home"
          >
            {/* Logo Tile: two layers for pop-10 and logo-spin */}
            <div className="pop-10 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/25 logo-spin">
                <LogoMark size={24} />
              </div>
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold tracking-tight text-foreground leading-none">
                  {SITE_CONFIG.BRAND_NAME}
                </span>
                {/* Shimmer BETA Badge */}
                <div className="relative overflow-hidden rounded-full border border-orange-500/30 px-1.5 py-0.5 shrink-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                    {SITE_CONFIG.BADGE_TEXT}
                  </span>
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer pointer-events-none" />
                </div>
              </div>
              <span className="text-[9px] tracking-wider text-muted-foreground uppercase truncate hidden sm:block mt-0.5">
                {SITE_CONFIG.BRAND_CAPTION}
              </span>
            </div>
          </Link>

          {/* NAVIGATION: Desktop from md up, ONLY when logged in */}
          {isLoggedIn && (
            <nav className="hidden md:flex items-center gap-1 lg:gap-2 ml-6">
              {/* 1. Generator */}
              <Link
                href="/generator"
                className={cn(
                  'px-3 md:px-4 py-2 rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary pop-10',
                  isGenerator
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                Generator
              </Link>

              {/* 2. Adobe Analytics */}
              <Link
                href="/adobe-analytics"
                className={cn(
                  'px-3 md:px-4 py-2 rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary pop-10',
                  isAnalytics
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                Adobe Analytics
              </Link>

              {/* 3. All Tools Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer pop-10',
                      isTools
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                    aria-label="All Tools Menu"
                  >
                    <span>All Tools</span>
                    <ChevronDown className="h-4 w-4 opacity-75" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={8}
                  className="w-80 p-2 rounded-2xl shadow-xl border border-border/60 bg-card z-50"
                >
                  <DropdownMenuLabel className="flex items-center justify-between text-xs text-muted-foreground px-2 py-1.5">
                    <span className="font-semibold text-foreground">OrbinexaCSV Toolkit</span>
                    <Link
                      href="/tools"
                      className="text-[11px] text-primary hover:underline font-semibold"
                    >
                      View all &rarr;
                    </Link>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-1 border-border/40" />
                  <div className="max-h-[380px] overflow-y-auto space-y-1">
                    {TOOLS_REGISTRY.map((tool) => {
                      const isLive = tool.status === 'live';
                      const icon = TOOL_ICONS[tool.iconName] || <LayoutGrid className="h-4 w-4" />;
                      if (isLive) {
                        return (
                          <DropdownMenuItem
                            key={tool.id}
                            asChild
                            className="p-2.5 rounded-xl cursor-pointer focus:bg-accent transition-colors"
                          >
                            <Link href={tool.href} className="flex items-start gap-3 w-full">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                                {icon}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-foreground">
                                    {tool.name}
                                  </span>
                                  {tool.badge && (
                                    <span className="text-[9px] bg-primary/15 text-primary font-bold px-1.5 py-0.2 rounded-full">
                                      {tool.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                  {tool.description}
                                </p>
                              </div>
                            </Link>
                          </DropdownMenuItem>
                        );
                      }
                      return (
                        <DropdownMenuItem
                          key={tool.id}
                          disabled
                          className="p-2.5 rounded-xl flex items-start gap-3 opacity-60 cursor-not-allowed"
                        >
                          <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                            {icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-foreground">
                                {tool.name}
                              </span>
                              <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-medium shrink-0">
                                Coming soon
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {tool.description}
                            </p>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          )}

          {/* RIGHT: Actions */}
          <div className="ml-auto flex items-center gap-2">
            {/* If Logged In: Show Chrome Ext, Help, Settings, Theme, and Avatar */}
            {isLoggedIn ? (
              <>
                {/* Chrome Extension Pill */}
                {SITE_CONFIG.CHROME_EXTENSION_URL && (
                  <a
                    href={SITE_CONFIG.CHROME_EXTENSION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="Get Chrome Extension"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>Get Extension</span>
                  </a>
                )}

                {/* Help Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setHelpOpen(true)}
                      className="hidden md:flex h-9 w-9 rounded-full items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Help & Guide"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Help & Guide</TooltipContent>
                </Tooltip>

                {/* Settings Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="hidden md:flex h-9 w-9 rounded-full items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Workspace Settings"
                    >
                      <SettingsIcon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>

                {/* Theme Toggle Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="h-9 w-9 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isDark ? 'Light Mode' : 'Dark Mode'}</TooltipContent>
                </Tooltip>

                {/* Avatar Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 via-amber-600 to-orange-600 text-white font-bold text-sm flex items-center justify-center shadow-md shadow-primary/25 border-2 border-primary/30 hover:scale-105 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer select-none"
                      aria-label="User Account Menu"
                    >
                      {avatarLetter}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    className="w-60 p-2 rounded-2xl shadow-xl border border-border/60 bg-card z-50"
                  >
                    <div className="px-3 py-2 border-b border-border/40">
                      <p className="text-xs font-bold text-foreground truncate">{displayName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="pt-1">
                      <DropdownMenuItem asChild className="p-2.5 rounded-xl cursor-pointer focus:bg-accent transition-colors">
                        <Link href="/account" className="flex items-center gap-2.5 w-full text-xs font-semibold text-foreground">
                          <UserIcon className="h-4 w-4 text-primary" />
                          <span>Account</span>
                        </Link>
                      </DropdownMenuItem>
                    </div>
                    <DropdownMenuSeparator className="my-1 border-border/40" />
                    <DropdownMenuItem
                      onClick={signOut}
                      className="p-2.5 rounded-xl cursor-pointer focus:bg-destructive/10 text-destructive text-xs font-semibold flex items-center gap-2.5 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mobile Hamburger Button (below md) */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  className="flex md:hidden h-9 w-9 rounded-full items-center justify-center text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </>
            ) : (
              /* If Logged Out: ONLY Theme button + Log in / Sign up buttons */
              <>
                {/* Theme Toggle Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="h-9 w-9 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isDark ? 'Light Mode' : 'Dark Mode'}</TooltipContent>
                </Tooltip>

                {/* Log In Link */}
                <Link
                  href="/login"
                  className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Log in
                </Link>

                {/* Sign Up Link */}
                <Link
                  href="/signup"
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/25 pop-10"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>

        {/* MOBILE DROPDOWN PANEL (below md) - only when logged in */}
        {isLoggedIn && mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 border-b border-border/50 bg-card/95 backdrop-blur-md shadow-2xl p-4 space-y-3 z-50 animate-in fade-in slide-in-from-top-2 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="space-y-1">
              {/* Generator */}
              <Link
                href="/generator"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                  isGenerator
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Sparkles className="h-4 w-4" />
                <span>Generator</span>
              </Link>

              {/* Adobe Analytics */}
              <Link
                href="/adobe-analytics"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                  isAnalytics
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Adobe Analytics</span>
              </Link>

              {/* All Tools Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => setMobileToolsExpanded((prev) => !prev)}
                  className={cn(
                    'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                    isTools
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <LayoutGrid className="h-4 w-4" />
                    <span>All Tools</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      mobileToolsExpanded && 'rotate-180'
                    )}
                  />
                </button>

                {mobileToolsExpanded && (
                  <div className="pl-4 pr-1 py-2 space-y-1 mt-1 border-l-2 border-border/40 ml-4">
                    <Link
                      href="/tools"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      View All Tools Overview &rarr;
                    </Link>
                    {TOOLS_REGISTRY.map((tool) => {
                      const isLive = tool.status === 'live';
                      const icon = TOOL_ICONS[tool.iconName] || <LayoutGrid className="h-3.5 w-3.5" />;
                      if (isLive) {
                        return (
                          <Link
                            key={tool.id}
                            href={tool.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-foreground hover:bg-accent"
                          >
                            <span className="text-primary">{icon}</span>
                            <span className="truncate">{tool.name}</span>
                          </Link>
                        );
                      }
                      return (
                        <div
                          key={tool.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground opacity-60"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span>{icon}</span>
                            <span className="truncate">{tool.name}</span>
                          </div>
                          <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                            Soon
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 space-y-1">
              {/* Account Link in mobile */}
              <Link
                href="/account"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <UserIcon className="h-4 w-4" />
                <span>Account</span>
              </Link>

              {/* Help */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setHelpOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
                <span>Help & Guide</span>
              </button>

              {/* Settings */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <SettingsIcon className="h-4 w-4" />
                <span>Settings</span>
              </button>

              {/* Sign out */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Global Interactive Dialogs */}
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
