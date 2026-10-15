-- Aplicar al final, después de las migraciones existentes. No borra registros.
begin;
create or replace function public.can_manage_all()
returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((public.current_profile()).role in ('APODERADA_LEGAL','DIRECTOR','GERENTE_GENERAL','ADMIN_GENERAL'),false)
$$;

create or replace function public.can_assign_collaborator(target_number text)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(exists (
    select 1 from public.profiles target
    where target.employee_number=target_number and target.active
      and target.employee_number<>(public.current_profile()).employee_number
      and (public.can_manage_all() or target.branch=(public.current_profile()).branch)
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


-- Conserva el acceso al trabajo propio cuando dirección asigna otra ubicación por día.
create or replace function public.store_record_boundary(target_branch text, target_employee text, target_day date)
returns boolean language sql stable security definer set search_path=public as $$
 select public.can_manage_all() or target_branch=(public.current_profile()).branch or (
 target_employee=(public.current_profile()).employee_number and exists(
 select 1 from public.app_state s cross join lateral jsonb_array_elements(s.value) w
 where s.key='xoxo.workLocations' and w->>'employeeId'=target_employee and w->>'date'=target_day::text and w->>'location'=target_branch))
$$;

-- Restricción adicional: las políticas anteriores nunca conceden acceso a otra tienda.
do $$ declare t text; begin
 foreach t in array array['attendance_records','evaluation_records','cash_incident_records','cash_session_records','cash_cut_records','supplier_records','payable_records','bank_account_records','bank_transaction_records','monthly_budget_records','kpi_records','process_audit_records','branch_opening_records','warranty_records','daily_task_records','process_instance_records','activity_run_records','cleaning_evaluation_records'] loop
  execute format('drop policy if exists store_boundary on public.%I',t);
  execute format('create policy store_boundary on public.%I as restrictive for all to authenticated using (public.store_record_boundary(branch,employee_number,record_date)) with check (public.store_record_boundary(branch,employee_number,record_date))',t);
 end loop;
end $$;

-- No se exponen las copias heredadas de módulos ni el catálogo salarial completo.
drop policy if exists store_shared_read on public.app_state;
create policy store_shared_read on public.app_state as restrictive for select to authenticated using (
 public.can_manage_all() or (key='xoxo.dexterPilot' and public.can_manage_branch('Sucursal Centro')) or key in ('xoxo.shiftConfigs','xoxo.activitySchedules','xoxo.cleaningRole','xoxo.workLocations')
);

create or replace function public.store_collaborators()
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(case when public.can_manage_all() or (item->>'branch'=(public.current_profile()).branch and (public.current_profile()).role in ('GERENTE_TIENDA','ADMIN_TIENDA')) or item->>'id'=(public.current_profile()).employee_number then item
 else item - 'salaryMin' - 'salaryMax' - 'commissionBase' end),'[]'::jsonb)
 from public.app_state s cross join lateral jsonb_array_elements(s.value) item
 where s.key='xoxo.collaborators' and (public.current_profile()).active
$$;

-- Valida cada fila modificada de la configuración compartida.
create or replace function public.guard_store_configuration()
returns trigger language plpgsql security definer set search_path=public as $$
declare before_rows jsonb; after_rows jsonb; r jsonb; target_branch text; actor public.profiles;
begin
 actor := public.current_profile();
 if public.can_manage_all() then return coalesce(new,old); end if;
 if actor.user_id is null then raise exception 'Sesión requerida'; end if;
 if tg_op='DELETE' then raise exception 'Solo dirección puede borrar configuración compartida'; end if;
 if new.key='xoxo.dexterPilot' then
  if not public.can_manage_branch('Sucursal Centro') then raise exception 'Piloto exclusivo de Centro'; end if;
  return new;
 end if;
 if new.key not in ('xoxo.collaborators','xoxo.activitySchedules','xoxo.cleaningRole','xoxo.workLocations','xoxo.storeOpeningChecks') then
  raise exception 'Configuración reservada a dirección';
 end if;
 before_rows := case when tg_op='INSERT' then '[]'::jsonb else old.value end;
 after_rows := new.value;
 for r in select value from jsonb_array_elements(before_rows) union select value from jsonb_array_elements(after_rows) loop
  if (before_rows @> jsonb_build_array(r)) = (after_rows @> jsonb_build_array(r)) then continue; end if;
  target_branch := coalesce(r->>'branch',(select branch from public.profiles where employee_number=r->>'employeeId' and active limit 1));
  if not (public.can_manage_branch(target_branch) or (new.key='xoxo.storeOpeningChecks' and actor.branch=target_branch and actor.role='CAJERO')) then raise exception 'Solo puedes modificar tu sucursal'; end if;
  if new.key='xoxo.workLocations' and r->>'location' is distinct from actor.branch then raise exception 'Solo dirección puede trasladar personal entre tiendas'; end if;
  if new.key='xoxo.collaborators' and r->>'role' in ('APODERADA_LEGAL','DIRECTOR','GERENTE_GENERAL','ADMIN_GENERAL') then raise exception 'Puesto reservado a dirección'; end if;
 end loop;
 return new;
end $$;
drop trigger if exists guard_store_configuration on public.app_state;
create trigger guard_store_configuration before insert or update or delete on public.app_state for each row execute function public.guard_store_configuration();

-- Se fusiona solo la sucursal autorizada para conservar los datos de las demás.
create or replace function public.save_store_collaborators(records jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare current_rows jsonb; merged jsonb; actor public.profiles;
begin
 actor := public.current_profile();
 if not public.can_manage_branch(actor.branch) then raise exception 'Sin permiso de administración'; end if;
 select value into current_rows from public.app_state where key='xoxo.collaborators' for update;
 if public.can_manage_all() then merged:=records;
 else
  select coalesce(jsonb_agg(item),'[]'::jsonb) into merged from jsonb_array_elements(current_rows) item where item->>'branch' is distinct from actor.branch;
  select merged || coalesce(jsonb_agg(item),'[]'::jsonb) into merged from jsonb_array_elements(records) item where item->>'branch'=actor.branch;
  if exists(select 1 from jsonb_array_elements(merged) item group by item->>'id' having count(*)>1) then raise exception 'Número de colaborador duplicado'; end if;
 end if;
 update public.app_state set value=merged,updated_by=auth.uid(),updated_at=now() where key='xoxo.collaborators';
end $$;

-- Proyección común: sin ventas, caja, salarios, evaluaciones ni evidencias.
create or replace function public.store_general_overview()
returns jsonb language sql stable security definer set search_path=public as $$
 with today as (select (now() at time zone 'America/Mexico_City')::date::text as day),
 stores as (select unnest(array['Matriz','Sucursal Centro']) as branch),
 people as (
 select p.employee_number,p.display_name,p.role,coalesce((select w->>'location' from public.app_state s cross join lateral jsonb_array_elements(s.value) w,today where s.key='xoxo.workLocations' and w->>'employeeId'=p.employee_number and w->>'date'=today.day limit 1),p.branch) as branch
 from public.profiles p where p.active and exists(select 1 from public.attendance_records a,today where a.payload->>'employeeId'=p.employee_number and a.payload->>'date'=today.day and coalesce(a.payload->>'in','')<>'' and coalesce(a.payload->>'out','')='' and (coalesce(a.payload->>'lunchOut','')='' or coalesce(a.payload->>'lunchIn','')<>''))
 )
 select coalesce(jsonb_agg(jsonb_build_object('branch',stores.branch,'status',coalesce((select case when coalesce(o->>'closedAt','')<>'' then 'Cerrada' when coalesce(o->>'openedAt','')<>'' then 'Operando' else 'Pendiente de apertura' end from public.app_state s cross join lateral jsonb_array_elements(s.value) o,today where s.key='xoxo.storeOpeningChecks' and o->>'branch'=stores.branch and o->>'date'=today.day limit 1),'Sin apertura registrada'),'people',(select coalesce(jsonb_agg(jsonb_build_object('name',p.display_name,'roleLabel',replace(p.role,'_',' '))),'[]'::jsonb) from people p where p.branch=stores.branch))),'[]'::jsonb) from stores where (public.current_profile()).active
$$;
revoke all on function public.store_collaborators(),public.save_store_collaborators(jsonb),public.store_general_overview(),public.guard_store_configuration() from public,anon;
grant execute on function public.store_collaborators(),public.save_store_collaborators(jsonb),public.store_general_overview() to authenticated;

create or replace function public.can_view_cleaning_board()
returns boolean language sql stable security definer set search_path=public as $$
 select public.can_manage_all() or (public.current_profile()).role in ('GERENTE_TIENDA','ADMIN_TIENDA') or (public.current_profile()).employee_number='009'
$$;
create or replace function public.can_grade_cleaning()
returns boolean language sql stable security definer set search_path=public as $$ select public.can_view_cleaning_board() $$;
-- El gerente administra los módulos completos de su tienda, preservando confidencialidad.
do $$ declare t text; begin
 foreach t in array array['daily_task_records','activity_run_records','process_instance_records','cleaning_evaluation_records'] loop
  execute format('drop policy if exists store_manager_access on public.%I',t);
  execute format('create policy store_manager_access on public.%I for all to authenticated using (public.can_manage_branch(branch)) with check (public.can_manage_branch(branch) and updated_by=auth.uid())',t);
 end loop;
end $$;

create or replace function public.centro_is_supervisor()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where user_id=auth.uid() and active and
    (role in ('APODERADA_LEGAL','DIRECTOR','GERENTE_GENERAL','ADMIN_GENERAL') or (branch='Sucursal Centro' and role in ('GERENTE_TIENDA','ADMIN_TIENDA'))))
$$;


create or replace function public.centro_assign_day(employee_id text, target_day date, target_location text, shift_start text, shift_end text)
returns void language plpgsql security definer set search_path=public as $$
declare actor text; entries jsonb;
begin
  if not public.centro_is_supervisor() then raise exception 'Solo dirección y 003 pueden asignar personal'; end if;
  select employee_number into actor from public.profiles where user_id=auth.uid() and active;
  if exists(select 1 from public.profiles where user_id=auth.uid() and active and role in ('GERENTE_TIENDA','ADMIN_TIENDA')) and (target_location<>'Sucursal Centro' or not exists(select 1 from public.profiles where employee_number=employee_id and active and branch='Sucursal Centro')) then raise exception 'Solo dirección puede trasladar personal entre tiendas'; end if;
  if target_day<(now() at time zone 'America/Mexico_City')::date then raise exception 'No se puede cambiar una asignación histórica'; end if;
  if target_location not in ('Matriz','Sucursal Centro') or shift_start!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or shift_end!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or shift_start>=shift_end then raise exception 'Sucursal u horario inválido'; end if;
  if not exists(select 1 from public.profiles where employee_number=employee_id and active) then raise exception 'Colaborador sin perfil activo'; end if;
  perform pg_advisory_xact_lock(hashtext('centro-assignments'));
  select value into entries from public.app_state where key='xoxo.workLocations' for update;
  select coalesce(jsonb_agg(value),'[]'::jsonb) into entries from jsonb_array_elements(coalesce(entries,'[]'::jsonb))
    where not (value->>'employeeId'=employee_id and value->>'date'=target_day::text);
  entries:=entries||jsonb_build_array(jsonb_build_object('id',target_day::text||'-'||employee_id,'employeeId',employee_id,'date',target_day::text,'location',target_location,'start',shift_start,'end',shift_end,'assignedById',actor));
  insert into public.app_state(key,value,updated_by) values('xoxo.workLocations',entries,auth.uid())
    on conflict(key) do update set value=excluded.value,updated_at=now(),updated_by=auth.uid();
end $$;


insert into public.centro_task_templates(task_id,definition) values ('apertura', '{"id":"apertura","title":"Apertura oficial","start":"08:45","end":"09:00","category":"Apertura","control":true,"instructions":"La apertura se confirma en el control existente: venta lista para cobrar, sesión Xoxo, checklist completo y puerta abierta. Ventana correcta: 8:45–9:00. Sin descuentos económicos automáticos.","fields":[{"key":"incidencias","label":"Incidencias de apertura","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('atencion', '{"id":"atencion","title":"Atención y resultados del día","start":"08:45","end":"18:00","category":"Atención","control":true,"instructions":"Consolidar los totales de sucursal sin duplicar visitantes. La atención tiene prioridad durante toda la jornada; registrar procedencia, contactos, cotizaciones y necesidades.","fields":[{"key":"visitantes","label":"Visitantes (meta 50)","type":"number"},{"key":"nuevos","label":"Nuevos","type":"number"},{"key":"recurrentes","label":"Recurrentes","type":"number"},{"key":"compradores","label":"Compradores","type":"number"},{"key":"ventas","label":"Ventas ($)","type":"number"},{"key":"tickets","label":"Tickets","type":"number"},{"key":"cotizaciones","label":"Cotizaciones ($)","type":"number"},{"key":"procedencia","label":"Procedencia, contactos y productos solicitados","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;

create or replace function public.store_opening_checks()
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(item),'[]'::jsonb) from public.app_state s cross join lateral jsonb_array_elements(s.value) item
 where s.key='xoxo.storeOpeningChecks' and (public.current_profile()).active and (public.can_manage_all() or item->>'branch'=(public.current_profile()).branch)
$$;
revoke all on function public.store_opening_checks() from public,anon;
grant execute on function public.store_opening_checks() to authenticated;


drop policy if exists store_request_manager on public.internal_request_records;
create policy store_request_manager on public.internal_request_records for select to authenticated using (public.can_manage_branch(branch) and coalesce(payload->>'confidentiality','Normal')<>'Confidencial');
drop policy if exists store_request_manager_update on public.internal_request_records;
create policy store_request_manager_update on public.internal_request_records for update to authenticated using (public.can_manage_branch(branch) and coalesce(payload->>'confidentiality','Normal')<>'Confidencial') with check (public.can_manage_branch(branch) and coalesce(payload->>'confidentiality','Normal')<>'Confidencial' and updated_by=auth.uid());

-- La comunicación dirigida puede cruzar sucursales; no abre otros registros.
drop policy if exists store_boundary on public.internal_request_records;
create policy store_boundary on public.internal_request_records as restrictive for all to authenticated
 using (public.can_manage_all() or branch=(public.current_profile()).branch or (public.current_profile()).employee_number in (payload->>'requestedById',payload->>'recipientId'))
 with check (public.can_manage_all() or branch=(public.current_profile()).branch or (public.current_profile()).employee_number in (payload->>'requestedById',payload->>'recipientId'));

create or replace function public.operational_record_branch(item jsonb)
returns text language sql stable security definer set search_path=public as $$
 select coalesce(nullif(item->>'branch',''),
 (select w->>'location' from public.app_state s cross join lateral jsonb_array_elements(s.value) w where s.key='xoxo.workLocations' and w->>'employeeId'=coalesce(item->>'employeeId',item->>'ownerId',item->>'cashierId',item->>'startedById',item->>'requestedById') and w->>'date'=item->>'date' limit 1),
 (select p.branch from public.profiles p where p.employee_number=coalesce(item->>'employeeId',item->>'ownerId',item->>'cashierId',item->>'startedById',item->>'requestedById') and p.active limit 1),
 (public.current_profile()).branch)
$$;

create or replace function public.sync_module_records(module_name text, records jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare
  table_name text; item jsonb; owner_number text; item_branch text; item_id text; item_date date;
begin
  table_name := case module_name
    when 'attendance' then 'attendance_records' when 'evaluations' then 'evaluation_records'
    when 'cash' then 'cash_incident_records' when 'cashSessions' then 'cash_session_records'
    when 'cashCuts' then 'cash_cut_records' when 'suppliers' then 'supplier_records'
    when 'payables' then 'payable_records' when 'bankAccounts' then 'bank_account_records'
    when 'bankTransactions' then 'bank_transaction_records' when 'monthlyBudgets' then 'monthly_budget_records'
    when 'kpiRecords' then 'kpi_records' when 'processAudits' then 'process_audit_records'
    when 'branchOpenings' then 'branch_opening_records' when 'warranties' then 'warranty_records'
    when 'dailyTasks' then 'daily_task_records' when 'processInstances' then 'process_instance_records'
    when 'internalRequests' then 'internal_request_records' when 'activityRuns' then 'activity_run_records'
    when 'cleaningEvaluations' then 'cleaning_evaluation_records'
    else null end;
  if table_name is null then raise exception 'Modulo no permitido'; end if;
  if table_name='cleaning_evaluation_records' and not public.can_grade_cleaning() then
    raise exception 'No tienes permiso para calificar el aseo de esta sucursal.';
  end if;

  for item in select value from jsonb_array_elements(coalesce(records,'[]'::jsonb)) loop
    owner_number := coalesce(item->>'employeeId',item->>'ownerId',item->>'cashierId',item->>'startedById',item->>'requestedById',(public.current_profile()).employee_number);
    item_branch := public.operational_record_branch(item);
    item_id := coalesce(item->>'id',concat_ws('-',owner_number,item->>'evaluatorId',item->>'date',item->>'periodStart',item->>'periodEnd'),gen_random_uuid()::text);
    item_date := nullif(item->>'date','')::date;
    execute format('insert into public.%I (record_id,employee_number,branch,record_date,payload,updated_by)
      values ($1,$2,$3,$4,$5,auth.uid()) on conflict (record_id) do update set
      employee_number=excluded.employee_number,branch=excluded.branch,record_date=excluded.record_date,
      payload=excluded.payload,updated_at=now(),updated_by=auth.uid()',table_name)
      using item_id,owner_number,item_branch,item_date,item;
  end loop;
end $$;


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
        using item->>'id', owner_number, public.operational_record_branch(item), nullif(item->>'date','')::date, item;
    end if;
  end loop;
end $$;
revoke all on function public.sync_assignment_records(text,jsonb) from public;


drop policy if exists app_state_dexter_003_only on public.app_state;
create policy app_state_dexter_003_only on public.app_state as restrictive for all to authenticated
 using (key<>'xoxo.dexterPilot' or public.can_manage_branch('Sucursal Centro'))
 with check (key<>'xoxo.dexterPilot' or public.can_manage_branch('Sucursal Centro'));
commit;
