'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export type Crumb = { label: string; href?: string; onClick?: () => void };

// "Home > Marketplace > ..." so people can always find their way back.
// Home is "/" (logged-in visitors are sent on to their home, the Generator).
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: 'Home', href: '/' }, ...items];
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-1 text-xs font-semibold text-muted-foreground">
        {all.map((c, i) => {
          const last = i === all.length - 1;
          const inner = (
            <>
              {i === 0 && <Home className="h-3.5 w-3.5" aria-hidden="true" />}
              <span className="truncate max-w-[14rem]">{c.label}</span>
            </>
          );
          const cls = 'inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:text-foreground hover:bg-accent transition-colors';
          return (
            <li key={i} className="inline-flex min-w-0 items-center gap-1">
              {last ? (
                <span aria-current="page" className="inline-flex items-center gap-1 px-1 py-0.5 text-foreground">
                  {inner}
                </span>
              ) : c.href ? (
                <Link href={c.href} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={c.onClick} className={cls}>
                  {inner}
                </button>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
