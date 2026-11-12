'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

interface MyStatus {
  id: string;
  body: string;
  created_at: string;
  expires_at: string;
}

// Vendor posts a short update that shows as a round icon on the marketplace for 24 hours.
export function VendorStatusManager() {
  const [items, setItems] = useState<MyStatus[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await createClient()
        .from('mp_vendor_status')
        .select('id, body, created_at, expires_at')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (!error) setItems((data ?? []) as MyStatus[]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async () => {
    const body = text.trim();
    if (busy || body.length < 3) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: chk, error: chkErr } = await supabase.rpc('mp_vendor_check_text', { p_texts: { status: body } });
      if (chkErr) throw new Error(chkErr.message);
      const res = chk as { ok: boolean; reason?: string };
      if (!res.ok) {
        toast.error(
          `Not allowed: your status has ${res.reason ?? 'contact details'}. Real names, phone numbers, WhatsApp and links are not allowed. This was reported to the admin.`,
          { duration: 9000 }
        );
        return;
      }
      const ai = await fetch('/api/marketplace/vendor-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: { status: body } }),
      });
      const aiRes = (await ai.json().catch(() => null)) as { ok?: boolean; reason?: string; error?: { message?: string } } | null;
      if (!ai.ok) throw new Error(aiRes?.error?.message ?? 'Safety check failed. Please try again.');
      if (aiRes && aiRes.ok === false) {
        toast.error(`Not allowed: the safety check says your status looks like a contact attempt (${aiRes.reason ?? 'contact details'}). This was reported to the admin.`, {
          duration: 9000,
        });
        return;
      }
      const { error } = await supabase.rpc('mp_vendor_post_status', { p_text: body });
      if (error) throw new Error(error.message);
      toast.success('Status posted. Customers see it for 24 hours.');
      setText('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not post the status');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await createClient().rpc('mp_vendor_delete_status', { p_id: id });
      if (error) throw new Error(error.message);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the status');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Status update</h2>
        <p className="text-xs text-muted-foreground">
          Share a short news line, like &quot;Fresh stock today&quot; or &quot;20% off this week&quot;. Customers see your round icon on the marketplace for 24
          hours. Up to 3 at a time. No phone numbers, links or real names.
        </p>
      </div>
      <div className="flex gap-2">
        <Input value={text} maxLength={140} onChange={(e) => setText(e.target.value)} placeholder="Write your update (3 to 140 characters)" />
        <Button disabled={busy || text.trim().length < 3} onClick={post}>
          Post
        </Button>
      </div>
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
              <div className="min-w-0">
                <p className="break-words text-sm text-foreground">{s.body}</p>
                <p className="text-[11px] text-muted-foreground">
                  Ends {new Date(s.expires_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => remove(s.id)}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
