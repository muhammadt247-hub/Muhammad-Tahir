'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarItemProps {
  href?: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
  collapsed?: boolean;
  badge?: string;
  onClick?: () => void;
  isActive?: boolean;
}

export function SidebarItem({
  href,
  label,
  icon,
  external = false,
  collapsed = false,
  badge,
  onClick,
  isActive: explicitIsActive,
}: SidebarItemProps) {
  const pathname = usePathname();
  const isActive =
    explicitIsActive !== undefined
      ? explicitIsActive
      : Boolean(
          href &&
            !external &&
            (pathname === href || (href !== '/' && pathname.startsWith(href)))
        );

  const innerContent = (
    <div
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 select-none text-left',
        isActive
          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        collapsed && 'justify-center px-0 w-10 h-10 mx-auto'
      )}
    >
      <div className="shrink-0">{icon}</div>

      {!collapsed && (
        <span className="truncate leading-none flex-1">{label}</span>
      )}

      {!collapsed && badge && (
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase">
          {badge}
        </span>
      )}
    </div>
  );

  // If no href is provided, render as a button (e.g. for dialog triggers like Help or Settings)
  if (!href) {
    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onClick}
              aria-label={label}
              className="block w-full focus:outline-none"
            >
              {innerContent}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="block w-full focus:outline-none"
      >
        {innerContent}
      </button>
    );
  }

  // If collapsed, wrap in Tooltip
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {external ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClick}
              className="block"
            >
              {innerContent}
            </a>
          ) : (
            <Link href={href} onClick={onClick} className="block">
              {innerContent}
            </Link>
          )}
        </TooltipTrigger>
        <TooltipContent side="right">
          {label} {external && '↗'}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Normal expanded link
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="block"
      >
        {innerContent}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onClick} className="block">
      {innerContent}
    </Link>
  );
}
