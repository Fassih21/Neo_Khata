-- NEO Dental Clinic — migration 0001 (run once in Supabase SQL Editor, AFTER 0000)
-- Fixes RLS gaps, adds reminder log, balance views, dashboard RPCs, money guards.

-- 0. Backfill profiles (FK target for created_by) -----------------------------------------
insert into public.profiles (id, full_name)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- 1. Staff check + lock function execution ------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid())
$$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;

-- 2. Audit defaults ------------------------------------------------------------------------
alter table public.patients   alter column created_by set default auth.uid();
alter table public.treatments alter column created_by set default auth.uid();
alter table public.expenses   alter column created_by set default auth.uid();
alter table public.payments   alter column received_by set default auth.uid();

-- 3. RLS hardening: "using (true)" let ANY logged-in user (even without a role) read data --
drop policy if exists "patients select" on public.patients;
drop policy if exists "patients insert" on public.patients;
drop policy if exists "patients update" on public.patients;
create policy "patients select staff" on public.patients for select to authenticated using (public.is_staff());
create policy "patients insert staff" on public.patients for insert to authenticated with check (public.is_staff());
create policy "patients update staff" on public.patients for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "services select" on public.services;
create policy "services select staff" on public.services for select to authenticated using (public.is_staff());

drop policy if exists "treatments select" on public.treatments;
drop policy if exists "treatments insert" on public.treatments;
drop policy if exists "treatments update" on public.treatments;
create policy "treatments select staff" on public.treatments for select to authenticated using (public.is_staff());
create policy "treatments insert staff" on public.treatments for insert to authenticated with check (public.is_staff());
create policy "treatments update staff" on public.treatments for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "payments select" on public.payments;
drop policy if exists "payments insert" on public.payments;
create policy "payments select staff" on public.payments for select to authenticated using (public.is_staff());
create policy "payments insert staff" on public.payments for insert to authenticated with check (public.is_staff());

-- Manager can add expenses and see only the ones they added; owner sees all.
drop policy if exists "expenses select" on public.expenses;
drop policy if exists "expenses insert" on public.expenses;
create policy "expenses select owner or own" on public.expenses for select to authenticated
  using (public.has_role(auth.uid(), 'owner') or created_by = auth.uid());
create policy "expenses insert staff" on public.expenses for insert to authenticated
  with check (public.is_staff() and (created_by is null or created_by = auth.uid()));

drop policy if exists "clinic_settings select" on public.clinic_settings;
create policy "clinic_settings select staff" on public.clinic_settings for select to authenticated using (public.is_staff());

-- 4. Money guards --------------------------------------------------------------------------
alter table public.treatments drop constraint if exists treatments_discount_lte_total;
alter table public.treatments add constraint treatments_discount_lte_total check (discount <= total_amount);

create or replace function public.payments_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare billed numeric; paid numeric; t_net numeric; t_paid numeric;
begin
  select coalesce(sum(total_amount - discount), 0) into billed from public.treatments where patient_id = new.patient_id;
  select coalesce(sum(amount), 0) into paid from public.payments where patient_id = new.patient_id and id <> new.id;
  if paid + new.amount > billed then
    raise exception 'Payment exceeds pending amount (pending: Rs %)', (billed - paid) using errcode = 'check_violation';
  end if;
  if new.treatment_id is not null then
    select (total_amount - discount) into t_net from public.treatments where id = new.treatment_id and patient_id = new.patient_id;
    if t_net is null then
      raise exception 'Treatment does not belong to this patient' using errcode = 'check_violation';
    end if;
    select coalesce(sum(amount), 0) into t_paid from public.payments where treatment_id = new.treatment_id and id <> new.id;
    if t_paid + new.amount > t_net then
      raise exception 'Payment exceeds this treatment''s pending amount (pending: Rs %)', (t_net - t_paid) using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_payments_guard on public.payments;
create trigger trg_payments_guard before insert or update of amount, patient_id, treatment_id on public.payments
for each row execute function public.payments_guard();

create or replace function public.treatments_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare others numeric; paid numeric; t_paid numeric;
begin
  select coalesce(sum(total_amount - discount), 0) into others from public.treatments where patient_id = new.patient_id and id <> new.id;
  select coalesce(sum(amount), 0) into paid from public.payments where patient_id = new.patient_id;
  if others + (new.total_amount - new.discount) < paid then
    raise exception 'Cannot reduce bill below amount already paid (Rs %)', paid using errcode = 'check_violation';
  end if;
  select coalesce(sum(amount), 0) into t_paid from public.payments where treatment_id = new.id;
  if (new.total_amount - new.discount) < t_paid then
    raise exception 'Cannot reduce bill below amount already paid on this treatment (Rs %)', t_paid using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_treatments_guard on public.treatments;
create trigger trg_treatments_guard before update of total_amount, discount on public.treatments
for each row execute function public.treatments_guard();

-- 5. Balance views (pending is ALWAYS derived here) ---------------------------------------
create or replace view public.patient_balances with (security_invoker = true) as
select p.id as patient_id,
       coalesce(t.billed, 0)::numeric(14,2) as total_billed,
       coalesce(pm.paid, 0)::numeric(14,2) as total_paid,
       (coalesce(t.billed, 0) - coalesce(pm.paid, 0))::numeric(14,2) as pending_amount
from public.patients p
left join (select patient_id, sum(total_amount - discount) as billed from public.treatments group by patient_id) t on t.patient_id = p.id
left join (select patient_id, sum(amount) as paid from public.payments group by patient_id) pm on pm.patient_id = p.id;

