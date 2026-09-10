-- Aplicar después de supabase-stage2-modules.sql y supabase-fix-shared-sync.sql.
-- No elimina registros. Alinea el acceso con los participantes de la asignación.
begin;

create or replace function public.can_assign_collaborator(target_number text)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(exists (
    select 1 from public.profiles target
    where target.employee_number=target_number and target.active
      and target.employee_number<>(public.current_profile()).employee_number
      and (public.can_manage_all() or
        (case (public.current_profile()).role
          when 'APODERADA_LEGAL' then 1 when 'DIRECTOR' then 2
          when 'GERENTE_GENERAL' then 3 when 'ADMIN_GENERAL' then 3
          when 'GERENTE_TIENDA' then 4 when 'ADMIN_TIENDA' then 4
          when 'JEFE_AREA' then 5 when 'CAJERO' then 5 else 6 end)
        < (case target.role
          when 'APODERADA_LEGAL' then 1 when 'DIRECTOR' then 2
          when 'GERENTE_GENERAL' then 3 when 'ADMIN_GENERAL' then 3
          when 'GERENTE_TIENDA' then 4 when 'ADMIN_TIENDA' then 4
          when 'JEFE_AREA' then 5 when 'CAJERO' then 5 else 6 end))
  ), false)
$$;

drop policy if exists module_select on public.daily_task_records;
drop policy if exists module_insert on public.daily_task_records;
drop policy if exists module_update on public.daily_task_records;
drop policy if exists module_delete on public.daily_task_records;
create policy module_select on public.daily_task_records for select to authenticated using (
  public.can_manage_all() or (public.current_profile()).employee_number in
    (payload->>'employeeId', payload->>'assignedById')
);
create policy module_insert on public.daily_task_records for insert to authenticated with check (
  updated_by=auth.uid() and employee_number=payload->>'employeeId'
  and payload->>'assignedById'=(public.current_profile()).employee_number
  and public.can_assign_collaborator(payload->>'employeeId')
);
create policy module_update on public.daily_task_records for update to authenticated using (
  public.can_manage_all() or (public.current_profile()).employee_number in
    (payload->>'employeeId', payload->>'assignedById')
) with check (
  updated_by=auth.uid() and employee_number=payload->>'employeeId'
  and (public.can_manage_all() or (public.current_profile()).employee_number in
    (payload->>'employeeId', payload->>'assignedById'))
);

drop policy if exists module_select on public.internal_request_records;
drop policy if exists module_insert on public.internal_request_records;
drop policy if exists module_update on public.internal_request_records;
drop policy if exists module_delete on public.internal_request_records;
create policy module_select on public.internal_request_records for select to authenticated using (
  (public.current_profile()).employee_number in (payload->>'requestedById', payload->>'recipientId')
  or (public.can_manage_all() and coalesce(payload->>'confidentiality','Normal')<>'Confidencial')
);
create policy module_insert on public.internal_request_records for insert to authenticated with check (
  updated_by=auth.uid() and employee_number=payload->>'requestedById'
  and (payload->>'requestedById'=(public.current_profile()).employee_number
    or (payload->>'requestedById'='sistema' and public.can_manage_all()))
  and coalesce(payload->>'recipientId','')<>''
);
create policy module_update on public.internal_request_records for update to authenticated using (
  (public.current_profile()).employee_number=payload->>'recipientId'
  or (public.can_manage_all() and coalesce(payload->>'confidentiality','Normal')<>'Confidencial')
) with check (
  updated_by=auth.uid() and employee_number=payload->>'requestedById'
  and ((public.current_profile()).employee_number=payload->>'recipientId'
    or (public.can_manage_all() and coalesce(payload->>'confidentiality','Normal')<>'Confidencial'))
);
-- UPDATE and INSERT are separate: a recipient may respond to an existing
-- request without having permission to create requests in the author's name.
create or replace function public.sync_assignment_records(module_name text, records jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare
  table_name text; item jsonb; existing_payload jsonb; owner_number text; affected integer;
begin
  table_name := case module_name when 'dailyTasks' then 'daily_task_records'
    when 'internalRequests' then 'internal_request_records' else null end;
  if table_name is null then raise exception 'Modulo no permitido'; end if;
  for item in select value from jsonb_array_elements(records) loop
    execute format('select payload from public.%I where record_id=$1', table_name)
      into existing_payload using item->>'id';
    if existing_payload = item then continue; end if;
    owner_number := case module_name when 'dailyTasks' then item->>'employeeId' else item->>'requestedById' end;
    execute format('update public.%I set employee_number=$2, record_date=$3,
      payload=$4, updated_at=now(), updated_by=auth.uid() where record_id=$1', table_name)
      using item->>'id', owner_number, nullif(item->>'date','')::date, item;
    get diagnostics affected = row_count;
    if affected=0 then
      execute format('insert into public.%I (record_id, employee_number, branch, record_date, payload, updated_by)
        values ($1,$2,$3,$4,$5,auth.uid())', table_name)
        using item->>'id', owner_number, coalesce(item->>'branch',(public.current_profile()).branch), nullif(item->>'date','')::date, item;
    end if;
  end loop;
end $$;
revoke all on function public.sync_assignment_records(text,jsonb) from public;
grant execute on function public.sync_assignment_records(text,jsonb) to authenticated;
commit;
