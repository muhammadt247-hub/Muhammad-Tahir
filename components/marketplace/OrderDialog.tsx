'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { MpListing, formatPkr, buildOrderMessage, buildWhatsAppLink } from '@/lib/marketplace/shared';

// ---------- Order form (opens on top of the page) ----------
interface PlacedOrder {
  orderNo: string;
  link: string;
}

export function OrderDialog({
  listing,
  productName,
  onClose,
}: {
  listing: MpListing;
  productName: string;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    if (name.trim().length < 2) {
      setFormError('Please enter your name.');
      return;
    }
    if (!/^\+?[0-9 -]{7,20}$/.test(whatsapp.trim())) {
      setFormError('Please enter a valid WhatsApp number, for example +923001234567.');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('mp_create_order', {
        p_listing: listing.id,
        p_name: name.trim(),
        p_whatsapp: whatsapp.trim(),
        p_email: email.trim() || null,
        p_notes: notes.trim() || null,
      });
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      const orderNo: string | undefined = row?.out_order_no;
      if (!orderNo) throw new Error('The order was not created. Please try again.');
      const message = buildOrderMessage({
        orderNo,
        customerName: name.trim(),
        customerWhatsapp: whatsapp.trim(),
        customerEmail: email.trim(),
        productName,
        packageTitle: listing.title,
        vendorName: listing.vendor?.name ?? 'Vendor',
        price: listing.price,
        notes: notes.trim(),
      });
      setPlaced({ orderNo, link: buildWhatsAppLink(message) });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 bg-card p-5 sm:p-6 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {placed ? (
          <div className="space-y-4 text-center">
            <h2 className="text-xl font-extrabold text-foreground">Order saved</h2>
            <p className="text-sm text-muted-foreground">
              Your order ID is <span className="font-bold text-foreground">{placed.orderNo}</span>
            </p>
            <div className="rounded-xl bg-muted/50 p-3 text-left text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Next steps</p>
              <p>1. Press the green button to send your order on WhatsApp.</p>
              <p>2. We reply with the payment details. You pay only us.</p>
              <p>3. After we confirm your payment, the delivery time starts.</p>
            </div>
            <a
              href={placed.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white hover:opacity-90"
            >
              Send order on WhatsApp
            </a>
            <Link
              href="/marketplace/orders"
              className="block text-sm font-semibold text-primary hover:underline"
            >
              View my orders
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-foreground">Place your order</h2>
              <p className="text-sm text-muted-foreground">
                {productName} ({listing.title}) from {listing.vendor?.name ?? 'Vendor'}
              </p>
              <p className="text-lg font-extrabold text-foreground">
                {formatPkr(listing.price)}
                {listing.original_price !== null && (
                  <span className="ml-2 text-sm font-medium text-muted-foreground line-through">{formatPkr(listing.original_price)}</span>
                )}
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Your name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Your WhatsApp number</label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+923001234567"
                maxLength={20}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Email (optional)</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Notes (optional)</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            </div>

            {formError && <p className="text-xs font-semibold text-red-600 break-words">{formError}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={busy} className="flex-1">
                {busy ? 'Saving...' : 'Place order'}
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              You do not pay now. We contact you on WhatsApp with the payment details.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
