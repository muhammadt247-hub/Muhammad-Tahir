// Marketplace search and price sorting helpers (used by the shop page and the home page sliders).
import { useEffect, useState } from 'react';
import type { MpListing } from '@/lib/marketplace/shared';

// lower case, no accents, letters and numbers only ("ChatGPT-Plus" -> "chatgpt plus")
export function normalize(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Small typo check: true when a and b differ by at most one letter (added, removed or changed)
function nearlySame(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  // two neighbouring letters swapped ("canav" -> "canva")
  if (a.length === b.length) {
    const d = [...a].map((c, k) => (c !== b[k] ? k : -1)).filter((k) => k >= 0);
    if (d.length === 2 && d[1] === d[0] + 1 && a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]]) return true;
  }
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// Does the text match the search? Every word of the search must be found:
// as part of the text ("gpt" finds "ChatGPT"), or, for words of 4+ letters, as a whole word with one typo ("canav" finds "Canva").
export function matchesQuery(text: string, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const hay = normalize(text);
  const squashed = hay.replace(/ /g, '');
  const words = hay.split(' ');
  return q.split(' ').every((t) => {
    if (hay.includes(t) || squashed.includes(t)) return true;
    if (t.length < 4) return false;
    return words.some((w) => nearlySame(w, t));
  });
}

// Numbers only, never text: cheapest first; same price -> faster delivery first
export function byPriceAsc(a: MpListing, b: MpListing): number {
  const d = Number(a.price) - Number(b.price);
  if (d !== 0) return d;
  return a.delivery_hours - b.delivery_hours;
}

export type VendorSortKey = 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';

export const VENDOR_SORT_OPTIONS: { key: VendorSortKey; label: string }[] = [
  { key: 'price_asc', label: 'Lowest price first' },
  { key: 'price_desc', label: 'Highest price first' },
  { key: 'name_asc', label: 'Vendor name A–Z' },
  { key: 'name_desc', label: 'Vendor name Z–A' },
];

export interface VendorSummary {
  id: string;
  name: string;
  verified: boolean;
  about: string | null;
  listings: MpListing[]; // that vendor's live packages, cheapest first
  lowest: number | null; // lowest real package price (offer price while an offer runs), null when none
}

// Vendors without a valid price always go last, whatever the sort
export function sortVendors(list: VendorSummary[], key: VendorSortKey): VendorSummary[] {
  const byName = (a: VendorSummary, b: VendorSummary) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  return [...list].sort((a, b) => {
    if (key === 'name_asc') return byName(a, b);
    if (key === 'name_desc') return byName(b, a);
    const ap = a.lowest;
    const bp = b.lowest;
    if (ap === null && bp === null) return byName(a, b);
    if (ap === null) return 1;
    if (bp === null) return -1;
    if (ap !== bp) return key === 'price_asc' ? ap - bp : bp - ap;
    return byName(a, b);
  });
}

// Waits until the user stops typing for a moment
export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
