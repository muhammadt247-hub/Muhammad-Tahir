'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { KIND_INFO, StatusRound, type StatusKind } from '@/components/marketplace/StatusStrip';

interface MyStatus {
  id: string;
  title: string;
  body: string;
  kind: StatusKind;
  icon: string | null;
  image_path: string | null;
  expires_at: string;
}

interface LivePackage {
  id: string;
  product_name: string;
  title: string;
  status: string;
}

const MAX_SIDE = 1080;
const MAX_BYTES = 450000;
const ICONS = ['🔥', '📦', '🎁', '⭐', '🆕', '💥', '🎉', '⚡', '🛒', '💎', '📢', '✅'];
const KINDS: StatusKind[] = ['offer', 'stock', 'news'];
const KIND_HELP: Record<StatusKind, string> = {
  offer: 'A discount or deal. Example: "20% off this week".',
  stock: 'You have new or refilled stock. Example: "ChatGPT Plus back in stock".',
  news: 'Anything else customers should know. Example: "Faster delivery from today".',
};

// Shrinks any picture to a JPG under about 450 KB (longest side 1080 px) in the browser
async function shrinkImage(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read the image');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  let q = 0.85;
  let url = canvas.toDataURL('image/jpeg', q);
  while (url.length * 0.75 > MAX_BYTES && q > 0.4) {
    q -= 0.1;
    url = canvas.toDataURL('image/jpeg', q);
  }
  if (url.length * 0.75 > MAX_BYTES) throw new Error('This image is too detailed. Please choose a simpler picture.');
  return url;
}

