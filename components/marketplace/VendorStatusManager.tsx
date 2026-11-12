'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { statusImageUrl } from '@/lib/marketplace/shared';

interface MyStatus {
  id: string;
  body: string;
  image_path: string | null;
  created_at: string;
  expires_at: string;
}

const MAX_SIDE = 1080;
const MAX_BYTES = 450000;

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

// Vendor posts a short update (text and/or a picture). It shows as a round icon on the marketplace for 24 hours.
export function VendorStatusManager() {
  const [items, setItems] = useState<MyStatus[]>([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await createClient()
        .from('mp_vendor_status')
        .select('id, body, image_path, created_at, expires_at')
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

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a picture (JPG, PNG or WebP).');
      return;
    }
    try {
      setImage(await shrinkImage(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not use this image');
    }
  };

  const post = async () => {
    const body = text.trim();
    if (busy || (!image && body.length < 3)) return;
    setBusy(true);
    try {
      const supabase = createClient();
      if (body) {
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
          toast.error(`Not allowed: the safety check says your text looks like a contact attempt (${aiRes.reason ?? 'contact details'}). This was reported to the admin.`, {
            duration: 9000,
          });
          return;
        }
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
      const { error } = await supabase.rpc('mp_vendor_post_status', { p_text: body, p_image: path });
      if (error) throw new Error(error.message);
      toast.success('Status posted. Customers see it for 24 hours.');
      setText('');
      setImage(null);
      if (fileRef.current) fileRef.current.value = '';
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
    <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Status update</h2>
        <p className="text-xs text-muted-foreground">
          Post news that customers see as your round icon on the marketplace. Use a picture, or text, or both.
        </p>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>
          <b className="text-foreground">Picture:</b> best size 1080 x 1920 (tall) or 1080 x 1080 (square). Any JPG, PNG or WebP works. We shrink it
          for you to under 450 KB.
        </li>
        <li>
          <b className="text-foreground">Text:</b> 3 to 140 characters. Short is best, for example &quot;Fresh stock today&quot; or &quot;20% off this
          week&quot;. With a picture, the text shows at the bottom as a caption.
        </li>
        <li>
          <b className="text-foreground">Time:</b> each status plays for 10 seconds. Customers can press and hold to pause and read. It stays for 24 hours,
          then disappears. Up to 3 at a time, 10 per day.
        </li>
        <li>
          <b className="text-foreground">Not allowed:</b> phone numbers, WhatsApp, links, social names, QR codes or real names, in the text or inside the
          picture. Pictures are checked automatically, and attempts are reported to the admin.
        </li>
      </ul>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Input value={text} maxLength={140} onChange={(e) => setText(e.target.value)} placeholder="Write your update (3 to 140 characters)" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="mr-1.5 h-4 w-4" /> Picture
          </Button>
        </div>
        {image && (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Preview" className="h-40 rounded-xl border border-border/60 object-cover" />
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
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{text.length}/140</span>
          <Button disabled={busy || (!image && text.trim().length < 3)} onClick={post}>
            {busy ? 'Checking...' : 'Post status'}
          </Button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
              <div className="flex min-w-0 items-center gap-3">
                {s.image_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={statusImageUrl(s.image_path)} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0">
                  <p className="break-words text-sm text-foreground">{s.body || '(picture only)'}</p>
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
