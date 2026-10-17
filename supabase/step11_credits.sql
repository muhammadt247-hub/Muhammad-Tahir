-- OrbinexaCSV — STEP 11: Credit Wallets, Transactions & Summary Functions
-- NOTE: The user has executed or will execute this SQL in their Supabase project.
-- This file is kept in the repository for reference and migration documentation.

create or replace function public.my_credit_summary()
returns table(balance int, total_received int, total_spent int)
language sql security definer set search_path = public stable as $$
  select
    coalesce((select w.balance from public.credit_wallets w where w.user_id = auth.uid()), 0)::int,
    coalesce((select sum(t.amount) from public.credit_transactions t where t.user_id = auth.uid() and t.kind in ('bonus','grant')), 0)::int,
    coalesce((select -sum(t.amount) from public.credit_transactions t where t.user_id = auth.uid() and t.kind in ('spend','refund')), 0)::int;
$$;

revoke execute on function public.my_credit_summary() from public, anon;
grant execute on function public.my_credit_summary() to authenticated;
