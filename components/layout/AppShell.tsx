'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/components/AuthProvider';
import { CreditsProvider } from '@/components/CreditsProvider';
import { CoffeeSupport } from '@/components/support/CoffeeSupport';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const fullBleed = pathname === '/'; // the landing page uses the whole width, edge to edge
  return (
    <AuthProvider>
      <CreditsProvider>
        <TooltipProvider delayDuration={150}>
          {/* transparent, so the page atmosphere (glow, dot grid) shows through */}
          <div className="min-h-screen flex flex-col text-foreground w-full overflow-x-hidden">
            {/* Full-width sticky horizontal header */}
            <Header />
            <main className={fullBleed ? 'flex-1 w-full' : 'flex-1 w-full p-4 sm:p-6'}>
              {children}
            </main>
          </div>
          <Toaster />
          <CoffeeSupport />
        </TooltipProvider>
      </CreditsProvider>
    </AuthProvider>
  );
}
