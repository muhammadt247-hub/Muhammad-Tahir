'use client';

// Two compact, slowly moving rows on the home page (logged-in home = generator page):
// 1) the cheapest live packages, 2) live vendor offers. Real data from the marketplace tables.
// Click a card -> the package or offer in the shop. "Buy now" -> the same order form as the shop.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Flame, Store, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { OrderDialog } from '@/components/marketplace/OrderDialog';
import { detailsSummary } from '@/components/marketplace/PackageDetailsForm';
import { byPriceAsc } from '@/lib/marketplace/search';
import { MARKETPLACE_ENABLED, MpListing, RawListingRow, formatPkr, toListing } from '@/lib/marketplace/shared';

const MAX_CARDS = 16;
const SPEED = 28; // pixels per second, slow and calm
const REFRESH_MS = 60_000; // reload at most once a minute, when the tab comes back into view

type Row = RawListingRow & {
  status?: string;
  mp_products: { name: string } | { name: string }[] | null;
};
type Pkg = MpListing & { productName: string };

interface StatusRow {
  id: string;
  vendor_id: string;
  vendor_name: string;
  title: string;
  body: string;
  kind: 'offer' | 'stock' | 'news';
  product_id: string | null;
  listing_title: string | null;
  expires_at: string;
}

interface OfferItem {
  key: string;
  title: string;
  vendorName: string;
  description: string;
  price: number | null;
  originalPrice: number | null;
  percent: number | null;
  endsAt: string | null;
  listing: Pkg | null; // what "Buy now" orders
  href: string; // where a click on the card goes
}

function endsText(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return (
      'Ends ' +
      new Date(iso).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    );
  } catch {
    return null;
  }
}

export function HomeSliders() {
  if (!MARKETPLACE_ENABLED) return null;
  return <HomeSlidersInner />;
}

