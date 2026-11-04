-- Mantiene directorio, perfiles y ubicación operativa en la misma transacción.
-- No cambia asignaciones de otros días ni avances/evidencias de actividades.
begin;
create or replace function public.sync_profiles_from_collaborators()
returns trigger language plpgsql security definer set search_path=public as $$
declare item jsonb; previous_branch text; locations jsonb; merged jsonb;
  today text := (now() at time zone 'America/Mexico_City')::date::text;
begin
  if new.key <> 'xoxo.collaborators' then return new; end if;
  for item in select value from jsonb_array_elements(new.value) loop
    update public.profiles
      set display_name=coalesce(item->>'name',display_name),
          role=coalesce(item->>'role',role), branch=coalesce(item->>'branch',branch), updated_at=now()
      where employee_number=item->>'id';
    previous_branch := null;
    if tg_op='UPDATE' then
      select e.value->>'branch' into previous_branch from jsonb_array_elements(old.value) e where e.value->>'id'=item->>'id' limit 1;
    end if;
    if previous_branch is not null and previous_branch is distinct from item->>'branch' then
      perform pg_advisory_xact_lock(hashtext('centro-assignments'));
      select value into locations from public.app_state where key='xoxo.workLocations' for update;
      if locations is not null then
        select coalesce(jsonb_agg(case when e.value->>'employeeId'=item->>'id' and e.value->>'date'=today
          then jsonb_set(e.value,'{location}',to_jsonb(item->>'branch')) else e.value end),'[]'::jsonb)
          into merged from jsonb_array_elements(locations) e;
        if merged is distinct from locations then
          update public.app_state set value=merged,updated_at=now(),updated_by=auth.uid() where key='xoxo.workLocations';
        end if;
      end if;
    end if;
  end loop;
  perform public.centro_reconcile_day(today::date);
  return new;
end $$;
revoke all on function public.sync_profiles_from_collaborators() from public,anon,authenticated;
drop trigger if exists collaborators_profile_sync on public.app_state;
create trigger collaborators_profile_sync after insert or update of value on public.app_state
for each row when (new.key='xoxo.collaborators') execute function public.sync_profiles_from_collaborators();
-- Reparar los perfiles que conservaban la tienda anterior por faltar el trigger.
update public.profiles p set display_name=coalesce(e.value->>'name',p.display_name),
 role=coalesce(e.value->>'role',p.role),branch=coalesce(e.value->>'branch',p.branch),updated_at=now()
from public.app_state s cross join lateral jsonb_array_elements(s.value) e
where s.key='xoxo.collaborators' and p.employee_number=e.value->>'id';
select public.centro_reconcile_day((now() at time zone 'America/Mexico_City')::date);
commit;
