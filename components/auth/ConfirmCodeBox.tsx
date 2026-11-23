'use client';

// "Type the code from the email" box on the Check-your-email screen (and on log in for unconfirmed accounts).
// Works even when the link in the email does not open, or the email was opened on another device.

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ConfirmCodeBox({ email, next = '/generator' }: { email: string; next?: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.replace(/\D/g, '');
    if (c.length < 6) {
      setError('Please type the full code from the email (all the numbers).');
      return;
    }
    if (!email.trim()) {
      setError('Please type your email address first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: c }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setError(j.error || 'That code did not work. Please try again.');
        return;
      }
      toast.success('Email confirmed! Welcome to OrbinexaCSV.');
      router.push(next);
      router.refresh();
    } catch {
      setError('Could not check the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 text-left">
      <label htmlFor="confirm-code" className="block text-xs font-semibold text-foreground">
        Got a code in the email? Type it here:
      </label>
      <div className="flex gap-2">
        <Input
          id="confirm-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={10}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="12345678"
          className="text-center font-mono text-lg tracking-[0.3em]"
        />
        <Button type="submit" disabled={busy} className="gap-1.5 shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Confirm
        </Button>
      </div>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </form>
  );
}
