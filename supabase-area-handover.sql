-- Entrega diaria de área: cinco minutos antes de la salida efectiva, con fotos obligatorias.
begin;
create table if not exists area_handover_policy(id boolean primary key default true check(id),activated_on date not null default (now() at time zone 'America/Mexico_City')::date);
insert into area_handover_policy(id) values(true) on conflict do nothing;
alter table area_handover_policy enable row level security;revoke all on area_handover_policy from public,anon,authenticated;
create or replace function area_handover_reconcile() returns void language plpgsql security definer set search_path=public as $$
declare day date:=(now() at time zone 'America/Mexico_City')::date;p profiles;finish text;start_at text;rid text;doc jsonb;location text;
begin
 if day<(select activated_on from area_handover_policy where id) then return;end if;
 perform pg_advisory_xact_lock(hashtext('area-handover-'||day::text));
 for p in select * from profiles where active and role='JEFE_AREA' loop
  if staff_is_rest(p.employee_number,day) and not exists(select 1 from attendance_records where employee_number=p.employee_number and record_date=day and coalesce(payload->>'in','')<>'') then continue;end if;
  finish:=cleaning_exit_time(p.employee_number,day);if finish is null or finish!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or finish<'00:05' then continue;end if;
  start_at:=to_char(finish::time-interval '5 minutes','HH24:MI');location:=work_branch(p.employee_number,day);if location not in('Matriz','Sucursal Centro') then continue;end if;
  rid:='area-handover-'||day||'-'||p.employee_number;
  doc:=jsonb_build_object('id',rid,'employeeId',p.employee_number,'assignedById','003','assignedAt',now(),'date',day,'branch',location,'title','Entregar mostradores limpios y zonas libres','start',start_at,'end',finish,'priority','Alta','slaMinutes',5,'status','Pendiente','systemKind','area-handover','requiresPhoto',true,'affectsEvaluation',true,'currentStep','Asignada','employeeComment','','supervisorComment','','response','','deliveryNote','','incidentNote','','paused',false,'approvalStatus','No requerida','notes','Entrega diaria del jefe de área, cinco minutos antes de su salida configurada. Limpiar y entregar los mostradores listos para recibir clientes; retirar mercancía y objetos ajenos, y dejar zonas de trabajo y pasillos libres, limpios y en orden. Tomar foto antes de iniciar y foto del resultado final, mostrando mostradores y zonas libres. Registrar resultado y pendientes para validación del superior. Primero recibir, atender o canalizar al cliente; después retomar la actividad.');
  insert into daily_task_records(record_id,employee_number,branch,record_date,payload,updated_by) values(rid,p.employee_number,location,day,doc,auth.uid()) on conflict(record_id) do update set branch=excluded.branch,payload=daily_task_records.payload||jsonb_build_object('start',start_at,'end',finish,'branch',location,'requiresPhoto',true,'systemKind','area-handover'),updated_at=now() where coalesce(daily_task_records.payload->>'startedAt','')='' and coalesce(daily_task_records.payload->>'completedAt','')='' and (daily_task_records.payload->>'start' is distinct from start_at or daily_task_records.payload->>'end' is distinct from finish or daily_task_records.branch is distinct from location or daily_task_records.payload->>'requiresPhoto' is distinct from 'true');
 end loop;
end $$;
revoke all on function area_handover_reconcile() from public,anon,authenticated;
create or replace function area_handover_write_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare clock timestamp:=now() at time zone 'America/Mexico_City';was_started boolean:=false;was_completed boolean:=false;image jsonb;
begin
 if tg_op='UPDATE' and old.record_id like 'area-handover-%' and (new.record_id<>old.record_id or new.employee_number<>old.employee_number or new.record_date<>old.record_date) then raise exception 'No se puede cambiar la identidad de la entrega diaria';end if;
 if new.record_id not like 'area-handover-%' and coalesce(new.payload->>'systemKind','')<>'area-handover' then return new;end if;
 if new.record_id<>'area-handover-'||new.record_date||'-'||new.employee_number then raise exception 'Identidad inválida de entrega de área';end if;
 if tg_op='UPDATE' then was_started:=coalesce(old.payload->>'startedAt','')<>'';was_completed:=coalesce(old.payload->>'completedAt','')<>'';end if;
 if was_started then new.payload:=new.payload||jsonb_build_object('start',old.payload->>'start','end',old.payload->>'end');else
  new.payload:=new.payload||jsonb_build_object('end',cleaning_exit_time(new.employee_number,new.record_date),'start',to_char(cleaning_exit_time(new.employee_number,new.record_date)::time-interval '5 minutes','HH24:MI'));
 end if;
 new.payload:=new.payload||jsonb_build_object('id',new.record_id,'date',new.record_date,'employeeId',new.employee_number,'requiresPhoto',true,'affectsEvaluation',true,'systemKind','area-handover');
 if not was_started and (coalesce(new.payload->>'startedAt','')<>'' or new.payload->>'status'='En proceso') then
  if new.record_date<>clock::date or to_char(clock,'HH24:MI')<new.payload->>'start' then raise exception 'La entrega de área inicia a las %, cinco minutos antes de tu salida',new.payload->>'start';end if;
  new.payload:=new.payload||jsonb_build_object('startedAt',now());
 end if;
 if coalesce(new.payload->>'completedAt','')<>'' or new.payload->>'status'='Completada' then
  foreach image in array array[new.payload->'beforeEvidenceCapture',new.payload->'afterEvidenceCapture'] loop
   if coalesce(image->>'dataUrl','')!~'^data:image/' then raise exception 'La entrega requiere fotos del antes y del resultado final';end if;
  end loop;
  if not was_completed then
   if new.record_date<>clock::date or coalesce(new.payload->>'startedAt','')='' then raise exception 'Inicia y entrega esta actividad en su jornada';end if;
   foreach image in array array[new.payload->'beforeEvidenceCapture',new.payload->'afterEvidenceCapture'] loop
    if coalesce(image->>'capturedAt','')='' or (image->>'capturedAt')::timestamptz at time zone 'America/Mexico_City' < new.record_date::timestamp or (image->>'capturedAt')::timestamptz at time zone 'America/Mexico_City' >= (new.record_date+1)::timestamp then raise exception 'Las fotos deben corresponder a la jornada de entrega';end if;
   end loop;
   new.payload:=new.payload||jsonb_build_object('completedAt',now(),'approvalStatus','Pendiente');
  end if;
 end if;return new;