// A vendor posts an offer, new stock or news. Customers see a round icon with the title on the marketplace for 24 hours.
export function VendorStatusManager() {
  const [items, setItems] = useState<MyStatus[]>([]);
  const [packages, setPackages] = useState<LivePackage[]>([]);
  const [kind, setKind] = useState<StatusKind>('offer');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [listingId, setListingId] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mp_vendor_status')
        .select('id, title, body, kind, icon, image_path, expires_at')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (!error) setItems((data ?? []) as MyStatus[]);
      const l = await supabase.rpc('mp_vendor_my_listings');
      if (!l.error) setPackages(((l.data ?? []) as LivePackage[]).filter((p) => p.status === 'active'));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a picture (JPG, PNG or WebP).');
      return;
    }
    try {
      setImage(await shrinkImage(file));
      setIcon(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not use this image');
    }
  };

  const post = async () => {
    const ti = title.trim();
    const body = text.trim();
    if (busy || ti.length < 3) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const texts: Record<string, string> = { status_title: ti };
      if (body) texts.status = body;

      const { data: chk, error: chkErr } = await supabase.rpc('mp_vendor_check_text', { p_texts: texts });
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
        body: JSON.stringify({ texts }),
      });
      const aiRes = (await ai.json().catch(() => null)) as { ok?: boolean; reason?: string; error?: { message?: string } } | null;
      if (!ai.ok) throw new Error(aiRes?.error?.message ?? 'Safety check failed. Please try again.');
      if (aiRes && aiRes.ok === false) {
        toast.error(`Not allowed: the safety check says your text looks like a contact attempt (${aiRes.reason ?? 'contact details'}). This was reported to the admin.`, {
          duration: 9000,
        });
        return;
      }

      let path: string | null = null;
      if (image) {
        const up = await fetch('/api/marketplace/status-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image }),
        });
        const upRes = (await up.json().catch(() => null)) as { ok?: boolean; path?: string; reason?: string; error?: { message?: string } } | null;
        if (!up.ok) throw new Error(upRes?.error?.message ?? 'Could not check the image. Please try again.');
        if (!upRes || upRes.ok === false || !upRes.path) {
          toast.error(`Not allowed: the safety check says your image shows contact details or is not suitable (${upRes?.reason ?? 'not allowed'}). This was reported to the admin.`, {
            duration: 9000,
          });
          return;
        }
        path = upRes.path;
      }

      const { error } = await supabase.rpc('mp_vendor_post_status', {
        p_title: ti,
        p_text: body,
        p_kind: kind,
        p_icon: path ? null : icon ?? KIND_INFO[kind].icon,
        p_image: path,
        p_listing: listingId || null,
      });
      if (error) throw new Error(error.message);
      toast.success('Posted. Customers see it for 24 hours.');
      setTitle('');
      setText('');
      setIcon(null);
      setImage(null);
      setListingId('');
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not post');
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
      toast.error(e instanceof Error ? e.message : 'Could not delete');
    } finally {
      setBusy(false);
    }
  };

  const previewIcon = icon ?? KIND_INFO[kind].icon;

  return (
    <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Status: offers, new stock and news</h2>
        <p className="text-xs text-muted-foreground">
          Customers see your round icon with a short title at the top of the marketplace. They tap it to read it in full screen. It plays for 10 seconds, and
          stays for 24 hours. Up to 3 at a time, 10 per day.
        </p>
      </div>

      {/* 1. type */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground">1. What is it about?</label>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={
                'rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ' +
                (kind === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:bg-accent')
              }
            >
              {KIND_INFO[k].icon} {KIND_INFO[k].big}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{KIND_HELP[kind]}</p>
      </div>

      {/* 2. title and message */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground">2. Title (shown under your round icon)</label>
        <Input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder='Example: "20% off CapCut Pro"' />
        <label className="text-xs font-semibold text-foreground">Message (optional, shown big when customers open it)</label>
        <Input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder='Example: "Valid until Sunday. Delivery within 2 hours."' />
        <p className="text-[11px] text-muted-foreground">
          Title: 3 to 40 characters. Message: up to 200. No phone numbers, WhatsApp, links, social names or real names, in text or in pictures. These are
          checked automatically, and attempts are reported to the admin.
        </p>
      </div>

      {/* 3. round icon or picture */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground">3. Round icon: pick one, or upload a picture</label>
        <div className="flex flex-wrap gap-2">
          {ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => {
                setIcon(ic);
                setImage(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              className={
                'grid h-11 w-11 place-items-center rounded-full border text-xl transition-colors ' +
                (!image && icon === ic ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-accent')
              }
            >
              {ic}
            </button>
          ))}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="mr-1.5 h-4 w-4" /> Upload picture
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          A picture becomes your round icon and also shows big inside. Best size: 1080 x 1080 (square) or 1080 x 1920 (tall). JPG, PNG or WebP. We shrink it for
          you.
        </p>
        {image && (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Preview" className="h-32 rounded-xl border border-border/60 object-cover" />
            <button
              type="button"
              aria-label="Remove picture"
              onClick={() => {
                setImage(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
              className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 4. link */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground">4. Link to a package (optional, adds a &quot;See this package&quot; button)</label>
        <select
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
          className="h-10 w-full rounded-lg border border-border/60 bg-card px-3 text-sm"
        >
          <option value="">No link</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.product_name} ({p.title})
            </option>
          ))}
        </select>
      </div>

      {/* preview */}
      <div className="flex items-center gap-4 rounded-xl bg-muted/50 p-3">
        <span className="h-20 w-20 shrink-0 rounded-full bg-gradient-to-br from-primary via-orange-400 to-amber-300 p-[3px]">
          <span className="block h-full w-full rounded-full bg-card p-[2px]">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <span className={`grid h-full w-full place-items-center rounded-full bg-gradient-to-br ${KIND_INFO[kind].bg} text-4xl`}>{previewIcon}</span>
            )}
          </span>
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">How customers see it</p>
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${KIND_INFO[kind].pill}`}>{KIND_INFO[kind].big}</span>
          <p className="line-clamp-2 text-sm font-bold text-foreground">{title.trim() || 'Your title'}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button disabled={busy || title.trim().length < 3} onClick={post}>
          {busy ? 'Checking...' : 'Post to customers'}
        </Button>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Your active posts</p>
          {items.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  <StatusRound s={s} size="lg" />
                </span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold text-foreground">
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${KIND_INFO[s.kind].pill}`}>{KIND_INFO[s.kind].big}</span>
                    {s.title}
                  </p>
                  {s.body && <p className="break-words text-xs text-muted-foreground">{s.body}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    Ends {new Date(s.expires_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
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
