'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 p-6">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
        <AlertCircle className="h-8 w-8" />
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {error?.message || 'An unexpected error occurred in the workspace toolkit.'}
        </p>
      </div>
      <Button onClick={() => reset()} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Reload Toolkit
      </Button>
    </div>
  );
}
