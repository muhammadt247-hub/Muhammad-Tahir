'use client';

// Super Admin only: add moderators by email, tick what each one may do, edit, deactivate or remove them.
// Every change goes through database functions that check "is this the Super Admin?" again.

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, MessageCircle, Pencil, Power, Trash2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/supabase/config';
import { STAFF_PERMS, type StaffPerm } from '@/lib/marketplace/staff';

interface ModeratorRow {
  id: string;
  email: string;
  display_name: string | null;
  user_id: string | null;
  permissions: StaffPerm[];
  status: 'active' | 'inactive';
  created_at: string;
  last_active_at: string | null;
  whatsapp: string | null;
  last_sign_in_at?: string | null; // when they last logged in to the site
}

interface FormState {
  id: string | null;
  email: string;
  name: string;
  permissions: StaffPerm[];
  status: 'active' | 'inactive';
  whatsapp: string;
}

const EMPTY_FORM: FormState = { id: null, email: '', name: '', permissions: ['orders_view'], status: 'active', whatsapp: '' };
const ONLINE_MS = 3 * 60 * 1000; // seen in the admin area in the last 3 minutes = online now

// "5 minutes ago", "3 hours ago", "2 days ago"
function ago(v: string | null | undefined, now: number): string {
  if (!v) return 'never';
  const s = Math.max(0, (now - new Date(v).getTime()) / 1000);
  if (s < 90) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return m + ' minutes ago';
  const h = Math.round(m / 60);
  if (h < 36) return h + (h === 1 ? ' hour ago' : ' hours ago');
  const d = Math.round(h / 24);
  return d + (d === 1 ? ' day ago' : ' days ago');
}

