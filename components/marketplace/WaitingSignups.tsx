'use client';

// People who signed up but never confirmed their email (the email did not arrive).
// The Super Admin (or a moderator with "Help sign-ups") can activate an account after the person contacts them.
// The database checks the permission again and writes every activation to the action log.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';

interface Waiting {
  user_id: string;
  email: string;
  display_name: string;
  created_at: string;
  last_email_at: string | null;
}

function when(v: string | null): string {
  if (!v) return '-';
  return new Date(v).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function fetchWaiting(): Promise<{ rows: Waiting[]; error: string | null }> {
  const { data, error } = await createClient().rpc('mp_admin_waiting_signups');
  return { rows: (data ?? []) as Waiting[], error: error ? error.message : null };
}

export function WaitingSignups() {
  const [rows, setRows] = useState<Waiting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const apply = useCallback((res: { rows: Waiting[]; error: string | null }) => {
    setRows(res.rows);
    setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchWaiting().then((res) => {
      if (!cancelled) apply(res);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => r.email.toLowerCase().includes(t) || r.display_name.toLowerCase().includes(t)) : rows;
  }, [rows, q]);

  const activate = async (r: Waiting) => {
    if (
      !window.confirm(
        'Activate the account ' +
          r.email +
          '?\n\nOnly do this if this person contacted you (for example on WhatsApp) and you are sure this email is theirs.',
      )
    )
      return;
    setBusyId(r.user_id);
    const { error: err } = await createClient().rpc('mp_admin_confirm_signup', { p_user: r.user_id });
    setBusyId(null);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success(r.email + ' is active. They can log in now.');
    apply(await fetchWaiting());
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-1.5">
        <h2 className="text-lg font-bold text-foreground">Waiting sign-ups ({rows.length})</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          These people signed up in the last 30 days but did not confirm their email (usually because the email did not arrive).
          When someone contacts you on WhatsApp, find their email here and press <b>Activate account</b>. They can then log in
          with their password straight away. Only activate emails you are sure belong to that person.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or name" className="pl-9" />
      </div>

      {error && <p className="text-xs font-semibold text-red-600 break-words">{error}</p>}

      {loading ? (
        <Skeleton className="h-28" />
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? 'Nobody is waiting. Everyone confirmed their email.' : 'No email matches your search.'}
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <div
              key={r.user_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-foreground break-all">{r.email}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.display_name ? r.display_name + ' · ' : ''}signed up {when(r.created_at)} · last email sent {when(r.last_email_at)}
                </p>
              </div>
              <Button size="sm" className="gap-1.5" disabled={busyId === r.user_id} onClick={() => activate(r)}>
                <CheckCircle2 className="h-4 w-4" /> {busyId === r.user_id ? 'Activating...' : 'Activate account'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
