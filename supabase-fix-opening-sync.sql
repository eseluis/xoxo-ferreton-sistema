-- Conserva el historial y combina campos bajo bloqueo de la fila compartida.
begin;
create or replace function public.patch_store_opening_checks(records jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  actor public.profiles;
  saved jsonb;
  item jsonb;
  existing jsonb;
begin
  actor := public.current_profile();
  if auth.uid() is null or actor.employee_number is null then
    raise exception 'Sesión no autorizada';
  end if;
  if jsonb_typeof(records) <> 'array' or records is null then
    raise exception 'Se requiere una lista de cambios';
  end if;
  insert into public.app_state(key,value,updated_by)
    values ('xoxo.storeOpeningChecks','[]'::jsonb,auth.uid()) on conflict (key) do nothing;
  select value into saved from public.app_state
    where key='xoxo.storeOpeningChecks' for update;
  for item in select value from jsonb_array_elements(records) loop
    if coalesce(item->>'branch','') not in ('Matriz','Sucursal Centro')
      or coalesce(item->>'date','') = ''
      or item->>'id' is distinct from (item->>'date') || '-' || (item->>'branch') then
      raise exception 'Identificador de apertura inválido';
    end if;
    if not public.can_manage_all() and actor.branch is distinct from item->>'branch' then
      raise exception 'Sin permiso para esta sucursal';
    end if;
    select value into existing from jsonb_array_elements(saved) where value->>'id'=item->>'id';
    existing := coalesce(existing,jsonb_build_object('minimumStaff',false,'systemsReady',false,'processComplete',false)) || item;
    select coalesce(jsonb_agg(value),'[]'::jsonb) into saved
      from jsonb_array_elements(saved) where value->>'id' is distinct from item->>'id';
    saved := saved || jsonb_build_array(existing);
  end loop;
  update public.app_state set value=saved,updated_by=auth.uid(),updated_at=now()
    where key='xoxo.storeOpeningChecks';
end $$;
revoke all on function public.patch_store_opening_checks(jsonb) from public, anon;
grant execute on function public.patch_store_opening_checks(jsonb) to authenticated;
-- Las versiones viejas tampoco pueden volver a reemplazar la lista completa.
drop policy if exists opening_no_direct_insert on public.app_state;
create policy opening_no_direct_insert on public.app_state as restrictive for insert to authenticated
  with check (key <> 'xoxo.storeOpeningChecks');
drop policy if exists opening_no_direct_update on public.app_state;
create policy opening_no_direct_update on public.app_state as restrictive for update to authenticated
  using (key <> 'xoxo.storeOpeningChecks') with check (key <> 'xoxo.storeOpeningChecks');
drop policy if exists opening_no_direct_delete on public.app_state;
create policy opening_no_direct_delete on public.app_state as restrictive for delete to authenticated
  using (key <> 'xoxo.storeOpeningChecks');
commit;
