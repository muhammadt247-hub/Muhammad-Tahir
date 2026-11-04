// OrbinexaCSV Marketplace: helpers shared by the marketplace pages.

// The marketplace only shows when this setting is exactly "true".
// On the live site the setting is not set, so the page stays hidden.
export const MARKETPLACE_ENABLED = process.env.NEXT_PUBLIC_MARKETPLACE_ENABLED === 'true';

export interface MpProduct {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  image_url: string | null;
}

export interface MpVendorInfo {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
}

export interface MpListing {
  id: string;
  title: string;
  price: number;
  delivery_hours: number;
  vendor_id: string;
  product_id: string;
  vendor: MpVendorInfo | null;
}

// One row as it comes from the database (the vendor can arrive as an object or a list of one)
export interface RawListingRow {
  id: string;
  title: string;
  price: number | string;
  delivery_hours: number;
  vendor_id: string;
  product_id: string;
  mp_vendors: MpVendorInfo | MpVendorInfo[] | null;
}

export type SortKey = 'price' | 'speed' | 'verified';

export function toListing(row: RawListingRow): MpListing {
  const v = Array.isArray(row.mp_vendors) ? row.mp_vendors[0] ?? null : row.mp_vendors;
  return {
    id: row.id,
    title: row.title,
    price: Number(row.price),
    delivery_hours: row.delivery_hours,
    vendor_id: row.vendor_id,
    product_id: row.product_id,
    vendor: v ?? null,
  };
}

export function formatPkr(value: number): string {
  return 'Rs ' + Math.round(value).toLocaleString('en-US');
}

export function formatHours(hours: number): string {
  if (hours < 24) return hours + (hours === 1 ? ' hour' : ' hours');
  const days = Math.round(hours / 24);
  return days + (days === 1 ? ' day' : ' days');
}

export function sortListings(list: MpListing[], key: SortKey): MpListing[] {
  const copy = [...list];
  copy.sort((a, b) => {
    if (key === 'speed') {
      if (a.delivery_hours !== b.delivery_hours) return a.delivery_hours - b.delivery_hours;
      return a.price - b.price;
    }
    if (key === 'verified') {
      const av = a.vendor?.verified ? 1 : 0;
      const bv = b.vendor?.verified ? 1 : 0;
      if (av !== bv) return bv - av;
      return a.price - b.price;
    }
    if (a.price !== b.price) return a.price - b.price;
    return a.delivery_hours - b.delivery_hours;
  });
  return copy;
}

// Badges per listing id: "Lowest price" and "Fastest" (only when there is something to compare)
export function getBadges(list: MpListing[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (list.length < 2) return result;
  const minPrice = Math.min(...list.map((l) => l.price));
  const minHours = Math.min(...list.map((l) => l.delivery_hours));
  for (const l of list) {
    const badges: string[] = [];
    if (l.price === minPrice) badges.push('Lowest price');
    if (l.delivery_hours === minHours) badges.push('Fastest');
    result[l.id] = badges;
  }
  return result;
}