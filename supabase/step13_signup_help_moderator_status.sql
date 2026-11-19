-- Step 13: help people whose confirmation email does not arrive, moderator WhatsApp numbers, moderator online status.
-- Adds only; existing admin rules are unchanged.

-- 1. New moderator permission "signups" (see waiting sign-ups and activate accounts) + WhatsApp number
alter table public.mp_moderators drop constraint if exists mp_moderators_perms_ok;
alter table public.mp_moderators add constraint mp_moderators_perms_ok check (
  permissions <@ array['orders_view','orders_manage','vendor_payments','catalog','vendors','statuses','insights','signups']::text[]
);
alter table public.mp_moderators add column if not exists whatsapp text;
alter table public.mp_moderators drop constraint if exists mp_moderators_whatsapp_ok;
alter table public.mp_moderators add constraint mp_moderators_whatsapp_ok check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$');

-- 2. "What may I do?" now also lists "signups" for the Super Admin, and "last active" updates every minute
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
      'permissions', to_jsonb(array['orders_view','orders_manage','vendor_payments','catalog','vendors','statuses','insights','signups']));
  end if;

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
   where id = m.id and (last_active_at is null or last_active_at < now() - interval '1 minute');
  return jsonb_build_object('super', false, 'moderator', true, 'permissions', to_jsonb(m.permissions));
end;
$$;

-- 3. Save moderator: same as before plus an optional WhatsApp number (digits with country code)
drop function if exists public.mp_admin_save_moderator(uuid, text, text, text[], text);
create or replace function public.mp_admin_save_moderator(
  p_id uuid, p_email text, p_name text, p_permissions text[], p_status text, p_whatsapp text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_wa text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g'), '');
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
  -- Pakistani numbers written as 03xx... become 923xx...
  if v_wa is not null and v_wa ~ '^0[0-9]{10}$' then v_wa := '92' || substr(v_wa, 2); end if;
  if v_wa is not null and v_wa !~ '^[0-9]{10,15}$' then raise exception 'Please enter the WhatsApp number with country code, e.g. 923001234567'; end if;

  select coalesce(array_agg(distinct x order by x), '{}') into v_perms
    from unnest(coalesce(p_permissions, '{}')) x
   where x in ('orders_view','orders_manage','vendor_payments','catalog','vendors','statuses','insights','signups');
  if ('orders_manage' = any (v_perms) or 'vendor_payments' = any (v_perms)) and not ('orders_view' = any (v_perms)) then
    v_perms := array_append(v_perms, 'orders_view');
  end if;

  if p_id is null then
    if exists (select 1 from public.mp_moderators where email = v_email) then
      raise exception 'This email is already a moderator';
    end if;
    insert into public.mp_moderators (email, display_name, permissions, status, invited_by, user_id, whatsapp)
    values (v_email, nullif(btrim(coalesce(p_name, '')), ''), v_perms, coalesce(p_status, 'active'), auth.uid(),
            (select u.id from auth.users u where lower(u.email) = v_email and u.email_confirmed_at is not null limit 1), v_wa)
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
      whatsapp = v_wa,
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

-- 4. Super Admin: when did each moderator last log in? (account sign-in time)
create or replace function public.mp_admin_moderator_logins()
returns table (moderator_id uuid, last_sign_in_at timestamptz, account_exists boolean)
language sql stable security definer
set search_path = public
as $$
  select m.id,
         coalesce(u1.last_sign_in_at, u2.last_sign_in_at),
         (u1.id is not null or u2.id is not null)
    from public.mp_moderators m
    left join auth.users u1 on u1.id = m.user_id
    left join auth.users u2 on m.user_id is null and lower(u2.email) = m.email
   where public.mp_is_admin();
$$;

-- 5. Sign-ups still waiting for email confirmation (last 30 days), for the Super Admin or a moderator with "signups"
create or replace function public.mp_admin_waiting_signups()
returns table (user_id uuid, email text, display_name text, created_at timestamptz, last_email_at timestamptz)
language sql stable security definer
set search_path = public
as $$
  select u.id, u.email::text, coalesce(u.raw_user_meta_data->>'display_name', ''), u.created_at, u.confirmation_sent_at
    from auth.users u
   where public.mp_staff_can('signups')
     and u.email_confirmed_at is null
     and u.created_at > now() - interval '30 days'
   order by u.created_at desc
   limit 200;
$$;

-- 6. Activate (confirm) one waiting account by hand, after the person contacted you
create or replace function public.mp_admin_confirm_signup(p_user uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_email text;
begin
  if not public.mp_staff_can('signups') then raise exception 'not allowed'; end if;
  update auth.users set email_confirmed_at = now(), updated_at = now()
   where id = p_user and email_confirmed_at is null
   returning email into v_email;
  if v_email is null then raise exception 'This account is already active or was not found'; end if;
  insert into public.mp_audit_log (admin_id, action, details)
  values (auth.uid(), 'signup_activated', jsonb_build_object('user', p_user, 'email', v_email));
end;
$$;

-- 7. Who may call what
revoke all on function public.mp_my_access() from public, anon;
revoke all on function public.mp_admin_save_moderator(uuid, text, text, text[], text, text) from public, anon;
revoke all on function public.mp_admin_moderator_logins() from public, anon;
revoke all on function public.mp_admin_waiting_signups() from public, anon;
revoke all on function public.mp_admin_confirm_signup(uuid) from public, anon;
grant execute on function public.mp_my_access() to authenticated;
grant execute on function public.mp_admin_save_moderator(uuid, text, text, text[], text, text) to authenticated;
grant execute on function public.mp_admin_moderator_logins() to authenticated;
grant execute on function public.mp_admin_waiting_signups() to authenticated;
grant execute on function public.mp_admin_confirm_signup(uuid) to authenticated;