end $$;
revoke all on function area_handover_write_guard() from public,anon,authenticated;
drop trigger if exists area_handover_evidence_guard on daily_task_records;create trigger area_handover_evidence_guard before insert or update on daily_task_records for each row execute function area_handover_write_guard();
create or replace function public.validate_assigned_task_schedule()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.payload->>'removedAt' is not null or new.payload->>'completedAt' is not null
    or new.payload->>'status'='Completada' then return new; end if;
  if tg_op='UPDATE' then
    if old.payload->>'completedAt' is null and old.payload->>'status' is distinct from 'Completada'
      and (old.payload->>'employeeId',old.payload->>'date',old.payload->>'start',old.payload->>'end')
        is not distinct from (new.payload->>'employeeId',new.payload->>'date',new.payload->>'start',new.payload->>'end')
    then return new; end if;
  end if;
  if coalesce(new.payload->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(new.payload->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or (new.payload->>'end') <= (new.payload->>'start') then
    raise exception 'Indica un horario válido: la hora final debe ser posterior a la inicial.';
  end if;
  if new.payload->>'systemKind'='area-handover' and new.record_id='area-handover-'||new.record_date||'-'||new.employee_number then return new;end if;
  perform pg_advisory_xact_lock(hashtextextended('xoxo.assigned-task-schedule',0));
  if exists (
    select 1 from public.daily_task_records other
    where other.record_id<>new.record_id
      and not (coalesce(other.payload->>'systemKind','')='area-handover' and other.record_id='area-handover-'||other.record_date||'-'||other.employee_number)
      and other.payload->>'employeeId'=new.payload->>'employeeId'
      and other.payload->>'date'=new.payload->>'date'
      and other.payload->>'removedAt' is null and other.payload->>'completedAt' is null
      and other.payload->>'status' is distinct from 'Completada'
      and new.payload->>'start' < other.payload->>'end'
      and new.payload->>'end' > other.payload->>'start'
  ) then
    raise exception 'El colaborador ya tiene una tarea asignada en ese horario. Solo se permite una tarea adicional; cambia el horario o retira la anterior.';
  end if;
  return new;
end $$;
-- Mantiene el capturador existente y agrega la obligación diaria a su reconciliación normal.
do $$begin if to_regprocedure('area_handover_base_capture()') is null then alter function staff_capture_today_plans() rename to area_handover_base_capture;end if;end $$;
revoke all on function area_handover_base_capture() from public,anon,authenticated;
create or replace function staff_capture_today_plans() returns void language plpgsql security definer set search_path=public as $$begin perform area_handover_base_capture();perform area_handover_reconcile();end $$;
revoke all on function staff_capture_today_plans() from public,anon,authenticated;
create or replace function area_handover_context() returns jsonb language plpgsql security definer set search_path=public as $$
declare actor profiles:=current_profile();day date:=(now() at time zone 'America/Mexico_City')::date;result jsonb;
begin
 if actor.employee_number is null then raise exception 'Sesión requerida';end if;
 perform area_handover_reconcile();
 select coalesce(jsonb_agg(payload order by employee_number),'[]') into result from daily_task_records where record_date=day and record_id like 'area-handover-%' and (employee_number=actor.employee_number or actor.employee_number in('001','002','003'));
 return jsonb_build_object('day',day,'clock',to_char(now() at time zone 'America/Mexico_City','HH24:MI'),'tasks',result);
end $$;
revoke all on function area_handover_context() from public,anon;grant execute on function area_handover_context() to authenticated;
select area_handover_reconcile();
notify pgrst,'reload schema';commit;
