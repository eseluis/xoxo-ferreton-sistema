-- Etapa 2: almacenamiento modular y permisos por puesto/sucursal.
-- Conserva app_state para colaboradores y configuracion durante la transicion.

create or replace function public.current_profile()
returns public.profiles language sql stable security definer set search_path=public as $$
  select p from public.profiles p where p.user_id=auth.uid() and p.active limit 1
$$;

create or replace function public.can_manage_all()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((public.current_profile()).role in
    ('APODERADA_LEGAL','DIRECTOR','GERENTE_GENERAL','ADMIN_GENERAL'), false)
$$;

create or replace function public.can_manage_branch(target_branch text)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    public.can_manage_all() or (
      (public.current_profile()).role in ('GERENTE_TIENDA','ADMIN_TIENDA')
      and (public.current_profile()).branch=target_branch
    ), false)
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'attendance_records','evaluation_records','cash_incident_records','cash_session_records','cash_cut_records','supplier_records','payable_records','bank_account_records','bank_transaction_records','monthly_budget_records',
    'warranty_records','daily_task_records','process_instance_records',
    'internal_request_records','activity_run_records'
  ] loop
    execute format('create table if not exists public.%I (
      record_id text primary key,
      employee_number text not null,
      branch text not null,
      record_date date,
      payload jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      updated_by uuid not null references auth.users(id)
    )', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists module_select on public.%I', table_name);
    execute format('drop policy if exists module_insert on public.%I', table_name);
    execute format('drop policy if exists module_update on public.%I', table_name);
    execute format('drop policy if exists module_delete on public.%I', table_name);
    execute format('create policy module_select on public.%I for select to authenticated
      using (public.can_manage_branch(branch) or employee_number=(public.current_profile()).employee_number)', table_name);
    execute format('create policy module_insert on public.%I for insert to authenticated
      with check (updated_by=auth.uid() and
        (public.can_manage_branch(branch) or employee_number=(public.current_profile()).employee_number))', table_name);
    execute format('create policy module_update on public.%I for update to authenticated
      using (public.can_manage_branch(branch) or employee_number=(public.current_profile()).employee_number)
      with check (updated_by=auth.uid() and
        (public.can_manage_branch(branch) or employee_number=(public.current_profile()).employee_number))', table_name);
    execute format('create policy module_delete on public.%I for delete to authenticated
      using (public.can_manage_branch(branch) or employee_number=(public.current_profile()).employee_number)', table_name);
    execute format('grant select,insert,update,delete on public.%I to authenticated', table_name);
  end loop;
end $$;

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
    when 'warranties' then 'warranty_records'
    when 'dailyTasks' then 'daily_task_records'
    when 'processInstances' then 'process_instance_records'
    when 'internalRequests' then 'internal_request_records'
    when 'activityRuns' then 'activity_run_records'
    else null end;
  if table_name is null then raise exception 'Modulo no permitido'; end if;

  if public.can_manage_all() then
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
    item_id := coalesce(item->>'id', concat_ws('-',owner_number,item->>'evaluatorId',item->>'date'), gen_random_uuid()::text);
    item_date := nullif(item->>'date','')::date;
    execute format('insert into public.%I
      (record_id,employee_number,branch,record_date,payload,updated_by)
      values ($1,$2,$3,$4,$5,auth.uid())', table_name)
      using item_id,owner_number,item_branch,item_date,item;
  end loop;
end $$;

grant execute on function public.replace_module_records(text,jsonb) to authenticated;
