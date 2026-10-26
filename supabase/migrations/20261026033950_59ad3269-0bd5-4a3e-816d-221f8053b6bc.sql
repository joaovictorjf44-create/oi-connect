create table if not exists public.finance_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_snapshots add column if not exists created_at timestamptz not null default now();

grant select, insert, update, delete on public.finance_snapshots to authenticated;
grant all on public.finance_snapshots to service_role;
revoke all on public.finance_snapshots from anon;

alter table public.finance_snapshots enable row level security;

drop policy if exists "Users can read their own finance snapshot" on public.finance_snapshots;
drop policy if exists "Users can create their own finance snapshot" on public.finance_snapshots;
drop policy if exists "Users can update their own finance snapshot" on public.finance_snapshots;
drop policy if exists "Users can delete their own finance snapshot" on public.finance_snapshots;

create policy "Users can read their own finance snapshot"
on public.finance_snapshots for select to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own finance snapshot"
on public.finance_snapshots for insert to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own finance snapshot"
on public.finance_snapshots for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own finance snapshot"
on public.finance_snapshots for delete to authenticated
using (auth.uid() = user_id);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_finance_snapshots_updated_at on public.finance_snapshots;
create trigger update_finance_snapshots_updated_at
before update on public.finance_snapshots
for each row execute function public.update_updated_at_column();