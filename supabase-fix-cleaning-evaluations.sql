-- Marcador de aseo: tabla y permisos para la calificacion de calidad por periodo.
-- Acceso exclusivo a 001, 002, 003 y Julio (009): los 4 ven y los 4 pueden calificar.
-- No reutiliza can_manage_all() porque ese helper también incluye a 005 (Daniel), que no
-- debe tener acceso a este modulo.
begin;

create or replace function public.can_view_cleaning_board()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((public.current_profile()).employee_number in ('001','002','003','009'), false)
$$;

create or replace function public.can_grade_cleaning()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((public.current_profile()).employee_number in ('001','002','003','009'), false)
$$;

create table if not exists public.cleaning_evaluation_records (
  record_id text primary key,
  employee_number text not null,
  branch text not null,
  record_date date,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id)
);
alter table public.cleaning_evaluation_records enable row level security;

drop policy if exists module_select on public.cleaning_evaluation_records;
drop policy if exists module_insert on public.cleaning_evaluation_records;
drop policy if exists module_update on public.cleaning_evaluation_records;
drop policy if exists module_delete on public.cleaning_evaluation_records;

create policy module_select on public.cleaning_evaluation_records for select to authenticated
  using (public.can_view_cleaning_board());
create policy module_insert on public.cleaning_evaluation_records for insert to authenticated
  with check (updated_by=auth.uid() and public.can_grade_cleaning());
create policy module_update on public.cleaning_evaluation_records for update to authenticated
  using (public.can_grade_cleaning())
  with check (updated_by=auth.uid() and public.can_grade_cleaning());
create policy module_delete on public.cleaning_evaluation_records for delete to authenticated
  using (public.can_grade_cleaning());

grant select,insert,update,delete on public.cleaning_evaluation_records to authenticated;

-- Redefine sync_module_records (usada por el guardado normal) y replace_module_records
-- (compatibilidad antigua) para reconocer el nuevo modulo 'cleaningEvaluations'. Tambien
-- se agrega periodStart/periodEnd a la derivacion de record_id: la calificacion de aseo no
-- trae 'id' ni 'date' propios (usa un periodo), y sin esto cada periodo de un mismo
-- colaborador/evaluador se sobreescribiria entre si.
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
    raise exception 'Solo 001, 002, 003 y 009 pueden capturar la calificacion de calidad de aseo.';
  end if;

  for item in select value from jsonb_array_elements(coalesce(records,'[]'::jsonb)) loop
    owner_number := coalesce(item->>'employeeId',item->>'ownerId',item->>'cashierId',item->>'startedById',item->>'requestedById',(public.current_profile()).employee_number);
    item_branch := coalesce(item->>'branch',(public.current_profile()).branch);
    item_id := coalesce(item->>'id',concat_ws('-',owner_number,item->>'evaluatorId',item->>'date',item->>'periodStart',item->>'periodEnd'),gen_random_uuid()::text);
    item_date := nullif(item->>'date','')::date;
    execute format('insert into public.%I (record_id,employee_number,branch,record_date,payload,updated_by)
      values ($1,$2,$3,$4,$5,auth.uid()) on conflict (record_id) do update set
      employee_number=excluded.employee_number,branch=excluded.branch,record_date=excluded.record_date,
      payload=excluded.payload,updated_at=now(),updated_by=auth.uid()',table_name)
      using item_id,owner_number,item_branch,item_date,item;
  end loop;
end $$;

grant execute on function public.sync_module_records(text,jsonb) to authenticated;

create or replace function public.replace_module_records(module_name text, records jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare
  table_name text;
  item jsonb;
  owner_number text;
  item_branch text;
  item_id text;
  item_date date;
begin
  table_name := case module_name
    when 'attendance' then 'attendance_records'
    when 'evaluations' then 'evaluation_records'
    when 'cash' then 'cash_incident_records'
    when 'cashSessions' then 'cash_session_records'
    when 'cashCuts' then 'cash_cut_records'
    when 'suppliers' then 'supplier_records'
    when 'payables' then 'payable_records'
    when 'bankAccounts' then 'bank_account_records'
    when 'bankTransactions' then 'bank_transaction_records'
    when 'monthlyBudgets' then 'monthly_budget_records'
    when 'kpiRecords' then 'kpi_records'
    when 'processAudits' then 'process_audit_records'
    when 'branchOpenings' then 'branch_opening_records'
    when 'warranties' then 'warranty_records'
    when 'dailyTasks' then 'daily_task_records'
    when 'processInstances' then 'process_instance_records'
    when 'internalRequests' then 'internal_request_records'
    when 'activityRuns' then 'activity_run_records'
    when 'cleaningEvaluations' then 'cleaning_evaluation_records'
    else null end;
  if table_name is null then raise exception 'Modulo no permitido'; end if;
  if table_name='cleaning_evaluation_records' and not public.can_grade_cleaning() then
    raise exception 'Solo 001, 002, 003 y 009 pueden capturar la calificacion de calidad de aseo.';
  end if;

  if table_name='cleaning_evaluation_records' then
    delete from public.cleaning_evaluation_records;
  elsif public.can_manage_all() then
    execute format('delete from public.%I', table_name);
  elsif (public.current_profile()).role in ('GERENTE_TIENDA','ADMIN_TIENDA') then
    execute format('delete from public.%I where branch=$1', table_name)
      using (public.current_profile()).branch;
  else
    execute format('delete from public.%I where employee_number=$1', table_name)
      using (public.current_profile()).employee_number;
  end if;

  for item in select value from jsonb_array_elements(coalesce(records,'[]'::jsonb)) loop
    owner_number := coalesce(item->>'employeeId',item->>'ownerId',item->>'cashierId',
      item->>'startedById',item->>'requestedById',(public.current_profile()).employee_number);
    item_branch := coalesce(item->>'branch',(public.current_profile()).branch);
    item_id := coalesce(item->>'id', concat_ws('-',owner_number,item->>'evaluatorId',item->>'date',item->>'periodStart',item->>'periodEnd'), gen_random_uuid()::text);
    item_date := nullif(item->>'date','')::date;
    execute format('insert into public.%I
      (record_id,employee_number,branch,record_date,payload,updated_by)
      values ($1,$2,$3,$4,$5,auth.uid())', table_name)
      using item_id,owner_number,item_branch,item_date,item;
  end loop;
end $$;

grant execute on function public.replace_module_records(text,jsonb) to authenticated;

commit;
