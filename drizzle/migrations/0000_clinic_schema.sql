-- NEO Dental Clinic — scaffold schema
create type public.app_role as enum ('owner', 'manager');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  address text,
  age integer check (age is null or age >= 0),
  gender text check (gender in ('male', 'female', 'other')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_price numeric(12,2) not null default 0 check (default_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade not null,
  service_id uuid references public.services(id) on delete set null,
  treatment_date date not null default current_date,
  description text,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  status text not null default 'ongoing' check (status in ('ongoing', 'completed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade not null,
  treatment_id uuid references public.treatments(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  payment_date date not null default current_date,
  method text not null default 'cash' check (method in ('cash', 'bank', 'easypaisa', 'jazzcash')),
  note text,
  received_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  role_title text not null,
  monthly_salary numeric(12,2) not null default 0 check (monthly_salary >= 0),
  joining_date date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.salaries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade not null,
  month date not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, month)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'other' check (category in ('rent', 'utilities', 'dental supplies', 'lab', 'equipment', 'maintenance', 'other')),
  amount numeric(12,2) not null check (amount >= 0),
  expense_date date not null default current_date,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  single_row boolean not null default true check (single_row),
  clinic_name text not null default 'NEO Dental Clinic',
  phone text,
  address text,
  currency text not null default 'Rs',
  whatsapp_reminder_template text not null default 'Assalam o Alaikum {patient_name}, this is a friendly reminder from {clinic_name}. Your pending amount is Rs {pending_amount}. Kindly clear it at your earliest convenience. Thank you!',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view public.patient_balances
with (security_invoker = true) as
select
  t.patient_id,
  coalesce(sum(t.total_amount - t.discount), 0)::numeric(14,2) as total_billed,
  coalesce(p.total_paid, 0)::numeric(14,2) as total_paid,
  (coalesce(sum(t.total_amount - t.discount), 0) - coalesce(p.total_paid, 0))::numeric(14,2) as pending_amount
from public.treatments t
left join (
  select patient_id, sum(amount) as total_paid
  from public.payments
  group by patient_id
) p on p.patient_id = t.patient_id
group by t.patient_id, p.total_paid;

create index idx_patients_created_by on public.patients(created_by);
create index idx_treatments_patient on public.treatments(patient_id);
create index idx_treatments_service on public.treatments(service_id);
create index idx_treatments_date on public.treatments(treatment_date);
create index idx_payments_patient on public.payments(patient_id);
create index idx_payments_treatment on public.payments(treatment_id);
create index idx_payments_date on public.payments(payment_date);
create index idx_salaries_employee on public.salaries(employee_id);
create index idx_salaries_month on public.salaries(month);
create index idx_expenses_date on public.expenses(expense_date);
create index idx_expenses_created_by on public.expenses(created_by);

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_user_roles_updated before update on public.user_roles for each row execute function public.set_updated_at();
create trigger trg_patients_updated before update on public.patients for each row execute function public.set_updated_at();
create trigger trg_services_updated before update on public.services for each row execute function public.set_updated_at();
create trigger trg_treatments_updated before update on public.treatments for each row execute function public.set_updated_at();
create trigger trg_payments_updated before update on public.payments for each row execute function public.set_updated_at();
create trigger trg_employees_updated before update on public.employees for each row execute function public.set_updated_at();
create trigger trg_salaries_updated before update on public.salaries for each row execute function public.set_updated_at();
create trigger trg_expenses_updated before update on public.expenses for each row execute function public.set_updated_at();
create trigger trg_clinic_settings_updated before update on public.clinic_settings for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.patients, public.treatments, public.payments, public.expenses, public.clinic_settings, public.services to authenticated;
grant select, insert, update, delete on public.employees, public.salaries to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.patient_balances to authenticated;
grant all on public.patients, public.treatments, public.payments, public.employees, public.salaries, public.expenses, public.clinic_settings, public.services, public.profiles, public.user_roles to service_role;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.patients enable row level security;
alter table public.services enable row level security;
alter table public.treatments enable row level security;
alter table public.payments enable row level security;
alter table public.employees enable row level security;
alter table public.salaries enable row level security;
alter table public.expenses enable row level security;
alter table public.clinic_settings enable row level security;

create policy "profiles select own or owner" on public.profiles
for select to authenticated
using (auth.uid() = id or public.has_role(auth.uid(), 'owner'));
create policy "profiles update own or owner" on public.profiles
for update to authenticated
using (auth.uid() = id or public.has_role(auth.uid(), 'owner'))
with check (auth.uid() = id or public.has_role(auth.uid(), 'owner'));

create policy "user_roles select own or owner" on public.user_roles
for select to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'owner'));
create policy "user_roles owner all" on public.user_roles
for all to authenticated
using (public.has_role(auth.uid(), 'owner'))
with check (public.has_role(auth.uid(), 'owner'));

create policy "patients select" on public.patients
for select to authenticated using (true);
create policy "patients insert" on public.patients
for insert to authenticated with check (true);
create policy "patients update" on public.patients
for update to authenticated using (true) with check (true);
create policy "patients delete owner" on public.patients
for delete to authenticated using (public.has_role(auth.uid(), 'owner'));

create policy "services select" on public.services
for select to authenticated using (true);
create policy "services owner insert" on public.services
for insert to authenticated with check (public.has_role(auth.uid(), 'owner'));
create policy "services owner update" on public.services
for update to authenticated using (public.has_role(auth.uid(), 'owner')) with check (public.has_role(auth.uid(), 'owner'));
create policy "services owner delete" on public.services
for delete to authenticated using (public.has_role(auth.uid(), 'owner'));

create policy "treatments select" on public.treatments
for select to authenticated using (true);
create policy "treatments insert" on public.treatments
for insert to authenticated with check (true);
create policy "treatments update" on public.treatments
for update to authenticated using (true) with check (true);
create policy "treatments delete owner" on public.treatments
for delete to authenticated using (public.has_role(auth.uid(), 'owner'));

create policy "payments select" on public.payments
for select to authenticated using (true);
create policy "payments insert" on public.payments
for insert to authenticated with check (true);
create policy "payments owner update" on public.payments
for update to authenticated using (public.has_role(auth.uid(), 'owner')) with check (public.has_role(auth.uid(), 'owner'));
create policy "payments owner delete" on public.payments
for delete to authenticated using (public.has_role(auth.uid(), 'owner'));

create policy "employees owner select" on public.employees
for select to authenticated using (public.has_role(auth.uid(), 'owner'));
create policy "employees owner insert" on public.employees
for insert to authenticated with check (public.has_role(auth.uid(), 'owner'));
create policy "employees owner update" on public.employees
for update to authenticated using (public.has_role(auth.uid(), 'owner')) with check (public.has_role(auth.uid(), 'owner'));
create policy "employees owner delete" on public.employees
for delete to authenticated using (public.has_role(auth.uid(), 'owner'));

create policy "salaries owner select" on public.salaries
for select to authenticated using (public.has_role(auth.uid(), 'owner'));
create policy "salaries owner insert" on public.salaries
for insert to authenticated with check (public.has_role(auth.uid(), 'owner'));
create policy "salaries owner update" on public.salaries
for update to authenticated using (public.has_role(auth.uid(), 'owner')) with check (public.has_role(auth.uid(), 'owner'));
create policy "salaries owner delete" on public.salaries
for delete to authenticated using (public.has_role(auth.uid(), 'owner'));

create policy "expenses select" on public.expenses
for select to authenticated using (true);
create policy "expenses insert" on public.expenses
for insert to authenticated with check (true);
create policy "expenses owner update" on public.expenses
for update to authenticated using (public.has_role(auth.uid(), 'owner')) with check (public.has_role(auth.uid(), 'owner'));
create policy "expenses owner delete" on public.expenses
for delete to authenticated using (public.has_role(auth.uid(), 'owner'));

create policy "clinic_settings select" on public.clinic_settings
for select to authenticated using (true);
create policy "clinic_settings owner update" on public.clinic_settings
for update to authenticated using (public.has_role(auth.uid(), 'owner')) with check (public.has_role(auth.uid(), 'owner'));

insert into public.services (name, default_price) values
  ('Scaling', 3000),
  ('Filling', 4000),
  ('Root Canal', 15000),
  ('Extraction', 5000),
  ('Braces', 120000),
  ('Whitening', 12000),
  ('Crown', 25000),
  ('Dentures', 40000)
on conflict (name) do nothing;

insert into public.clinic_settings (clinic_name)
select 'NEO Dental Clinic'
where not exists (select 1 from public.clinic_settings);