'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Sparkles,
  BarChart3,
  Wand2,
  LayoutGrid,
  ChevronDown,
  HelpCircle,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Menu,
  X,
  Zap,
  Gift,
  User as UserIcon,
  LogOut,
  Coins,
} from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { LogoMark } from '@/components/Logo';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { HelpDialog } from './HelpDialog';
import { SettingsDialog } from './SettingsDialog';
import { useAuth } from '@/components/AuthProvider';
import { useCredits } from '@/components/CreditsProvider';
import { CreditsDialog } from '@/components/credits/CreditsDialog';

const RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
const ACTIVE = 'bg-primary text-primary-foreground shadow-md shadow-primary/25';
const IDLE = 'text-muted-foreground hover:text-foreground hover:bg-accent';
const MOBILE_ROW =
  'w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors';

export function Header() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted] = useState(() => typeof window !== 'undefined');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const { user, profile, signOut } = useAuth();
  const isLoggedIn = !!user;
  const {
    balance,
    received,
    loading: creditsLoading,
    hasError: creditsError,
    isDialogOpen,
    setIsDialogOpen,
    openDialog,
    refresh: refreshCredits,
  } = useCredits();

  const creditPercent =
    received > 0
      ? Math.min(100, Math.max(0, (balance / received) * 100))
      : balance > 0
      ? 100
      : 0;
  const isCreditZero = balance === 0;
  const isCreditLow = balance > 0 && balance <= 20;

  const creditsLabel = creditsError
    ? 'Unavailable'
    : isCreditZero
    ? 'Out of credits'
    : received > 0
    ? `${balance} left of ${received}`
    : `${balance} left`;

  const creditColors = isCreditZero
    ? {
        text: 'text-red-500 dark:text-red-400',
        bg: 'bg-red-500/10 hover:bg-red-500/15',
        border: 'border-red-500/30 hover:border-red-500/50',
        bar: 'bg-red-500',
      }
    : isCreditLow
    ? {
        text: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-500/10 hover:bg-amber-500/15',
        border: 'border-amber-500/30 hover:border-amber-500/50',
        bar: 'bg-amber-500',
      }
    : {
        text: 'text-orange-600 dark:text-orange-500',
        bg: 'bg-orange-500/10 hover:bg-orange-500/15',
        border: 'border-orange-500/30 hover:border-orange-500/50',
        bar: 'bg-gradient-to-r from-orange-600 to-amber-500',
      };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Creator';
  const avatarLetter = (displayName.charAt(0) || 'C').toUpperCase();

  const isGenerator = pathname === '/generator' || pathname.startsWith('/generator/');
  const isTools = pathname === '/tools' || pathname.startsWith('/tools/');

  const themeButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={toggleTheme}
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-colors',
            RING
          )}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent>{isDark ? 'Light Mode' : 'Dark Mode'}</TooltipContent>
    </Tooltip>
  );

  return (
    <>
      <header
        ref={mobileMenuRef}
        className="sticky top-0 z-40 w-full h-16 bg-card/80 backdrop-blur-md border-b border-border/50 shadow-xs px-4 sm:px-6 select-none overflow-visible"
      >
        <div className="flex h-full items-center justify-between gap-4">
          {/* LEFT: Brand and logo */}
          <Link
            href={isLoggedIn ? '/generator' : '/login'}
            className={cn('flex items-center gap-3 group rounded-xl shrink-0', RING)}
            aria-label="OrbinexaCSV Home"
          >
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

          {/* DESKTOP NAVIGATION (logged in only) */}
          {isLoggedIn && (
            <nav className="hidden md:flex items-center gap-1 lg:gap-2 ml-6">
              <Link
                href="/generator"
                className={cn(
                  'px-3 md:px-4 py-2 rounded-xl text-sm font-semibold transition-all pop-10',
                  RING,
                  isGenerator ? ACTIVE : IDLE
                )}
              >
                Generator
              </Link>

              <span
                className="px-3 md:px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground/60 cursor-not-allowed inline-flex items-center gap-1.5 select-none"
                aria-disabled="true"
              >
                Adobe Analytics
                <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-medium">
                  Coming soon
                </span>
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'px-3 md:px-4 py-2 rounded-xl text-sm font-semibold transition-all inline-flex items-center gap-1.5 pop-10',
                      RING,
                      isTools ? ACTIVE : IDLE
                    )}
                  >
                    All Tools
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={8}
                  className="w-60 p-2 rounded-2xl shadow-xl border border-border/60 bg-card z-50"
                >
                  <DropdownMenuItem asChild className="p-2.5 rounded-xl cursor-pointer focus:bg-accent transition-colors">
                    <Link
                      href="/tools/background-remover"
                      className="flex items-center gap-2.5 w-full text-xs font-semibold text-foreground"
                    >
                      <Wand2 className="h-4 w-4 text-primary" />
                      <span>Background Remover</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 border-border/40" />
                  <DropdownMenuItem asChild className="p-2.5 rounded-xl cursor-pointer focus:bg-accent transition-colors">
                    <Link
                      href="/tools"
                      className="flex items-center gap-2.5 w-full text-xs font-semibold text-foreground"
                    >
                      <LayoutGrid className="h-4 w-4 text-primary" />
                      <span>See all tools</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('open-coffee-dialog'))}
                className={cn(
                  'px-3 md:px-4 py-2 rounded-xl text-sm font-bold bg-amber-400 text-black hover:bg-amber-300 transition-colors shadow-sm pop-10',
                  RING
                )}
              >
                ☕ Buy me coffee
              </button>
            </nav>
          )}

          {/* CENTER: Referral link */}
          {isLoggedIn && (
            <div className="hidden lg:flex flex-1 justify-center px-2">
              <Link
                href="/account"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/20 transition-colors',
                  RING
                )}
              >
                <Gift className="h-4 w-4" />
                <span>Invite friends, get 100 credits</span>
              </Link>
            </div>
          )}

          {/* RIGHT: Actions */}
          <div className="ml-auto flex items-center gap-2">
            {isLoggedIn ? (
              <>
                {SITE_CONFIG.CHROME_EXTENSION_URL && (
                  <a
                    href={SITE_CONFIG.CHROME_EXTENSION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors',
                      RING
                    )}
                    aria-label="Get Chrome Extension"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>Get Extension</span>
                  </a>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setHelpOpen(true)}
                      className={cn(
                        'hidden md:flex h-9 w-9 rounded-full items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
                        RING
                      )}
                      aria-label="Help & Guide"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Help & Guide</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className={cn(
                        'hidden md:flex h-9 w-9 rounded-full items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
                        RING
                      )}
                      aria-label="Workspace Settings"
                    >
                      <SettingsIcon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Settings</TooltipContent>
                </Tooltip>

                {themeButton}

                {/* Credits badge */}
                {creditsLoading ? (
                  <Skeleton className="h-9 w-24 sm:w-28 rounded-full" />
                ) : creditsError ? (
                  <div
                    className="flex items-center gap-1.5 px-3 h-9 rounded-full border border-border/60 bg-muted/40 text-muted-foreground text-xs select-none"
                    aria-label="Credits unavailable"
                  >
                    <Coins className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-[11px] whitespace-nowrap">Credits unavailable</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        refreshCredits();
                      }}
                      className="ml-1 text-[11px] font-semibold underline text-foreground/80 hover:text-foreground cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={openDialog}
                        className={cn(
                          'flex flex-col justify-center px-2.5 sm:px-3 h-9 rounded-full border transition-all pop-10 cursor-pointer select-none',
                          RING,
                          creditColors.bg,
                          creditColors.border,
                          creditColors.text
                        )}
                        aria-label={`Your credits: ${balance} left of ${received}. Click to view history.`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs font-mono leading-none">
                          <Coins className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                          {isCreditZero ? (
                            <>
                              <span className="sm:hidden font-bold">0</span>
                              <span className="hidden sm:inline font-sans text-[11px] font-bold">Out of credits</span>
                            </>
                          ) : (
                            <>
                              <span className="sm:hidden">
                                {received > 0 ? `${balance}/${received}` : `${balance}`}
                              </span>
                              <span className="hidden sm:inline">{creditsLabel}</span>
                            </>
                          )}
                        </div>
                        <div className="w-full h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden mt-1">
                          <div
                            className={cn('h-full rounded-full transition-all duration-300', creditColors.bar)}
                            style={{ width: `${creditPercent}%` }}
                          />
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isCreditZero
                        ? 'Out of credits · Click to view history'
                        : `${balance} left of ${received} credits · Click to view history`}
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Avatar menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 via-amber-600 to-orange-600 text-white font-bold text-sm flex items-center justify-center shadow-md shadow-primary/25 border-2 border-primary/30 hover:scale-105 active:scale-95 transition-all cursor-pointer select-none',
                        RING
                      )}
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
                      <DropdownMenuItem
                        onClick={openDialog}
                        className="p-2.5 rounded-xl cursor-pointer focus:bg-accent transition-colors flex items-center justify-between text-xs font-semibold text-foreground"
                      >
                        <div className="flex items-center gap-2.5">
                          <Coins className="h-4 w-4 text-orange-500" />
                          <span>Credits</span>
                        </div>
                        <span
                          className={cn(
                            'font-mono text-[11px] font-bold',
                            creditsError ? 'text-muted-foreground' : creditColors.text
                          )}
                        >
                          {creditsLabel}
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="p-2.5 rounded-xl cursor-pointer focus:bg-accent transition-colors">
                        <Link
                          href="/account"
                          className="flex items-center gap-2.5 w-full text-xs font-semibold text-foreground"
                        >
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

                {/* Mobile hamburger */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  className={cn(
                    'flex md:hidden h-9 w-9 rounded-full items-center justify-center text-foreground hover:bg-accent transition-colors',
                    RING
                  )}
                  aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </>
            ) : (
              <>
                {themeButton}
                <Link
                  href="/login"
                  className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Log in
                </Link>
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

        {/* MOBILE PANEL (logged in only) */}
        {isLoggedIn && mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 border-b border-border/50 bg-card/95 backdrop-blur-md shadow-2xl p-4 space-y-3 z-50 animate-in fade-in slide-in-from-top-2 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="space-y-1">
              <Link
                href="/generator"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                  isGenerator ? ACTIVE : IDLE
                )}
              >
                <Sparkles className="h-4 w-4" />
                <span>Generator</span>
              </Link>

              <div
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground/60 cursor-not-allowed select-none"
                aria-disabled="true"
              >
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="h-4 w-4" />
                  <span>Adobe Analytics</span>
                </div>
                <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md font-medium">
                  Coming soon
                </span>
              </div>

              <Link
                href="/tools/background-remover"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                  isTools ? ACTIVE : IDLE
                )}
              >
                <Wand2 className="h-4 w-4" />
                <span>Background Remover</span>
              </Link>

              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('open-coffee-dialog'))}
                className="w-full flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-bold bg-amber-400 text-black hover:bg-amber-300 transition-colors"
              >
                ☕ Buy me coffee
              </button>
            </div>

            <div className="pt-2 border-t border-border/40 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openDialog();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Coins className="h-4 w-4 text-orange-500" />
                  <span>Credits</span>
                </div>
                <span
                  className={cn(
                    'font-mono text-xs font-bold',
                    creditsError ? 'text-muted-foreground' : creditColors.text
                  )}
                >
                  {creditsLabel}
                </span>
              </button>

              <Link href="/account" onClick={() => setMobileMenuOpen(false)} className={MOBILE_ROW}>
                <UserIcon className="h-4 w-4" />
                <span>Account</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setHelpOpen(true);
                }}
                className={MOBILE_ROW}
              >
                <HelpCircle className="h-4 w-4" />
                <span>Help & Guide</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className={MOBILE_ROW}
              >
                <SettingsIcon className="h-4 w-4" />
                <span>Settings</span>
              </button>

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

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CreditsDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </>
  );
}