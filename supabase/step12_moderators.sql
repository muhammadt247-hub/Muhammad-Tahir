-- Step 12: Moderators (Super Admin stays in mp_admins; moderators get only the permissions the Super Admin ticks).
-- Safe by design: existing "admin only" rules are NOT changed. New, extra rules are added for moderators,
-- so the Super Admin's access stays exactly the same.

-- 1. Moderators table -----------------------------------------------------------------------------------------
create table if not exists public.mp_moderators (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text,
  user_id uuid unique references auth.users(id) on delete set null, -- filled when they log in with this email
  permissions text[] not null default '{}',
  status text not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_active_at timestamptz,
  constraint mp_moderators_email_lower check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint mp_moderators_status_ok check (status in ('active', 'inactive')),
  constraint mp_moderators_perms_ok check (
    permissions <@ array['orders_view','orders_manage','vendor_payments','catalog','vendors','statuses','insights']::text[]
  )
);
create unique index if not exists mp_moderators_email_key on public.mp_moderators (email);

alter table public.mp_moderators enable row level security;
revoke all on public.mp_moderators from anon;

drop policy if exists "Super admin manages moderators" on public.mp_moderators;
create policy "Super admin manages moderators" on public.mp_moderators
  for all to authenticated using (public.mp_is_admin()) with check (public.mp_is_admin());

drop policy if exists "Moderators see own row" on public.mp_moderators;
create policy "Moderators see own row" on public.mp_moderators
  for select to authenticated using (user_id = auth.uid());

-- 2. Permission check used by the database rules ---------------------------------------------------------------
create or replace function public.mp_mod_can(p_perm text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mp_moderators m
    where m.user_id = auth.uid() and m.status = 'active' and p_perm = any (m.permissions)
  );
$$;

