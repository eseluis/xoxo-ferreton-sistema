-- Seguridad base y auditoria. Ejecutar en Supabase SQL Editor antes de publicar.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  employee_number text not null unique,
  display_name text not null,
  role text not null,
  branch text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_state add column if not exists updated_by uuid references auth.users(id);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_key text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_value jsonb,
  new_value jsonb,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.app_state enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "app_state_read" on public.app_state;
drop policy if exists "app_state_write" on public.app_state;
drop policy if exists "profiles_read_authenticated" on public.profiles;
drop policy if exists "app_state_read_authenticated" on public.app_state;
drop policy if exists "app_state_write_authenticated" on public.app_state;
drop policy if exists "audit_read_directors" on public.audit_log;

create policy "profiles_read_authenticated" on public.profiles
for select to authenticated
using (active = true);

create policy "app_state_read_authenticated" on public.app_state
for select to authenticated
using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active));

create policy "app_state_write_authenticated" on public.app_state
for all to authenticated
using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active))
with check (
  updated_by = auth.uid()
  and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.active)
);

create policy "audit_read_directors" on public.audit_log
for select to authenticated
using (exists (
  select 1 from public.profiles p where p.user_id = auth.uid() and p.active
  and p.role in ('APODERADA_LEGAL', 'DIRECTOR', 'GERENTE_GENERAL', 'ADMIN_GENERAL')
));

create or replace function public.audit_app_state_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(table_name, record_key, action, old_value, new_value, changed_by)
  values (
    'app_state', coalesce(new.key, old.key), tg_op,
    case when tg_op in ('UPDATE','DELETE') then old.value else null end,
    case when tg_op in ('INSERT','UPDATE') then new.value else null end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists app_state_audit_trigger on public.app_state;
create trigger app_state_audit_trigger after insert or update or delete on public.app_state
for each row execute function public.audit_app_state_change();

revoke all on public.app_state from anon;
revoke all on public.profiles from anon;
revoke all on public.audit_log from anon;
grant select, insert, update, delete on public.app_state to authenticated;
grant select on public.profiles to authenticated;
grant select on public.audit_log to authenticated;
