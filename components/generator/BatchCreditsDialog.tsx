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
import { Coins, Sparkles } from 'lucide-react';

interface BatchCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  needed: number;
  balance: number;
  onGenerateFirst: (count: number) => void;
  onCancel: () => void;
}

export function BatchCreditsDialog({
  open,
  onOpenChange,
  needed,
  balance,
  onGenerateFirst,
  onCancel,
}: BatchCreditsDialogProps) {
  const handleConfirm = () => {
    onOpenChange(false);
    onGenerateFirst(balance);
  };

  const handleDismiss = () => {
    onOpenChange(false);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <Coins className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold text-foreground">
              This batch needs {needed} credits but you have {balance}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
            Your current credit balance is insufficient to process all {needed} images in this batch.
            You can generate the first {balance} files now, or cancel to add more credits before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3.5 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-between text-xs">
          <div className="space-y-0.5">
            <span className="text-muted-foreground text-[11px]">Needed for batch:</span>
            <p className="font-bold text-foreground text-sm">{needed} credits</p>
          </div>
          <div className="text-right space-y-0.5">
            <span className="text-muted-foreground text-[11px]">Your available balance:</span>
            <p className="font-bold text-amber-600 dark:text-amber-400 text-sm">{balance} credits</p>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            className="text-xs font-medium"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            className="text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Generate the first {balance} files</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