create or replace view public.treatment_balances with (security_invoker = true) as
select t.id as treatment_id, t.patient_id,
       (t.total_amount - t.discount)::numeric(14,2) as net_amount,
       coalesce(sum(y.amount), 0)::numeric(14,2) as paid_amount,
       ((t.total_amount - t.discount) - coalesce(sum(y.amount), 0))::numeric(14,2) as pending_amount
from public.treatments t
left join public.payments y on y.treatment_id = t.id
group by t.id;

-- 6. Reminder log ---------------------------------------------------------------------------
create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  pending_amount numeric(12,2) not null default 0,
  message text,
  sent_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_reminder_patient on public.reminder_log(patient_id, created_at desc);
alter table public.reminder_log enable row level security;
create policy "reminder select staff" on public.reminder_log for select to authenticated using (public.is_staff());
create policy "reminder insert staff" on public.reminder_log for insert to authenticated with check (public.is_staff());
create policy "reminder delete owner" on public.reminder_log for delete to authenticated using (public.has_role(auth.uid(), 'owner'));
grant select, insert, delete on public.reminder_log to authenticated;
grant all on public.reminder_log to service_role;

create or replace view public.pending_list with (security_invoker = true) as
select p.id as patient_id, p.full_name, p.phone,
       b.total_billed, b.total_paid, b.pending_amount,
       (select max(r.created_at) from public.reminder_log r where r.patient_id = p.id) as last_reminder_at,
       (select count(*) from public.reminder_log r where r.patient_id = p.id)::int as reminder_count,
       (select max(t.treatment_date) from public.treatments t where t.patient_id = p.id) as last_treatment_date
from public.patients p
join public.patient_balances b on b.patient_id = p.id
where b.pending_amount > 0;

grant select on public.patient_balances, public.treatment_balances, public.pending_list to authenticated;

-- 7. Dashboard RPCs (owner gets money totals; manager gets a limited, money-free-of-profit set)
create or replace function public.dashboard_owner(_month date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  m0 date := date_trunc('month', _month)::date;
  m1 date := (date_trunc('month', _month) + interval '1 month')::date;
  rev numeric; exp numeric; sal_paid numeric; sal_pending numeric;
  active int; pend numeric; billed numeric; paid_all numeric; trend jsonb;
begin
  if not public.has_role(auth.uid(), 'owner') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(sum(amount), 0) into rev from public.payments where payment_date >= m0 and payment_date < m1;
  select coalesce(sum(amount), 0) into exp from public.expenses where expense_date >= m0 and expense_date < m1;
  select coalesce(sum(amount) filter (where status = 'paid'), 0),
         coalesce(sum(amount) filter (where status = 'pending'), 0)
    into sal_paid, sal_pending from public.salaries where month >= m0 and month < m1;
  select count(*) into active from public.patients p
   where exists (select 1 from public.treatments t where t.patient_id = p.id and t.treatment_date >= m0 and t.treatment_date < m1)
      or exists (select 1 from public.payments y where y.patient_id = p.id and y.payment_date >= m0 and y.payment_date < m1);
  select coalesce(sum(pending_amount), 0), coalesce(sum(total_billed), 0), coalesce(sum(total_paid), 0)
    into pend, billed, paid_all from public.patient_balances;
  select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(g, 'YYYY-MM'),
      'revenue', (select coalesce(sum(amount), 0) from public.payments where payment_date >= g::date and payment_date < (g + interval '1 month')::date),
      'expenses', (select coalesce(sum(amount), 0) from public.expenses where expense_date >= g::date and expense_date < (g + interval '1 month')::date)
                + (select coalesce(sum(amount), 0) from public.salaries where status = 'paid' and month >= g::date and month < (g + interval '1 month')::date)
    ) order by g), '[]'::jsonb)
    into trend from generate_series(m0 - interval '5 months', m0, interval '1 month') g;
  return jsonb_build_object(
    'revenue', rev, 'expenses_other', exp, 'salaries_paid', sal_paid, 'expenses_total', exp + sal_paid,
    'net', rev - exp - sal_paid, 'active_patients', active, 'pending_amount', pend,
    'salaries_pending', sal_pending, 'total_billed', billed, 'total_paid', paid_all, 'trend', trend);
end $$;

create or replace function public.dashboard_manager(_month date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  m0 date := date_trunc('month', _month)::date;
  m1 date := (date_trunc('month', _month) + interval '1 month')::date;
  active int; newp int; tcount int; pend numeric; pcount int;
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select count(*) into active from public.patients p
   where exists (select 1 from public.treatments t where t.patient_id = p.id and t.treatment_date >= m0 and t.treatment_date < m1)
      or exists (select 1 from public.payments y where y.patient_id = p.id and y.payment_date >= m0 and y.payment_date < m1);
  select count(*) into newp from public.patients where created_at >= m0 and created_at < m1;
  select count(*) into tcount from public.treatments where treatment_date >= m0 and treatment_date < m1;
  select coalesce(sum(pending_amount), 0), count(*) filter (where pending_amount > 0) into pend, pcount from public.patient_balances;
  return jsonb_build_object('active_patients', active, 'new_patients', newp, 'treatments', tcount,
                            'pending_amount', pend, 'patients_with_pending', pcount);
end $$;

revoke all on function public.dashboard_owner(date), public.dashboard_manager(date) from public, anon;
grant execute on function public.dashboard_owner(date), public.dashboard_manager(date) to authenticated, service_role;

-- 8. FIRST OWNER (run once, put YOUR login email) -------------------------------------------
-- 1) Supabase Dashboard > Authentication > Users > Add user (email + password)
-- 2) Authentication > Providers > Email > turn OFF "Allow new users to sign up"
-- 3) Then run:
-- insert into public.user_roles (user_id, role)
-- select id, 'owner' from auth.users where email = 'YOUR_EMAIL_HERE'
-- on conflict do nothing;
