-- Corrige sincronización compartida sin borrar información existente.
create or replace function public.can_manage_all()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    (public.current_profile()).role in ('APODERADA_LEGAL','DIRECTOR','GERENTE_GENERAL','ADMIN_GENERAL')
    or (public.current_profile()).employee_number in ('001','002','003','005'), false)
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
    else null end;
  if table_name is null then raise exception 'Modulo no permitido'; end if;

  for item in select value from jsonb_array_elements(coalesce(records,'[]'::jsonb)) loop
    owner_number := coalesce(item->>'employeeId',item->>'ownerId',item->>'cashierId',item->>'startedById',item->>'requestedById',(public.current_profile()).employee_number);
    item_branch := coalesce(item->>'branch',(public.current_profile()).branch);
    item_id := coalesce(item->>'id',concat_ws('-',owner_number,item->>'evaluatorId',item->>'date'),gen_random_uuid()::text);
    item_date := nullif(item->>'date','')::date;
    execute format('insert into public.%I (record_id,employee_number,branch,record_date,payload,updated_by)
      values ($1,$2,$3,$4,$5,auth.uid()) on conflict (record_id) do update set
      employee_number=excluded.employee_number,branch=excluded.branch,record_date=excluded.record_date,
      payload=excluded.payload,updated_at=now(),updated_by=auth.uid()',table_name)
      using item_id,owner_number,item_branch,item_date,item;
  end loop;
end $$;

grant execute on function public.sync_module_records(text,jsonb) to authenticated;

drop policy if exists "app_state_read_authenticated" on public.app_state;
create policy "app_state_read_authenticated" on public.app_state for select to authenticated using (true);
drop policy if exists "app_state_write_authenticated" on public.app_state;
create policy "app_state_write_authenticated" on public.app_state for all to authenticated
using (updated_by=auth.uid() or public.can_manage_all())
with check (updated_by=auth.uid());
