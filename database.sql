-- Gastos v15: almacenamiento privado por usuario
create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_data enable row level security;

drop policy if exists "users can read own data" on public.user_app_data;
drop policy if exists "users can insert own data" on public.user_app_data;
drop policy if exists "users can update own data" on public.user_app_data;

create policy "users can read own data"
on public.user_app_data for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert own data"
on public.user_app_data for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update own data"
on public.user_app_data for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
