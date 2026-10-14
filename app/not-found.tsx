import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/Logo';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 p-6">
      <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25">
        <LogoMark size={36} />
      </div>
      <div className="space-y-1">
        <span className="text-xs font-mono font-bold tracking-wider text-primary uppercase">Error 404</span>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Page Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          The toolkit tool or resource you are looking for does not exist or has been moved.
        </p>
      </div>
      <div className="flex gap-3 pt-2">
        <Button asChild>
          <Link href="/adobe-analytics" className="gap-2">
            <Search className="h-4 w-4" />
            Adobe Analytics
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/generator" className="gap-2">
            <Home className="h-4 w-4" />
            Metadata Generator
          </Link>
        </Button>
      </div>
    </div>
  );
}
