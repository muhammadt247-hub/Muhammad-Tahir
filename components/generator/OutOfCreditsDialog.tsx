'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins } from 'lucide-react';

interface OutOfCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance?: number;
}

export function OutOfCreditsDialog({
  open,
  onOpenChange,
  balance = 0,
}: OutOfCreditsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <Coins className="h-6 w-6" />
            <DialogTitle className="text-xl font-bold text-foreground">Out of credits</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            You have used all your credits. Contact support to add more.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Remaining balance:</span>
          <span className="font-mono text-base font-bold text-amber-500">
            {balance} {balance === 1 ? 'credit' : 'credits'}
          </span>
        </div>

        <DialogFooter className="flex sm:justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="default"
            onClick={() => onOpenChange(false)}
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
