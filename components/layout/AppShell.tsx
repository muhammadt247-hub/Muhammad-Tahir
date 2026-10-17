'use client';

import React from 'react';
import { Header } from './Header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/components/AuthProvider';
import { CreditsProvider } from '@/components/CreditsProvider';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <AuthProvider>
      <CreditsProvider>
        <TooltipProvider delayDuration={150}>
          <div className="min-h-screen flex flex-col bg-background text-foreground w-full overflow-x-hidden">
            {/* Full-width sticky horizontal header */}
            <Header />
            {/* Scrollable main area: full width, no max-width, p-4 sm:p-6 */}
            <main className="flex-1 w-full p-4 sm:p-6">
              {children}
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </CreditsProvider>
    </AuthProvider>
  );
}
