-- Apply after the existing base, shared-sync and Centro migrations, before publishing.
begin;
create table if not exists public.operation_day_plans (
  employee_number text not null,
  day date not null,
  branch text not null,
  slots jsonb not null check (jsonb_typeof(slots)='array' and jsonb_array_length(slots)<=200),
  created_at timestamptz not null default now(),
  primary key(employee_number,day)
);
alter table public.operation_day_plans enable row level security;
revoke all on public.operation_day_plans from anon, authenticated;
grant select,insert on public.operation_day_plans to authenticated;
drop policy if exists calendar_read on public.operation_day_plans;
create policy calendar_read on public.operation_day_plans for select to authenticated using (
  (public.current_profile()).employee_number=employee_number or public.can_manage_branch(branch)
);
drop policy if exists calendar_insert on public.operation_day_plans;
create policy calendar_insert on public.operation_day_plans for insert to authenticated with check (
  (public.current_profile()).employee_number=employee_number
  and day=(now() at time zone 'America/Mexico_City')::date
  and branch=coalesce((select loc->>'location' from public.app_state s cross join lateral jsonb_array_elements(s.value) loc
    where s.key='xoxo.workLocations' and loc->>'employeeId'=employee_number and loc->>'date'=day::text limit 1),(public.current_profile()).branch)
);
create table if not exists public.operation_project_config (
  id text primary key check(id='stabilization'),
  start_day date not null
);
insert into public.operation_project_config values('stabilization','2026-10-01') on conflict do nothing;
alter table public.operation_project_config enable row level security;
revoke all on public.operation_project_config from anon, authenticated;
grant select,update on public.operation_project_config to authenticated;
drop policy if exists project_read on public.operation_project_config;
create policy project_read on public.operation_project_config for select to authenticated using ((public.current_profile()).employee_number is not null);
drop policy if exists project_update on public.operation_project_config;
create policy project_update on public.operation_project_config for update to authenticated using (public.can_manage_all()) with check(public.can_manage_all());

create or replace function public.operation_calendar_centro(from_day date,to_day date,target_employee text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor text; target_branch text;
begin
  actor := (public.current_profile()).employee_number;
  if actor is null then raise exception 'Sesión no autorizada'; end if;
  if from_day is null or to_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Periodo no válido'; end if;
  select branch into target_branch from public.profiles where employee_number=target_employee and active limit 1;
  if actor<>target_employee and not public.can_manage_branch(coalesce(target_branch,'')) then raise exception 'Sin permiso para consultar a este colaborador'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('data','{}'::jsonb) order by day,task_id) from public.centro_operation_records r
    where day between from_day and to_day and (owner_id=target_employee or exists (
      select 1 from public.operation_day_plans p cross join lateral jsonb_array_elements(p.slots) s
      where p.employee_number=target_employee and p.day=r.day and s->>'key'='Centro-'||r.task_id
    ))),'[]'::jsonb);
end $$;
revoke all on function public.operation_calendar_centro(date,date,text) from public,anon;
grant execute on function public.operation_calendar_centro(date,date,text) to authenticated;
commit;