function formatDate(v: string | null): string {
  if (!v) return 'never';
  return new Date(v).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function inviteText(email: string): string {
  const site = getSiteUrl();
  return (
    'Hello! You are now a moderator on OrbinexaCSV.\n' +
    '1. Open ' + site + '/login\n' +
    '2. Log in (or sign up) with this email: ' + email + '\n' +
    '3. Open ' + site + '/marketplace/admin\n' +
    'You will see only the parts you are allowed to manage.'
  );
}

async function fetchModerators(): Promise<{ rows: ModeratorRow[]; error: string | null }> {
  const { data, error } = await createClient()
    .from('mp_moderators')
    .select('id, email, display_name, user_id, permissions, status, created_at, last_active_at, whatsapp')
    .order('created_at', { ascending: true });
  // when each one last logged in to the site (from the accounts table, Super Admin only)
  const logins = await createClient().rpc('mp_admin_moderator_logins');
  const last = new Map<string, string | null>(
    ((logins.data ?? []) as { moderator_id: string; last_sign_in_at: string | null }[]).map((l) => [l.moderator_id, l.last_sign_in_at]),
  );
  const rows = ((data ?? []) as ModeratorRow[]).map((r) => ({ ...r, last_sign_in_at: last.get(r.id) ?? null }));
  return { rows, error: error ? error.message : null };
}

export function ModeratorManager() {
  const [rows, setRows] = useState<ModeratorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(0); // time of the last refresh (for "online now" / "5 minutes ago")

  const apply = useCallback((res: { rows: ModeratorRow[]; error: string | null }) => {
    setNow(Date.now());
    if (res.error) setError(res.error);
    else {
      setRows(res.rows);
      setError(null);
    }
    setLoading(false);
  }, []);

  const load = useCallback(async () => apply(await fetchModerators()), [apply]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetchModerators().then((res) => {
        if (!cancelled) apply(res);
      });
    refresh();
    const t = window.setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [apply]);

  const save = async (f: FormState) => {
    if (saving) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (f.permissions.length === 0) {
      toast.error('Tick at least one thing this moderator may do.');
      return;
    }
    setSaving(true);
    const { error: err } = await createClient().rpc('mp_admin_save_moderator', {
      p_id: f.id,
      p_email: f.email.trim(),
      p_name: f.name.trim(),
      p_permissions: f.permissions,
      p_status: f.status,
      p_whatsapp: f.whatsapp.trim() || null,
    });
    setSaving(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success(f.id ? 'Moderator updated' : 'Moderator added. Send them the invite message.');
    setForm(null);
    load();
  };

  const toggleActive = async (m: ModeratorRow) => {
    setBusyId(m.id);
    const { error: err } = await createClient().rpc('mp_admin_save_moderator', {
      p_id: m.id,
      p_email: m.email,
      p_name: m.display_name ?? '',
      p_permissions: m.permissions,
      p_status: m.status === 'active' ? 'inactive' : 'active',
      p_whatsapp: m.whatsapp,
    });
    setBusyId(null);
    if (err) toast.error(err.message);
    else {
      toast.success(m.status === 'active' ? 'Moderator deactivated. They can no longer use the admin area.' : 'Moderator active again');
      load();
    }
  };

  const remove = async (m: ModeratorRow) => {
    if (!window.confirm('Remove ' + m.email + ' as a moderator? They lose all admin access right away.')) return;
    setBusyId(m.id);
    const { error: err } = await createClient().rpc('mp_admin_remove_moderator', { p_id: m.id });
    setBusyId(null);
    if (err) toast.error(err.message);
    else {
      toast.success('Moderator removed');
      load();
    }
  };

  const copyInvite = async (email: string) => {
    try {
      await navigator.clipboard.writeText(inviteText(email));
      toast.success('Invite message copied');
    } catch {
      toast.error('Could not copy. Please select the text yourself.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">Moderators</h2>
            <p className="text-xs text-muted-foreground">
              You are the Super Admin. Moderators can only use what you tick. Only you can change settings, delete vendors and manage moderators.
            </p>
          </div>
          {!form && (
            <Button size="sm" className="gap-1.5" onClick={() => setForm({ ...EMPTY_FORM })}>
              <UserPlus className="h-4 w-4" /> Add moderator
            </Button>
          )}
        </div>
      </div>

      {form && (
        <ModeratorForm form={form} saving={saving} onChange={setForm} onCancel={() => setForm(null)} onSave={save} />
      )}

      {error && <p className="text-xs font-semibold text-red-600 break-words">{error}</p>}

      {loading ? (
        <Skeleton className="h-28" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          No moderators yet. Press &quot;Add moderator&quot; to add one by email.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((m) => {
            const online =
              m.status === 'active' && !!m.last_active_at && now - new Date(m.last_active_at).getTime() < ONLINE_MS;
            const state =
              m.status === 'inactive'
                ? 'Deactivated'
                : online
                  ? '● Online now'
                  : m.user_id
                    ? 'Active'
                    : 'Invited (not logged in yet)';
            const stateClass =
              m.status === 'inactive'
                ? 'bg-muted text-muted-foreground'
                : online
                  ? 'bg-emerald-500 text-white'
                  : m.user_id
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
            const waLink = m.whatsapp
              ? 'https://wa.me/' + m.whatsapp + '?text=' + encodeURIComponent(inviteText(m.email))
              : 'https://wa.me/?text=' + encodeURIComponent(inviteText(m.email));
            return (
              <div key={m.id} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground break-all">{m.display_name || m.email}</p>
                    {m.display_name && <p className="text-xs text-muted-foreground break-all">{m.email}</p>}
                    {m.whatsapp && <p className="text-xs text-muted-foreground">WhatsApp: +{m.whatsapp}</p>}
                    <p className="text-[11px] text-muted-foreground">
                      Used the admin area: <span className="font-semibold text-foreground">{ago(m.last_active_at, now)}</span>
                      {m.last_active_at && <> ({formatDate(m.last_active_at)})</>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Last logged in to the site: <span className="font-semibold text-foreground">{ago(m.last_sign_in_at, now)}</span>
                    </p>
                  </div>
                  <span className={'rounded-full px-2.5 py-1 text-[11px] font-bold ' + stateClass}>{state}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STAFF_PERMS.filter((p) => m.permissions.includes(p.key)).map((p) => (
                    <span key={p.key} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {p.label}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      setForm({
                        id: m.id,
                        email: m.email,
                        name: m.display_name ?? '',
                        permissions: m.permissions,
                        status: m.status,
                        whatsapp: m.whatsapp ?? '',
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={busyId === m.id} onClick={() => toggleActive(m)}>
                    <Power className="h-3.5 w-3.5" /> {m.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                  {m.status === 'active' && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyInvite(m.email)}>
                        <Copy className="h-3.5 w-3.5" /> Copy invite
                      </Button>
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#25D366] px-3 text-xs font-bold text-white hover:opacity-90"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> {m.whatsapp ? 'Send invite to their WhatsApp' : 'Send invite on WhatsApp'}
                      </a>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-red-600 hover:text-red-700"
                    disabled={busyId === m.id}
                    onClick={() => remove(m)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModeratorForm({
  form,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  form: FormState;
  saving: boolean;
  onChange: (f: FormState) => void;
  onCancel: () => void;
  onSave: (f: FormState) => void;
}) {
  const toggle = (key: StaffPerm) => {
    const has = form.permissions.includes(key);
    let next = has ? form.permissions.filter((p) => p !== key) : [...form.permissions, key];
    // changing orders or paying vendors needs seeing orders
    if (!has && (key === 'orders_manage' || key === 'vendor_payments') && !next.includes('orders_view')) next = [...next, 'orders_view'];
    if (has && key === 'orders_view') next = next.filter((p) => p !== 'orders_manage' && p !== 'vendor_payments');
    onChange({ ...form, permissions: next });
  };

  return (
    <form
      className="rounded-2xl border border-primary/40 bg-card p-4 sm:p-5 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">{form.id ? 'Edit moderator' : 'Add a moderator'}</h3>
        <button type="button" onClick={onCancel} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mod-email">Email (they must log in with this email)</Label>
          <Input
            id="mod-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => onChange({ ...form, email: e.target.value })}
            placeholder="name@gmail.com"
            maxLength={120}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mod-name">Name (only you see this)</Label>
          <Input
            id="mod-name"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="e.g. Ali (orders helper)"
            maxLength={60}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mod-wa">Their WhatsApp number (optional, for the invite)</Label>
          <Input
            id="mod-wa"
            inputMode="tel"
            value={form.whatsapp}
            onChange={(e) => onChange({ ...form, whatsapp: e.target.value })}
            placeholder="e.g. 03001234567 or 923001234567"
            maxLength={20}
          />
          <p className="text-[11px] text-muted-foreground">
            With a number, &quot;Send invite&quot; opens a WhatsApp chat with them and the message ready. You still press Send in WhatsApp.
          </p>
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground mb-1">What may this moderator do?</legend>
        {STAFF_PERMS.map((p) => (
          <label
            key={p.key}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/50 p-3 hover:border-primary/50"
          >
            <input
              type="checkbox"
              checked={form.permissions.includes(p.key)}
              onChange={() => toggle(p.key)}
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
            />
            <span>
              <span className="block text-sm font-semibold text-foreground">{p.label}</span>
              <span className="block text-xs text-muted-foreground">{p.help}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : form.id ? 'Save changes' : 'Add moderator'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
