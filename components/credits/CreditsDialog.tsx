'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, Mail, ArrowUpRight, ArrowDownLeft, Sparkles, AlertCircle } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';
import { useCredits } from '@/components/CreditsProvider';

interface CreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreditsDialog({ open, onOpenChange }: CreditsDialogProps) {
  const { balance, received, spent, transactions, loading } = useCredits();

  // Progress percentage (balance / received)
  const percent = received > 0 ? Math.min(100, Math.max(0, Math.round((balance / received) * 100))) : balance > 0 ? 100 : 0;

  // Color classes according to requirements:
  // dark orange normally, amber at 20 or fewer, red at 0
  const isZero = balance === 0;
  const isLow = balance > 0 && balance <= 20;

  const colorScheme = isZero
    ? {
        text: 'text-red-500 dark:text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        bar: 'bg-red-500',
      }
    : isLow
    ? {
        text: 'text-amber-500 dark:text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        bar: 'bg-amber-500',
      }
    : {
        text: 'text-orange-600 dark:text-orange-500',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        bar: 'bg-gradient-to-r from-orange-600 to-amber-500',
      };

  const supportMailto = `mailto:${SITE_CONFIG.SUPPORT_EMAIL}?subject=${encodeURIComponent(
    'Need more credits - OrbinexaCSV'
  )}&body=${encodeURIComponent(
    `Hello OrbinexaCSV Support,\n\nI would like to request more credits for my account.\nCurrent balance: ${balance}\n\nThank you!`
  )}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col font-poppins p-6 gap-5">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Coins className="h-5 w-5 text-orange-500" />
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
              Your credits
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            View your balance, usage history, and manage generation quotas.
          </DialogDescription>
        </DialogHeader>

        {/* Big Number Display */}
        <div className={`p-4 rounded-2xl border ${colorScheme.border} ${colorScheme.bg} flex flex-col items-center justify-center text-center space-y-1`}>
          <div className="flex items-center gap-2">
            <span className={`text-4xl sm:text-5xl font-extrabold tracking-tight font-mono ${colorScheme.text}`}>
              {balance}
            </span>
            <span className="text-lg font-semibold text-foreground/80 self-end mb-1">
              {balance === 1 ? 'credit left' : 'credits left'}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full pt-2">
            <div className="h-2 w-full bg-muted/80 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${colorScheme.bar}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3 Small Summary Tiles */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-3 rounded-xl bg-muted/50 border border-border/50 flex flex-col items-center">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Received</span>
            <span className="text-base sm:text-lg font-bold font-mono text-foreground mt-0.5">{received}</span>
          </div>
          <div className="p-3 rounded-xl bg-muted/50 border border-border/50 flex flex-col items-center">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Used</span>
            <span className="text-base sm:text-lg font-bold font-mono text-muted-foreground mt-0.5">{spent}</span>
          </div>
          <div className="p-3 rounded-xl bg-muted/50 border border-border/50 flex flex-col items-center">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Left</span>
            <span className={`text-base sm:text-lg font-bold font-mono mt-0.5 ${colorScheme.text}`}>{balance}</span>
          </div>
        </div>

        {/* Helpful Explanation */}
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-xs text-muted-foreground flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-foreground font-semibold">1 credit = 1 image.</strong> If an image fails, the credit is refunded automatically.
          </p>
        </div>

        {/* Last 10 Transactions List */}
        <div className="flex-1 min-h-[140px] max-h-[220px] overflow-y-auto space-y-2 pr-1">
          <div className="flex items-center justify-between pb-1 border-b border-border/40">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">Recent Activity</span>
            <span className="text-[11px] text-muted-foreground">Last {transactions.length} events</span>
          </div>

          {loading ? (
            <div className="py-6 text-center text-xs text-muted-foreground animate-pulse">
              Loading credit history...
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No transactions recorded yet.
            </div>
          ) : (
            transactions.map((tx, idx) => {
              const isPositive = tx.amount > 0;
              const dateStr = new Date(tx.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={`${tx.createdAt}-${idx}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-background/60 border border-border/40 text-xs hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isPositive
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-destructive/10 text-destructive border border-destructive/20'
                      }`}
                    >
                      {isPositive ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-foreground truncate capitalize">
                        {tx.reason || (tx.kind === 'grant' || tx.kind === 'bonus' ? 'Credit grant' : tx.kind === 'refund' ? 'Refund' : 'Generation')}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">{dateStr}</span>
                    </div>
                  </div>

                  <span
                    className={`font-mono font-bold text-sm shrink-0 ${
                      isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                    }`}
                  >
                    {isPositive ? `+${Math.abs(tx.amount)}` : `-${Math.abs(tx.amount)}`}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Contact Support Button */}
        <div className="pt-2 border-t border-border/40">
          <Button
            asChild
            variant="outline"
            className="w-full gap-2 border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors pop-10 text-xs sm:text-sm font-semibold h-11 rounded-xl"
          >
            <a href={supportMailto}>
              <Mail className="h-4 w-4 text-orange-500" />
              <span>Need more credits? Contact support</span>
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
