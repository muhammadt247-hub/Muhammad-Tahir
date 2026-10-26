'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Gift, Copy, Loader2 } from 'lucide-react';
import { getSiteUrl } from '@/lib/supabase/config';

interface ReferralInfo {
  code: string;
  friends: number;
  creditsEarned: number;
  maxFriends: number;
}

export function ReferralCard() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/referral', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((d) => {
        if (!cancelled) setInfo(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const link = info ? `${getSiteUrl()}/signup?ref=${info.code}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Referral link copied!');
    } catch {
      toast.error('Could not copy. Please select the link and copy it.');
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-border/50 p-6 space-y-4 md:col-span-2">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
          <Gift className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-foreground">Invite friends, get 100 credits</h2>
          <p className="text-xs text-muted-foreground">
            Share your link. When a friend signs up with it and confirms their email, you get 100
            credits. You can earn from up to 10 friends.
          </p>
        </div>
      </div>

      {failed && (
        <p className="text-xs text-destructive">Could not load your referral link. Please refresh.</p>
      )}

      {!info && !failed && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your link...
        </div>
      )}

      {info && (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
            <Button type="button" onClick={copy} className="gap-2 text-xs font-semibold shrink-0">
              <Copy className="h-3.5 w-3.5" /> Copy link
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl border border-border/50 p-3">
              <div className="text-lg font-bold text-foreground">
                {info.friends} / {info.maxFriends}
              </div>
              <div className="text-[11px] text-muted-foreground">Friends joined</div>
            </div>
            <div className="rounded-xl border border-border/50 p-3">
              <div className="text-lg font-bold text-foreground">{info.creditsEarned}</div>
              <div className="text-[11px] text-muted-foreground">Credits earned</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