function HomeSlidersInner() {
  const router = useRouter();
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [ordering, setOrdering] = useState<Pkg | null>(null);
  const lastLoad = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      lastLoad.current = Date.now();
      try {
        const supabase = createClient();
        const [l, s] = await Promise.all([
          supabase
            .from('mp_listings')
            .select(
              'id, title, price, status, delivery_hours, vendor_id, product_id, has_warranty, warranty_text, duration_months, description, offer_price, offer_percent, offer_ends_at, mp_vendors(id, name, slug, verified, status), mp_products(name)'
            )
            .eq('status', 'active')
            .order('price')
            .limit(200),
          supabase.rpc('mp_active_statuses'),
        ]);
        if (l.error) throw new Error(l.error.message);
        const rows = (l.data ?? []) as unknown as Row[];
        const list: Pkg[] = [];
        for (const row of rows) {
          const v = (Array.isArray(row.mp_vendors) ? row.mp_vendors[0] : row.mp_vendors) as { status?: string } | null;
          const p = Array.isArray(row.mp_products) ? row.mp_products[0] : row.mp_products;
          if (!p || (v?.status && v.status !== 'approved')) continue;
          const pk = toListing(row);
          if (!Number.isFinite(pk.price) || pk.price <= 0) continue;
          list.push({ ...pk, productName: p.name });
        }
        if (cancelled) return;
        const now = Date.now();
        setPkgs(list);
        setStatuses(
          !s.error
            ? ((s.data ?? []) as StatusRow[]).filter((x) => x.kind === 'offer' && new Date(x.expires_at).getTime() > now)
            : []
        );
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > REFRESH_MS) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const cheapest = useMemo(() => [...pkgs].sort(byPriceAsc).slice(0, MAX_CARDS), [pkgs]);

  const offers = useMemo<OfferItem[]>(() => {
    const out: OfferItem[] = [];
    // package offers that are running now (toListing only keeps offers that have not ended)
    for (const p of pkgs) {
      if (p.original_price === null) continue;
      out.push({
        key: 'l' + p.id,
        title: p.productName + ' · ' + p.title,
        vendorName: p.vendor?.name ?? 'Vendor',
        description: detailsSummary(p.description),
        price: p.price,
        originalPrice: p.original_price,
        percent: p.offer_percent,
        endsAt: p.offer_ends_at,
        listing: p,
        href: `/marketplace?product=${p.product_id}&listing=${p.id}`,
      });
    }
    // "Special offer" statuses that vendors posted and that have not expired
    for (const s of statuses) {
      const match = pkgs
        .filter((p) => p.vendor_id === s.vendor_id && (!s.product_id || p.product_id === s.product_id))
        .filter((p) => !s.listing_title || p.title === s.listing_title)
        .sort(byPriceAsc)[0];
      out.push({
        key: 's' + s.id,
        title: s.title,
        vendorName: s.vendor_name,
        description: s.body,
        price: match ? match.price : null,
        originalPrice: match ? match.original_price : null,
        percent: match ? match.offer_percent : null,
        endsAt: s.expires_at,
        listing: match ?? null,
        href: match
          ? `/marketplace?product=${match.product_id}&listing=${match.id}`
          : s.product_id
            ? `/marketplace?product=${s.product_id}`
            : `/marketplace?vendor=${s.vendor_id}`,
      });
    }
    // ending soonest first, so current offers are not missed
    return out
      .sort((a, b) => new Date(a.endsAt ?? 8.64e15).getTime() - new Date(b.endsAt ?? 8.64e15).getTime())
      .slice(0, MAX_CARDS);
  }, [pkgs, statuses]);

  return (
    <div className="min-w-0 space-y-3">
      <Carousel
        title="Cheapest packages"
        hint="Lowest price first"
        icon={<Tag className="h-4 w-4 text-primary" />}
        loading={loading}
        failed={failed}
        empty="No packages are listed right now."
        count={cheapest.length}
        hold={ordering !== null}
        render={(hidden) =>
          cheapest.map((p, i) => (
            <Card
              key={p.id + (hidden ? '-copy' : '')}
              hidden={hidden}
              title={p.productName}
              subtitle={p.title}
              vendorName={p.vendor?.name ?? 'Vendor'}
              description={detailsSummary(p.description)}
              price={p.price}
              originalPrice={p.original_price}
              badge={i === 0 ? 'Lowest price' : p.offer_percent !== null ? p.offer_percent + '% OFF' : null}
              footnote={null}
              onOpen={() => router.push(`/marketplace?product=${p.product_id}&listing=${p.id}`)}
              onBuy={() => setOrdering(p)}
              buyLabel="Buy now"
            />
          ))
        }
      />
      <Carousel
        title="Vendor offers"
        hint="Live offers only"
        icon={<Flame className="h-4 w-4 text-primary" />}
        loading={loading}
        failed={failed}
        empty="No special offers right now. New vendor offers will show here."
        count={offers.length}
        hold={ordering !== null}
        render={(hidden) =>
          offers.map((o) => (
            <Card
              key={o.key + (hidden ? '-copy' : '')}
              hidden={hidden}
              title={o.title}
              subtitle={null}
              vendorName={o.vendorName}
              description={o.description}
              price={o.price}
              originalPrice={o.originalPrice}
              badge={o.percent !== null ? o.percent + '% OFF' : 'Offer'}
              footnote={endsText(o.endsAt)}
              onOpen={() => router.push(o.href)}
              onBuy={o.listing ? () => setOrdering(o.listing) : () => router.push(o.href)}
              buyLabel={o.listing ? 'Buy now' : 'View offer'}
            />
          ))
        }
      />
      {ordering && <OrderDialog listing={ordering} productName={ordering.productName} onClose={() => setOrdering(null)} />}
    </div>
  );
}

