-- Flujo de trabajo Lummi: estados de equipo visibles sólo para el titular y Dirección.
begin;
create table if not exists assigned_task_dependencies(task_id text not null,prerequisite_id text not null,notice text not null,primary key(task_id,prerequisite_id));
alter table assigned_task_dependencies enable row level security;revoke all on assigned_task_dependencies from public,anon,authenticated;
create or replace function assigned_task_dependency_context() returns jsonb language plpgsql security definer set search_path=public as $$
declare actor text:=(current_profile()).employee_number;result jsonb;today date:=(now() at time zone 'America/Mexico_City')::date;
begin
 if actor is null then raise exception 'Sesión requerida';end if;
 select coalesce(jsonb_agg(jsonb_build_object('taskId',t.record_id,'title',t.payload->>'title','day',t.record_date,'ready',not exists(select 1 from assigned_task_dependencies d left join daily_task_records p on p.record_id=d.prerequisite_id where d.task_id=t.record_id and (p.record_id is null or coalesce(p.payload->>'completedAt','')='' or p.payload->>'status'<>'Completada')),'notice',(select string_agg(d.notice,' ') from assigned_task_dependencies d where d.task_id=t.record_id)) order by t.record_date,t.payload->>'start'),'[]') into result from daily_task_records t where exists(select 1 from assigned_task_dependencies d where d.task_id=t.record_id) and t.record_date between today and today+1 and (t.employee_number=actor or actor in('001','002','003'));
 return result;
end $$;
revoke all on function assigned_task_dependency_context() from public,anon;grant execute on function assigned_task_dependency_context() to authenticated;
create or replace function assigned_task_workflow_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare progressing boolean;kind text:=coalesce(new.payload->>'workflowKind','');exhibited numeric;stored numeric;
begin
 progressing:=(coalesce(new.payload->>'startedAt','')<>'' and (tg_op='INSERT' or coalesce(old.payload->>'startedAt','')='')) or (new.payload->>'status'='Completada' and (tg_op='INSERT' or old.payload->>'status' is distinct from 'Completada'));
 if progressing and exists(select 1 from assigned_task_dependencies d left join daily_task_records p on p.record_id=d.prerequisite_id where d.task_id=new.record_id and (p.record_id is null or coalesce(p.payload->>'completedAt','')='' or p.payload->>'status'<>'Completada')) then raise exception 'Espera la notificación: la etapa anterior del equipo aún no está terminada';end if;
 -- El tipo se conserva desde la asignación original, aunque una sesión vieja omita el campo.
 if tg_op='UPDATE' and coalesce(old.payload->>'workflowKind','')<>'' then kind:=old.payload->>'workflowKind';new.payload:=new.payload||jsonb_build_object('workflowKind',kind,'dependsOnTaskIds',old.payload->'dependsOnTaskIds');end if;
 if kind<>'' and (new.payload->>'status'='Completada' or coalesce(new.payload->>'completedAt','')<>'') then
  if length(trim(coalesce(new.payload->>'deliveryNote','')))<10 then raise exception 'Registra el resultado y las incidencias de esta etapa';end if;
  if kind='lummi-review' and coalesce(new.payload->>'reviewConfirmed','false')<>'true' then raise exception 'Confirma la revisión física y registra si hubo faltantes o incidencias';end if;
  if kind='lummi-entry' and (length(trim(coalesce(new.payload->>'invoiceReference','')))<3 or coalesce(new.payload->>'pricesConfirmed','false')<>'true') then raise exception 'Registra el folio de factura y confirma ingreso y precios en Invewin';end if;
  if kind='lummi-display' then
   if coalesce(new.payload->>'exhibitedQuantity','')!~'^[0-9]+$' or coalesce(new.payload->>'storedQuantity','')!~'^[0-9]+$' then raise exception 'Registra cantidades enteras de unidades exhibidas y almacenadas';end if;
   exhibited:=(new.payload->>'exhibitedQuantity')::numeric;stored:=(new.payload->>'storedQuantity')::numeric;
   if exhibited+stored<=0 or exhibited<0.8*(exhibited+stored) then raise exception 'Regla obligatoria: mínimo 80%% en exhibición y máximo 20%% almacenado';end if;
  end if;
  if kind='lummi-demo' and (length(trim(coalesce(new.payload->>'demoProduct1','')))<3 or length(trim(coalesce(new.payload->>'demoProduct2','')))<3 or lower(trim(new.payload->>'demoProduct1'))=lower(trim(new.payload->>'demoProduct2'))) then raise exception 'Registra al menos dos productos distintos y la solución que puede demostrarse';end if;
 end if;return new;
end $$;
revoke all on function assigned_task_workflow_guard() from public,anon,authenticated;
drop trigger if exists assigned_task_workflow on daily_task_records;create trigger assigned_task_workflow before insert or update on daily_task_records for each row execute function assigned_task_workflow_guard();
notify pgrst,'reload schema';commit;
