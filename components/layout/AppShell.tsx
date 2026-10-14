'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { MobileTopBar } from './MobileTopBar';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useLocalStorage<boolean>('sidebar_collapsed', false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMobileOpen(false);
  }

  // Close mobile drawer on Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
          className="hidden lg:flex"
        />

        {/* Mobile Off-Canvas Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            />
            {/* Drawer */}
            <div className="relative z-50 flex h-full w-[260px] animate-in slide-in-from-left duration-250">
              <Sidebar
                collapsed={false}
                onToggleCollapse={() => {}}
                onCloseMobile={() => setMobileOpen(false)}
                className="w-[260px] h-full shadow-2xl"
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <MobileTopBar onOpenSidebar={() => setMobileOpen(true)} />
          <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="w-full space-y-8">
              {children}
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