// ---------- one moving row ----------
function Carousel({
  title,
  hint,
  icon,
  loading,
  failed,
  empty,
  count,
  render,
  hold = false,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  loading: boolean;
  failed: boolean;
  empty: string;
  count: number;
  render: (hidden: boolean) => React.ReactNode;
  hold?: boolean; // stays still while the order form is open
}) {
  const ref = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pos = useRef(0);
  const holdRef = useRef(hold);
  useEffect(() => {
    holdRef.current = hold;
  }, [hold]);
  const loop = count >= 3; // with 1-2 cards there is nothing to move

  const pause = useCallback(() => {
    paused.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);
  const resumeSoon = useCallback((ms = 2500) => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      paused.current = false;
    }, ms);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !loop) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();
    pos.current = el.scrollLeft;
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      // where the second copy starts = one full loop
      const copyStart = el.children[count] as HTMLElement | undefined;
      const half = copyStart ? copyStart.offsetLeft - (el.children[0] as HTMLElement).offsetLeft : 0;
      if (!paused.current && !holdRef.current && !reduce && half > 0 && el.scrollWidth > el.clientWidth + 4) {
        pos.current += (SPEED * dt) / 1000;
        if (pos.current >= half) pos.current -= half;
        el.scrollLeft = pos.current;
      } else {
        pos.current = el.scrollLeft;
        if (half > 0 && pos.current >= half) {
          pos.current -= half;
          el.scrollLeft = pos.current;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, [loop, count]);

  const step = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    pause();
    const card = el.children[0] as HTMLElement | undefined;
    const w = card ? card.offsetWidth + 12 : 280;
    const copyStart = el.children[count] as HTMLElement | undefined;
    const half = copyStart ? copyStart.offsetLeft - (el.children[0] as HTMLElement).offsetLeft : 0;
    if (dir === -1 && loop && half > 0 && el.scrollLeft < w) el.scrollLeft += half; // keep looping backwards
    el.scrollBy({ left: dir * w, behavior: 'smooth' });
    resumeSoon(4000);
  };

  return (
    <section aria-label={title} className="min-w-0" data-robot-spot={title === 'Cheapest packages' ? 'packages' : 'offers'}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h2 className="truncate text-sm font-bold text-foreground" style={{ fontFamily: 'inherit' }}>
            {title}
          </h2>
          <span className="hidden text-xs text-muted-foreground sm:inline">· {hint}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {loop && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={'Previous ' + title.toLowerCase()}
                className="hidden h-7 w-7 place-items-center rounded-full border border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground sm:grid"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={'Next ' + title.toLowerCase()}
                className="hidden h-7 w-7 place-items-center rounded-full border border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground sm:grid"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          <Link href="/marketplace" className="ml-1 text-xs font-semibold text-primary hover:underline">
            View all
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[152px] w-[240px] shrink-0 rounded-2xl sm:w-[268px]" />
          ))}
        </div>
      ) : failed ? (
        <p className="rounded-xl border border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground">
          Could not load the marketplace right now. Please refresh the page.
        </p>
      ) : count === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div
          ref={ref}
          onPointerEnter={(e) => e.pointerType === 'mouse' && pause()}
          onPointerLeave={(e) => e.pointerType === 'mouse' && resumeSoon(1500)}
          onTouchStart={pause}
          onTouchEnd={() => resumeSoon(3500)}
          onFocus={pause}
          onBlur={() => resumeSoon(2500)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              step(1);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              step(-1);
            }
          }}
          className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {render(false)}
          {loop && render(true)}
        </div>
      )}
    </section>
  );
}

// ---------- one compact card ----------
function Card({
  hidden,
  title,
  subtitle,
  vendorName,
  description,
  price,
  originalPrice,
  badge,
  footnote,
  onOpen,
  onBuy,
  buyLabel,
}: {
  hidden: boolean;
  title: string;
  subtitle: string | null;
  vendorName: string;
  description: string;
  price: number | null;
  originalPrice: number | null;
  badge: string | null;
  footnote: string | null;
  onOpen: () => void;
  onBuy: () => void;
  buyLabel: string;
}) {
  const busy = useRef(false);
  const once = (fn: () => void) => {
    if (busy.current) return;
    busy.current = true;
    fn();
    setTimeout(() => (busy.current = false), 800);
  };
  return (
    <div
      role="link"
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden || undefined}
      aria-label={hidden ? undefined : `${title} from ${vendorName}${price !== null ? ', ' + formatPkr(price) : ''}`}
      onClick={() => once(onOpen)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          once(onOpen);
        }
      }}
      className="group flex h-[152px] w-[240px] shrink-0 cursor-pointer flex-col rounded-2xl border border-border/60 bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-[268px]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-1 text-sm font-bold text-foreground">{title}</p>
        {badge && (
          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{badge}</span>
        )}
      </div>
      <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        <Store className="h-3 w-3 shrink-0" />
        <span className="truncate font-semibold text-foreground/90">{vendorName}</span>
        {subtitle && <span className="truncate">· {subtitle}</span>}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{description || ' '}</p>
      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="min-w-0">
          {footnote && <p className="truncate text-[10px] text-muted-foreground">{footnote}</p>}
          <p className="text-base font-extrabold leading-tight text-foreground">
            {price !== null ? formatPkr(price) : 'See offer'}
            {originalPrice !== null && price !== null && (
              <span className="ml-1.5 text-xs font-medium text-muted-foreground line-through">{formatPkr(originalPrice)}</span>
            )}
          </p>
        </div>
        <Button
          size="sm"
          tabIndex={hidden ? -1 : 0}
          className="h-8 shrink-0 px-3 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            once(onBuy);
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {buyLabel}
        </Button>
      </div>
    </div>
  );
}
