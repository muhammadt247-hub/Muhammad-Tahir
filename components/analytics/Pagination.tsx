'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
}: PaginationProps) {
  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="flex items-center justify-center gap-3 pt-6 pb-8">
      {/* Previous Page */}
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrev}
        disabled={disabled || currentPage <= 1}
        className="gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Previous Page</span>
      </Button>

      {/* Page N Pill */}
      <div className="inline-flex items-center justify-center rounded-xl border border-border/60 bg-card px-4 h-10 text-xs font-semibold text-muted-foreground shadow-xs">
        Page {currentPage} of {Math.max(1, totalPages)}
      </div>

      {/* Next Page */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleNext}
        disabled={disabled || currentPage >= totalPages}
        className="gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold"
      >
        <span>Next Page</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
