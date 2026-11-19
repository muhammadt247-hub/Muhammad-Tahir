// Who is this person in the admin area? Super Admin (full control) or a moderator with ticked permissions.
// The database checks every permission again (mp_staff_can / mp_mod_can); this only decides what to SHOW.
import type { SupabaseClient } from '@supabase/supabase-js';

export type StaffPerm =
  | 'orders_view'
  | 'orders_manage'
  | 'vendor_payments'
  | 'catalog'
  | 'vendors'
  | 'statuses'
  | 'insights'
  | 'signups';

export const STAFF_PERMS: { key: StaffPerm; label: string; help: string }[] = [
  { key: 'orders_view', label: 'See orders', help: 'See all orders and customer details (name, WhatsApp, email).' },
  { key: 'orders_manage', label: 'Change order status', help: 'Move orders forward, cancel or refund them. Also gives "See orders".' },
  { key: 'vendor_payments', label: 'Mark vendors paid', help: 'Press "Vendor paid" on completed orders. Also gives "See orders".' },
  { key: 'catalog', label: 'Products, packages and prices', help: 'Add and edit products and packages, and set package prices. They will see vendor prices and your commission.' },
  { key: 'vendors', label: 'Manage vendors', help: 'Add, approve, verify and edit vendors, and see vendor warnings and private details.' },
  { key: 'statuses', label: 'Moderate vendor status posts', help: 'See and remove vendor status posts.' },
  { key: 'insights', label: 'Business insights', help: 'See profit, commission and vendor payout totals.' },
  { key: 'signups', label: 'Help sign-ups', help: 'See people whose confirmation email did not arrive, and activate their account after they contact you.' },
];

export interface StaffAccess {
  super: boolean;
  moderator: boolean;
  permissions: StaffPerm[];
}

export const NO_ACCESS: StaffAccess = { super: false, moderator: false, permissions: [] };

export async function loadStaffAccess(supabase: SupabaseClient): Promise<StaffAccess> {
  const { data, error } = await supabase.rpc('mp_my_access');
  if (error || !data) {
    // Older database without moderators: fall back to the Super Admin check
    const admin = await supabase.rpc('mp_is_admin');
    return admin.data === true
      ? { super: true, moderator: false, permissions: STAFF_PERMS.map((p) => p.key) }
      : NO_ACCESS;
  }
  const d = data as { super?: boolean; moderator?: boolean; permissions?: string[] };
  const known = new Set(STAFF_PERMS.map((p) => p.key as string));
  return {
    super: d.super === true,
    moderator: d.moderator === true,
    permissions: (d.permissions ?? []).filter((p): p is StaffPerm => known.has(p)),
  };
}

export function can(access: StaffAccess, perm: StaffPerm): boolean {
  return access.super || access.permissions.includes(perm);
}

export function isStaff(access: StaffAccess): boolean {
  return access.super || (access.moderator && access.permissions.length > 0);
}