-- Super Admin, or a moderator with this permission
create or replace function public.mp_staff_can(p_perm text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.mp_is_admin() or public.mp_mod_can(p_perm);
$$;

-- 3. "What may I do?" for the website (also links an invited email to the account the first time) ---------------
create or replace function public.mp_my_access()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_email text;
  m record;
begin
  if uid is null then
    return jsonb_build_object('super', false, 'moderator', false, 'permissions', '[]'::jsonb);
  end if;
  if public.mp_is_admin() then
    return jsonb_build_object('super', true, 'moderator', false,
      'permissions', to_jsonb(array['orders_view','orders_manage','vendor_payments','catalog','vendors','statuses','insights']));
  end if;

  -- link an invitation to this account (only a confirmed email can claim it)
  select lower(u.email) into v_email from auth.users u where u.id = uid and u.email_confirmed_at is not null;
  if v_email is not null then
    update public.mp_moderators set user_id = uid, updated_at = now()
     where email = v_email and user_id is null;
  end if;

  select * into m from public.mp_moderators where user_id = uid;
  if not found or m.status <> 'active' then
    return jsonb_build_object('super', false, 'moderator', false, 'permissions', '[]'::jsonb);
  end if;
  update public.mp_moderators set last_active_at = now()
   where id = m.id and (last_active_at is null or last_active_at < now() - interval '5 minutes');
  return jsonb_build_object('super', false, 'moderator', true, 'permissions', to_jsonb(m.permissions));
end;
$$;

-- 4. Super Admin tools: add / edit / deactivate / remove ---------------------------------------------------------
create or replace function public.mp_admin_save_moderator(
  p_id uuid, p_email text, p_name text, p_permissions text[], p_status text
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_perms text[];
  v_id uuid;
  v_old record;
begin
  if not public.mp_is_admin() then raise exception 'Only the Super Admin can manage moderators'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email address'; end if;
  if exists (select 1 from public.mp_admins a join auth.users u on u.id = a.user_id where lower(u.email) = v_email) then
    raise exception 'This email is already the Super Admin';
  end if;
  if coalesce(p_status, 'active') not in ('active', 'inactive') then raise exception 'Bad status'; end if;

  -- keep only known permissions; managing orders or vendor payments needs seeing orders
  select coalesce(array_agg(distinct x order by x), '{}') into v_perms
    from unnest(coalesce(p_permissions, '{}')) x
   where x in ('orders_view','orders_manage','vendor_payments','catalog','vendors','statuses','insights');
  if ('orders_manage' = any (v_perms) or 'vendor_payments' = any (v_perms)) and not ('orders_view' = any (v_perms)) then
    v_perms := array_append(v_perms, 'orders_view');
  end if;

  if p_id is null then
    if exists (select 1 from public.mp_moderators where email = v_email) then
      raise exception 'This email is already a moderator';
    end if;
    insert into public.mp_moderators (email, display_name, permissions, status, invited_by, user_id)
    values (v_email, nullif(btrim(coalesce(p_name, '')), ''), v_perms, coalesce(p_status, 'active'), auth.uid(),
            (select u.id from auth.users u where lower(u.email) = v_email and u.email_confirmed_at is not null limit 1))
    returning id into v_id;
    insert into public.mp_audit_log (admin_id, action, details)
    values (auth.uid(), 'moderator_added', jsonb_build_object('moderator', v_id, 'email', v_email, 'permissions', v_perms));
  else
    select * into v_old from public.mp_moderators where id = p_id for update;
    if not found then raise exception 'Moderator not found'; end if;
    if v_email <> v_old.email and exists (select 1 from public.mp_moderators where email = v_email and id <> p_id) then
      raise exception 'This email is already a moderator';
    end if;
    update public.mp_moderators set
      email = v_email,
      display_name = nullif(btrim(coalesce(p_name, '')), ''),
      permissions = v_perms,
      status = coalesce(p_status, 'active'),
      -- a new email must be claimed again by that person
      user_id = case when v_email = v_old.email then user_id
                     else (select u.id from auth.users u where lower(u.email) = v_email and u.email_confirmed_at is not null limit 1) end,
      updated_at = now()
    where id = p_id;
    v_id := p_id;
    insert into public.mp_audit_log (admin_id, action, details)
    values (auth.uid(), 'moderator_updated', jsonb_build_object('moderator', v_id, 'email', v_email,
            'permissions', v_perms, 'status', coalesce(p_status, 'active')));
  end if;
  return v_id;
end;
$$;

create or replace function public.mp_admin_remove_moderator(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_email text;
begin
  if not public.mp_is_admin() then raise exception 'Only the Super Admin can manage moderators'; end if;
  delete from public.mp_moderators where id = p_id returning email into v_email;
  if v_email is null then raise exception 'Moderator not found'; end if;
  insert into public.mp_audit_log (admin_id, action, details)
  values (auth.uid(), 'moderator_removed', jsonb_build_object('moderator', p_id, 'email', v_email));
end;
$$;

-- 5. Extra rules for moderators (existing admin rules untouched) -------------------------------------------------
-- Orders (see orders and customer details)
drop policy if exists "Moderators see orders" on public.mp_orders;
create policy "Moderators see orders" on public.mp_orders for select to authenticated using (public.mp_mod_can('orders_view'));
drop policy if exists "Moderators see order private" on public.mp_order_private;
create policy "Moderators see order private" on public.mp_order_private for select to authenticated using (public.mp_mod_can('orders_view'));
drop policy if exists "Moderators see order events" on public.mp_order_events;
create policy "Moderators see order events" on public.mp_order_events for select to authenticated using (public.mp_mod_can('orders_view'));
drop policy if exists "Moderators see reviews" on public.mp_reviews;
create policy "Moderators see reviews" on public.mp_reviews for select to authenticated using (public.mp_mod_can('orders_view'));

-- Products, packages and prices (no deleting products)
drop policy if exists "Moderators see products" on public.mp_products;
create policy "Moderators see products" on public.mp_products for select to authenticated using (public.mp_mod_can('catalog'));
drop policy if exists "Moderators add products" on public.mp_products;
create policy "Moderators add products" on public.mp_products for insert to authenticated with check (public.mp_mod_can('catalog'));
drop policy if exists "Moderators edit products" on public.mp_products;
create policy "Moderators edit products" on public.mp_products for update to authenticated using (public.mp_mod_can('catalog')) with check (public.mp_mod_can('catalog'));
drop policy if exists "Moderators manage listings" on public.mp_listings;
create policy "Moderators manage listings" on public.mp_listings for all to authenticated using (public.mp_mod_can('catalog')) with check (public.mp_mod_can('catalog'));
drop policy if exists "Moderators see listing costs" on public.mp_listing_costs;
create policy "Moderators see listing costs" on public.mp_listing_costs for select to authenticated using (public.mp_mod_can('catalog'));

-- Vendors (add, approve, verify, warnings; deleting vendors stays Super Admin only)
drop policy if exists "Moderators see vendors" on public.mp_vendors;
create policy "Moderators see vendors" on public.mp_vendors for select to authenticated using (public.mp_mod_can('vendors') or public.mp_mod_can('catalog'));
drop policy if exists "Moderators add vendors" on public.mp_vendors;
create policy "Moderators add vendors" on public.mp_vendors for insert to authenticated with check (public.mp_mod_can('vendors'));
drop policy if exists "Moderators edit vendors" on public.mp_vendors;
create policy "Moderators edit vendors" on public.mp_vendors for update to authenticated using (public.mp_mod_can('vendors')) with check (public.mp_mod_can('vendors'));
drop policy if exists "Moderators see vendor private" on public.mp_vendor_private;
create policy "Moderators see vendor private" on public.mp_vendor_private for select to authenticated using (public.mp_mod_can('vendors'));
drop policy if exists "Moderators add vendor private" on public.mp_vendor_private;
create policy "Moderators add vendor private" on public.mp_vendor_private for insert to authenticated with check (public.mp_mod_can('vendors'));
drop policy if exists "Moderators edit vendor private" on public.mp_vendor_private;
create policy "Moderators edit vendor private" on public.mp_vendor_private for update to authenticated using (public.mp_mod_can('vendors')) with check (public.mp_mod_can('vendors'));
drop policy if exists "Moderators see vendor alerts" on public.mp_vendor_alerts;
create policy "Moderators see vendor alerts" on public.mp_vendor_alerts for select to authenticated using (public.mp_mod_can('vendors'));
drop policy if exists "Moderators update vendor alerts" on public.mp_vendor_alerts;
create policy "Moderators update vendor alerts" on public.mp_vendor_alerts for update to authenticated using (public.mp_mod_can('vendors')) with check (public.mp_mod_can('vendors'));

-- Vendor status posts
drop policy if exists "Moderators manage status" on public.mp_vendor_status;
create policy "Moderators manage status" on public.mp_vendor_status for all to authenticated using (public.mp_mod_can('statuses')) with check (public.mp_mod_can('statuses'));

-- Insights read the settings (read only; changing settings stays Super Admin only)
drop policy if exists "Moderators read settings" on public.mp_settings;
create policy "Moderators read settings" on public.mp_settings for select to authenticated using (public.mp_mod_can('insights'));

-- 6. Admin actions: Super Admin, or a moderator with the matching permission -----------------------------------
create or replace function public.mp_admin_mark_vendor_paid(p_order uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare o record;
begin
  if not public.mp_staff_can('vendor_payments') then raise exception 'not allowed'; end if;
  select * into o from public.mp_orders where id = p_order for update;
  if not found then raise exception 'order not found'; end if;
  if o.status <> 'completed' then raise exception 'only completed orders can be paid out'; end if;
  update public.mp_order_private set vendor_paid_at = now() where order_id = p_order and vendor_paid_at is null;
  if not found then raise exception 'already marked as paid'; end if;
  insert into public.mp_audit_log (admin_id, action, details)
  values (auth.uid(), 'vendor_paid', jsonb_build_object('order', p_order));
end; $function$;

create or replace function public.mp_admin_set_status(p_order uuid, p_new text, p_note text default null::text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare o record; ok boolean := false;
begin
  if not public.mp_staff_can('orders_manage') then raise exception 'not allowed'; end if;
  select * into o from public.mp_orders where id = p_order for update;
  if not found then raise exception 'order not found'; end if;

  ok := case o.status
    when 'requested'         then p_new in ('awaiting_payment', 'cancelled')
    when 'awaiting_payment'  then p_new in ('payment_confirmed', 'cancelled')
    when 'payment_confirmed' then p_new in ('with_vendor', 'refunded')
    when 'with_vendor'       then p_new in ('received_checked', 'refunded')
    when 'received_checked'  then p_new in ('delivered', 'refunded')
    when 'delivered'         then p_new in ('completed', 'disputed', 'refunded')
    when 'disputed'          then p_new in ('with_vendor', 'completed', 'refunded')
    else false end;
  if not ok then raise exception 'cannot change % to %', o.status, p_new; end if;

  update public.mp_orders set
    status = p_new,
    updated_at = now(),
    payment_confirmed_at = case when p_new = 'payment_confirmed' then now() else payment_confirmed_at end,
    delivery_due_at = case
      when p_new = 'payment_confirmed' then now() + make_interval(hours => delivery_hours)
      when p_new = 'with_vendor' and o.status = 'disputed' then now() + make_interval(hours => delivery_hours)
      else delivery_due_at end,
    delivered_at = case when p_new = 'delivered' then now() else delivered_at end,
    confirm_deadline_at = case when p_new = 'delivered' then now() + make_interval(hours => confirm_hours) else confirm_deadline_at end,
    completed_at = case when p_new = 'completed' then now() else completed_at end
  where id = p_order;

  perform public.mp_log_event(p_order, 'admin', p_new);
  insert into public.mp_audit_log (admin_id, action, details)
  values (auth.uid(), 'order_status', jsonb_build_object('order', p_order, 'from', o.status, 'to', p_new, 'note', p_note));
  return p_new;
end; $function$;

create or replace function public.mp_set_listing_price(p_listing uuid, p_vendor_price numeric)
 returns numeric
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare pct numeric; new_price numeric;
begin
  if not public.mp_staff_can('catalog') then raise exception 'not allowed'; end if;
  if p_vendor_price is null or p_vendor_price < 0 then raise exception 'bad price'; end if;
  select coalesce((select value::numeric from public.mp_settings where key = 'commission_percent'), 5) into pct;
  new_price := ceil(p_vendor_price * (1 + pct / 100.0));
  insert into public.mp_listing_costs (listing_id, vendor_price) values (p_listing, p_vendor_price) on conflict (listing_id) do update set vendor_price = excluded.vendor_price, updated_at = now();
  update public.mp_listings set price = new_price, updated_at = now() where id = p_listing;
  insert into public.mp_audit_log (admin_id, action, details) values (auth.uid(), 'set_listing_price', jsonb_build_object('listing', p_listing, 'vendor_price', p_vendor_price, 'price', new_price));
  return new_price;
end; $function$;

create or replace function public.mp_vendor_delete_status(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'please log in'; end if;
  delete from public.mp_vendor_status s using public.mp_vendors v
   where s.id = p_id and s.vendor_id = v.id and (v.owner_id = auth.uid() or public.mp_staff_can('statuses'));
end; $function$;

-- 7. Who may call what -----------------------------------------------------------------------------------------
revoke all on function public.mp_mod_can(text) from public, anon;
revoke all on function public.mp_staff_can(text) from public, anon;
revoke all on function public.mp_my_access() from public, anon;
revoke all on function public.mp_admin_save_moderator(uuid, text, text, text[], text) from public, anon;
revoke all on function public.mp_admin_remove_moderator(uuid) from public, anon;
grant execute on function public.mp_mod_can(text) to authenticated;
grant execute on function public.mp_staff_can(text) to authenticated;
grant execute on function public.mp_my_access() to authenticated;
grant execute on function public.mp_admin_save_moderator(uuid, text, text, text[], text) to authenticated;
grant execute on function public.mp_admin_remove_moderator(uuid) to authenticated;
grant select, insert, update, delete on public.mp_moderators to authenticated;
