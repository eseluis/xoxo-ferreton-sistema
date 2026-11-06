-- Aseo vencido: bloqueo hasta la salida programada; recuperación explícita con hora del servidor.
begin;
create table if not exists cleaning_deadline_policy(id boolean primary key default true check(id),activated_on date not null default (now() at time zone 'America/Mexico_City')::date);
insert into cleaning_deadline_policy(id) values(true) on conflict do nothing;
alter table cleaning_deadline_policy enable row level security;revoke all on cleaning_deadline_policy from public,anon,authenticated;
create or replace function cleaning_exit_time(person text,day date)
returns text language sql stable security definer set search_path=public as $$
 select coalesce((select w->>'end' from app_state st cross join lateral jsonb_array_elements(st.value)w where st.key='xoxo.workLocations' and w->>'employeeId'=person and w->>'date'=day::text limit 1),
 (select sh->>'end' from app_state st cross join lateral jsonb_array_elements(st.value)sh where st.key='xoxo.shiftConfigs' and sh->>'key'=(select c->>'shift' from app_state cs cross join lateral jsonb_array_elements(cs.value)c where cs.key='xoxo.collaborators' and c->>'id'=person limit 1) limit 1))
$$;
create or replace function cleaning_run_spec(person text,day date,item_type text,item_id text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare s jsonb;cfg jsonb;
begin
 select a into s from operation_day_plans d cross join lateral jsonb_array_elements(d.slots)a where employee_number=person and d.day=cleaning_run_spec.day and (a->>'key'=item_type||'-'||item_id or coalesce(a->'aliases','[]') ? (item_type||'-'||item_id)) limit 1;
 select a into cfg from app_state st cross join lateral jsonb_array_elements(st.value)a where st.key='xoxo.activitySchedules' and a->>'id'=item_id and lower(a->>'area') like '%aseo%' limit 1;
 if item_type='Aseo' or s->>'kind'='Aseo' then
  -- Las horas editadas en configuración prevalecen para la jornada actual.
  if day=(now() at time zone 'America/Mexico_City')::date then select a into cfg from app_state st cross join lateral jsonb_array_elements(st.value)a where st.key='xoxo.cleaningRole' and a->>'activity'=coalesce(s->>'itemId',item_id) and a->>'branch'=work_branch(person,day) limit 1;end if;
  if s is null and cfg is not null then s:=jsonb_build_object('key','Aseo-'||item_id,'itemId',item_id,'kind','Aseo','title',cfg->>'activity','evidence','photo','slaMinutes',greatest(1,extract(epoch from ((cfg->>'end')::time-(cfg->>'start')::time))/60));end if;
 elsif cfg is null then return null;
 end if;
 if s is null then return null;end if;
 if cfg is not null then s:=s||jsonb_build_object('start',cfg->>'start','end',cfg->>'end','slaMinutes',greatest(1,extract(epoch from ((cfg->>'end')::time-(cfg->>'start')::time))/60));end if;
 return s||jsonb_build_object('cleaning',true);
end $$;
create or replace function cleaning_gate(person text,day date,starts text,ends text,done boolean)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare clock timestamp:=now() at time zone 'America/Mexico_City';exit_time text;finish timestamp;release timestamp;attendance jsonb;reason text:='';expired boolean;recovery boolean;
begin
 exit_time:=cleaning_exit_time(person,day);finish:=day+ends::time;release:=greatest(finish,day+exit_time::time);expired:=clock>=finish and not done;recovery:=expired and clock>=release;
 select payload into attendance from attendance_records where employee_number=person and record_date=day limit 1;
 if done then reason:='';
 elsif day<>clock::date then reason:='Aseo de una fecha anterior: conserva el incumplimiento y solicita una nueva asignación para regularizarlo.';
 elsif starts is null or ends is null or exit_time is null then reason:='Falta un horario de aseo o salida válido en Configuración.';
 elsif clock<day+starts::time then reason:='El aseo se habilita a las '||starts||'.';
 elsif expired and not recovery then reason:='Aseo detenido por horario vencido. Se habilita automáticamente a las '||exit_time||', hora de salida programada.';
 elsif coalesce(attendance->>'in','')='' then reason:='Registra tu entrada antes de iniciar el aseo.';
 elsif coalesce(attendance->>'out','')<>'' then reason:='La salida real ya está registrada. El aseo no puede realizarse fuera del registro de jornada.';
 elsif coalesce(attendance->>'lunchOut','')<>'' and coalesce(attendance->>'lunchIn','')<coalesce(attendance->>'lunchOut','') then reason:='Registra tu regreso de comida antes de retomar el aseo.';end if;
 return jsonb_build_object('blocked',reason<>'','reason',reason,'expired',expired,'recovery',recovery,'exitTime',exit_time,'deadlineAt',finish at time zone 'America/Mexico_City','releaseAt',release at time zone 'America/Mexico_City','clock',clock at time zone 'America/Mexico_City');
end $$;
-- Sólo RPCs de aseo escriben su ejecución; clientes antiguos no pueden eludir la regla.
create or replace function cleaning_run_write_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare spec jsonb;allowed jsonb;pause_reason text;
begin
 if TG_OP='DELETE' then
  if old.record_date>=(select activated_on from cleaning_deadline_policy where id) and (old.payload->>'cleaningControlled'='true' or cleaning_run_spec(old.employee_number,old.record_date,old.payload->>'itemType',old.payload->>'itemId') is not null) then raise exception 'El historial del aseo no puede eliminarse';end if;return old;
 end if;
 if TG_OP='UPDATE' and new.payload=old.payload then return new;end if;
 if current_setting('xoxo.cleaning_write',true)='server' then return new;end if;
 if new.record_date<(select activated_on from cleaning_deadline_policy where id) then return new;end if;
 spec:=cleaning_run_spec(new.employee_number,new.record_date,new.payload->>'itemType',new.payload->>'itemId');
 if spec is null and TG_OP='UPDATE' then spec:=cleaning_run_spec(old.employee_number,old.record_date,old.payload->>'itemType',old.payload->>'itemId');end if;
 if spec is null and (TG_OP<>'UPDATE' or coalesce(old.payload->>'cleaningControlled','false')<>'true') then return new;end if;
 if TG_OP='UPDATE' then
  -- Las prioridades pueden detener trabajo, nunca reactivarlo ni alterar evidencia.
  allowed:=array_to_json(array['pausedAt','pauseReason','status','escalated','employeeComment'])::jsonb;
  if (new.payload-array['pausedAt','pauseReason','status','escalated','employeeComment'])=(old.payload-array['pausedAt','pauseReason','status','escalated','employeeComment']) and (new.payload->>'escalated'='true' or new.payload->>'pauseReason' in('Cliente','Seguridad') and coalesce(new.payload->>'pausedAt','')<>'') then
   pause_reason:=new.payload->>'pauseReason';new.payload:=old.payload||jsonb_build_object('escalated',coalesce(new.payload->'escalated',old.payload->'escalated'));
   if coalesce(old.payload->>'completedAt','')='' and coalesce(old.payload->>'pausedAt','')='' then new.payload:=new.payload||jsonb_build_object('pausedAt',now(),'pauseReason',coalesce(pause_reason,'Cliente'),'status','Pausada');end if;return new;
  end if;
 end if;
 raise exception 'El aseo usa control de horario del servidor. Actualiza el sistema y utiliza Iniciar/Retomar aseo; si venció, sólo se habilita a tu hora de salida programada';
end $$;
drop trigger if exists cleaning_run_control on activity_run_records;create trigger cleaning_run_control before insert or update or delete on activity_run_records for each row execute function cleaning_run_write_guard();
create or replace function cleaning_reconcile(day date)
returns void language plpgsql security definer set search_path=public as $$
declare r record;spec jsonb;gate jsonb;deadline timestamptz;
begin
 if day<>(now() at time zone 'America/Mexico_City')::date or day<(select activated_on from cleaning_deadline_policy where id) then return;end if;
 perform set_config('xoxo.cleaning_write','server',true);
 for r in select * from activity_run_records where record_date=day and coalesce(payload->>'completedAt','')='' and coalesce(payload->>'cleaningDeadlineMissed','false')<>'true' for update loop
  spec:=cleaning_run_spec(r.employee_number,day,r.payload->>'itemType',r.payload->>'itemId');if spec is null then continue;end if;
  gate:=cleaning_gate(r.employee_number,day,spec->>'start',spec->>'end',false);if not coalesce((gate->>'expired')::boolean,false) then continue;end if;
  deadline:=(gate->>'deadlineAt')::timestamptz;
  update activity_run_records set payload=payload||jsonb_build_object('status','Pausada','pausedAt',coalesce(nullif(payload->>'pausedAt','')::timestamptz,deadline),'pauseReason','Horario de aseo vencido','cleaningDeadlineMissed',true,'cleaningControlled',true,'cleaningWindowEnd',spec->>'end','cleaningStoppedAt',deadline,'cleaningRecoveryAvailableAt',gate->'releaseAt'),updated_at=now() where record_id=r.record_id;
 end loop;
 for r in select c.*,t.definition from centro_operation_records c join centro_task_templates t using(task_id) where c.day=cleaning_reconcile.day and t.definition->>'category'='Aseo' and c.status not in('Por validar','Validada') and coalesce(c.data->>'cleaningDeadlineMissed','false')<>'true' for update of c loop
  gate:=cleaning_gate(r.owner_id,day,r.definition->>'start',r.definition->>'end',false);if not coalesce((gate->>'expired')::boolean,false) then continue;end if;
  update centro_operation_records set status=case when status='En curso' then 'Pausada' else status end,version=version+1,updated_at=now(),data=data||jsonb_build_object('cleaningDeadlineMissed',true,'cleaningStoppedAt',gate->'deadlineAt','cleaningRecoveryAvailableAt',gate->'releaseAt'),history=history||jsonb_build_array(jsonb_build_object('at',gate->'deadlineAt','actor','sistema','action','pause','note','Horario de aseo vencido; recuperación desde la salida programada')) where centro_operation_records.day=r.day and task_id=r.task_id;
 end loop;
 perform set_config('xoxo.cleaning_write','',true);
end $$;
create or replace function cleaning_run_action(slot_key text,run_action text,photo_phase text default null,evidence jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
<<cleaning_run_action>>
declare actor text:=(current_profile()).employee_number;day date:=(now() at time zone 'America/Mexico_City')::date;s jsonb;r activity_run_records;p jsonb;gate jsonb;stamp timestamptz:=now();rid text;done boolean;
begin
 if actor is null then raise exception 'Sesión requerida';end if;
 if run_action not in('start','complete','photo','evidence') then raise exception 'Acción de aseo inválida';end if;
 perform pg_advisory_xact_lock(hashtext('cleaning-'||actor||day::text));perform staff_capture_today_plans();perform cleaning_reconcile(day);
 select a into s from operation_day_plans d cross join lateral jsonb_array_elements(d.slots)a where employee_number=actor and d.day=cleaning_run_action.day and a->>'key'=slot_key limit 1;
 if s is null then raise exception 'Aseo no asignado en tu plan de hoy';end if;
 s:=cleaning_run_spec(actor,day,s->>'kind',s->>'itemId');if s is null then raise exception 'La actividad no es un aseo';end if;
 select * into r from activity_run_records where employee_number=actor and record_date=day and ((payload->>'itemType')||'-'||(payload->>'itemId')=s->>'key' or coalesce(s->'aliases','[]') ? ((payload->>'itemType')||'-'||(payload->>'itemId'))) order by coalesce(payload->>'completedAt','') desc limit 1 for update;
 p:=coalesce(r.payload,'{}');done:=coalesce(p->>'completedAt','')<>'' and coalesce(p#>>'{beforeEvidenceCapture,dataUrl}','')<>'' and coalesce(p#>>'{afterEvidenceCapture,dataUrl}','')<>'';
 if done then return p;end if;
 gate:=cleaning_gate(actor,day,s->>'start',s->>'end',false);if gate->>'blocked'='true' then raise exception '%',gate->>'reason';end if;
 rid:=coalesce(r.record_id,actor||'-'||day||'-'||(s->>'kind')||'-'||(s->>'itemId'));
 p:=p||jsonb_build_object('id',rid,'employeeId',actor,'date',day,'branch',work_branch(actor,day),'itemType',s->>'kind','itemId',s->>'itemId','title',s->>'title','scheduledStart',s->>'start','scheduledEnd',s->>'end','slaMinutes',s->'slaMinutes','evidence','photo','cleaningControlled',true);
 if gate->>'expired'='true' then p:=p||jsonb_build_object('cleaningDeadlineMissed',true,'cleaningStoppedAt',gate->'deadlineAt','cleaningRecoveryAvailableAt',gate->'releaseAt');end if;
 if run_action='start' then
  if coalesce(p->>'startedAt','')<>'' and coalesce(p->>'pausedAt','')='' and (gate->>'expired'<>'true' or coalesce(p->>'cleaningRecoveryStartedAt','')<>'') then return p;end if;
  if coalesce(p->>'pausedAt','')<>'' then p:=p||jsonb_build_object('pausedMinutes',coalesce((p->>'pausedMinutes')::numeric,0)+greatest(0,extract(epoch from (stamp-(p->>'pausedAt')::timestamptz))/60));end if;
  if coalesce(p->>'completedAt','')<>'' then p:=p||jsonb_build_object('cleaningPriorCompletionAt',p->'completedAt');end if;
  p:=(p-array['pausedAt','pauseReason','completedAt'])||jsonb_build_object('startedAt',coalesce(nullif(p->>'startedAt','')::timestamptz,stamp),'status','En curso');
  if gate->>'expired'='true' then p:=p||jsonb_build_object('cleaningRecoveryStartedAt',stamp);end if;
 else
  if coalesce(p->>'startedAt','')='' or coalesce(p->>'pausedAt','')<>'' or gate->>'expired'='true' and coalesce(p->>'cleaningRecoveryStartedAt','')='' then raise exception 'Primero inicia o retoma el aseo habilitado';end if;
  if run_action='photo' then
   if photo_phase not in('before','after') then raise exception 'Fase de fotografía inválida';end if;
   if evidence is not null and (coalesce(evidence->>'dataUrl','')!~'^data:image/(jpeg|png|webp);base64,' or octet_length(evidence::text)>250000) then raise exception 'Fotografía inválida o demasiado grande';end if;
   p:=p||jsonb_build_object(case photo_phase when 'before' then 'beforeEvidenceCapture' else 'afterEvidenceCapture' end,case when evidence is null then null else evidence||jsonb_build_object('capturedAt',stamp) end);
  elsif run_action='complete' then
   if coalesce(p#>>'{beforeEvidenceCapture,dataUrl}','')='' or coalesce(p#>>'{afterEvidenceCapture,dataUrl}','')='' then raise exception 'Faltan las fotos antes y después del aseo';end if;
   p:=p||jsonb_build_object('completedAt',stamp,'status',case when p->>'cleaningDeadlineMissed'='true' then 'Completada con retraso' else 'Completada' end,'onTime',p->>'cleaningDeadlineMissed' is distinct from 'true');
  else raise exception 'El aseo requiere fotos antes y después';end if;
 end if;
 p:=p||jsonb_build_object('cleaningAudit',coalesce(p->'cleaningAudit','[]')||jsonb_build_array(jsonb_build_object('at',stamp,'action',run_action,'actor',actor)));
 perform set_config('xoxo.cleaning_write','server',true);
 insert into activity_run_records(record_id,employee_number,branch,record_date,payload,updated_by) values(rid,actor,work_branch(actor,day),day,p,auth.uid()) on conflict(record_id) do update set payload=excluded.payload,updated_at=now(),updated_by=auth.uid();
 perform set_config('xoxo.cleaning_write','',true);return p;
end $$;
create or replace function cleaning_deadline_context(day date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor text:=(current_profile()).employee_number;gates jsonb:='[]';s jsonb;r jsonb;spec jsonb;done boolean;
begin
 if actor is null or day<>(now() at time zone 'America/Mexico_City')::date then raise exception 'Consulta la jornada actual con sesión activa';end if;
 perform staff_capture_today_plans();perform cleaning_reconcile(day);
 for s in select a from operation_day_plans d cross join lateral jsonb_array_elements(d.slots)a where employee_number=actor and d.day=cleaning_deadline_context.day and a->>'kind'<>'Centro' loop
  spec:=cleaning_run_spec(actor,day,s->>'kind',s->>'itemId');if spec is null then continue;end if;
  select payload into r from activity_run_records where employee_number=actor and record_date=day and ((payload->>'itemType')||'-'||(payload->>'itemId')=spec->>'key' or coalesce(spec->'aliases','[]') ? ((payload->>'itemType')||'-'||(payload->>'itemId'))) order by coalesce(payload->>'completedAt','') desc limit 1;
  done:=coalesce(r->>'completedAt','')<>'' and coalesce(r#>>'{beforeEvidenceCapture,dataUrl}','')<>'' and coalesce(r#>>'{afterEvidenceCapture,dataUrl}','')<>'';
  gates:=gates||jsonb_build_array(cleaning_gate(actor,day,spec->>'start',spec->>'end',done)||jsonb_build_object('key',spec->>'key','title',spec->>'title','start',spec->>'start','end',spec->>'end','run',r));
 end loop;
 return jsonb_build_object('gates',gates,'clock',now());
end $$;

-- Conserva los RPCs de Centro y sus reglas de inventario/jerarquía. Sólo adapta aseo.
do $$begin
 if to_regprocedure('public.cleaning_base_centro_update(date,text,integer,text,jsonb,text)') is null then alter function public.centro_update_task(date,text,integer,text,jsonb,text) rename to cleaning_base_centro_update;end if;
 if to_regprocedure('public.cleaning_base_centro_context(date)') is null then alter function public.centro_context(date) rename to cleaning_base_centro_context;end if;
 if to_regprocedure('public.cleaning_base_centro_assignments(date)') is null then alter function public.centro_task_assignments(date) rename to cleaning_base_centro_assignments;end if;
end $$;
revoke all on function cleaning_base_centro_update(date,text,integer,text,jsonb,text),cleaning_base_centro_context(date),cleaning_base_centro_assignments(date) from public,anon,authenticated;
create or replace function centro_task_assignments(target_day date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare assignments jsonb;begin
 assignments:=cleaning_base_centro_assignments(target_day);
 return coalesce((select jsonb_agg(case when c.owner_id is not null and c.data->>'cleaningDeadlineMissed'='true' then a||jsonb_build_object('ownerId',c.owner_id) else a end) from jsonb_array_elements(assignments)a left join centro_operation_records c on c.day=target_day and c.task_id=a->>'taskId' and c.task_id like 'aseo-%'),'[]');
end $$;
create or replace function centro_reconcile_day(target_day date)
returns void language plpgsql security definer set search_path=public as $$
declare roster jsonb;present_count integer;prior_flag text:=current_setting('xoxo.cleaning_write',true);
begin
 if target_day<>(now() at time zone 'America/Mexico_City')::date then return;end if;
 perform pg_advisory_xact_lock(hashtext('centro-'||target_day::text));roster:=centro_roster(target_day);
 select count(*) into present_count from jsonb_array_elements(roster)p where (p->>'present')::boolean;
 perform set_config('xoxo.cleaning_write','server',true);
 update centro_operation_records r set status='Pausada',version=version+1,updated_at=now(),data=case when data->>'mode'='Exterior' then data||'{"mode":"Digital / interior"}'::jsonb else data end,
 history=history||jsonb_build_array(jsonb_build_object('at',now(),'actor','sistema','action','pause','note',case when data->>'mode'='Exterior' then 'Seguridad: cambió la cobertura; regresar a tienda y continuar dentro' else 'Cambio de disponibilidad; avance conservado para reasignación' end))
 where day=target_day and status='En curso' and
 not (r.task_id like 'aseo-%' and coalesce(r.data->>'cleaningRecoveryStartedAt','')<>'' and exists(select 1 from jsonb_array_elements(roster)p where p->>'id'=r.owner_id and p->>'arrived'='true' and not (select coalesce(a.payload->>'out','')<>'' from attendance_records a where a.employee_number=r.owner_id and a.record_date=target_day limit 1)))
 and ((data->>'mode'='Exterior' and present_count<2) or not exists(select 1 from jsonb_array_elements(roster)p where p->>'id'=r.owner_id and (p->>'present')::boolean));
 perform set_config('xoxo.cleaning_write',coalesce(prior_flag,''),true);
end $$;
create or replace function centro_update_task(target_day date,target_task text,expected_version integer,task_action text,task_data jsonb default '{}',action_note text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare spec jsonb;actor text:=(current_profile()).employee_number;r centro_operation_records;g jsonb;stamp timestamptz:=now();audit_history jsonb;
begin
 select definition into spec from centro_task_templates where task_id=target_task;
 if spec->>'category' is distinct from 'Aseo' or task_action in('approve','reject') or target_day<(select activated_on from cleaning_deadline_policy where id) then
  perform set_config('xoxo.cleaning_write','server',true);g:=cleaning_base_centro_update(target_day,target_task,expected_version,task_action,task_data,action_note);perform set_config('xoxo.cleaning_write','',true);return g;
 end if;
 if actor is null or target_day<>(now() at time zone 'America/Mexico_City')::date or work_branch(actor,target_day)<>'Sucursal Centro' then raise exception 'Debes estar asignado a Centro hoy';end if;
 if task_action not in('start','resume','save','pause','submit') then raise exception 'Acción de aseo inválida';end if;
 if jsonb_typeof(task_data) is distinct from 'object' or octet_length(task_data::text)>250000 then raise exception 'Captura inválida o demasiado grande';end if;
 perform pg_advisory_xact_lock(hashtext('centro-'||target_day::text));select * into r from centro_operation_records where day=target_day and task_id=target_task for update;
 if r.owner_id is distinct from actor then raise exception 'Sólo el encargado asignado puede hacer este aseo';end if;
 if r.version<>expected_version then raise exception 'Otro usuario actualizó esta actividad. Actualiza antes de guardar';end if;
 if r.status in('Por validar','Validada') then raise exception 'La captura está cerrada; requiere devolución del supervisor';end if;
 g:=cleaning_gate(actor,target_day,spec->>'start',spec->>'end',false);if g->>'blocked'='true' then raise exception '%',g->>'reason';end if;
 -- Campos de control y relojes nunca se aceptan del cliente.
 task_data:=(task_data-array['cleaningDeadlineMissed','cleaningStoppedAt','cleaningRecoveryAvailableAt','cleaningRecoveryStartedAt','cleaningStartedAt','cleaningCompletedAt','cleaningOnTime']) || (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(r.data) where key like 'cleaning%');
 audit_history:=r.history;
 if task_action in('start','resume') then
  if r.status='En curso' then return to_jsonb(r);end if;
  task_data:=task_data||jsonb_build_object('cleaningStartedAt',coalesce(r.data->'cleaningStartedAt',to_jsonb(stamp)));
  if g->>'expired'='true' then task_data:=task_data||jsonb_build_object('cleaningDeadlineMissed',true,'cleaningStoppedAt',g->'deadlineAt','cleaningRecoveryAvailableAt',g->'releaseAt','cleaningRecoveryStartedAt',stamp);end if;
  r.status:='En curso';
 else
  if r.status<>'En curso' then raise exception 'Primero inicia o retoma el aseo habilitado';end if;
  if g->>'expired'='true' and coalesce(task_data->>'cleaningRecoveryStartedAt','')='' then raise exception 'Retoma el aseo desde tu hora de salida programada';end if;
  if task_action='pause' then if action_note not in('Cliente','Seguridad','Incidencia') then raise exception 'Motivo de pausa inválido';end if;r.status:='Pausada';end if;
  if task_action='submit' then
   if coalesce(task_data->>'fotoAntes','')!~'^data:image/(jpeg|png|webp);base64,' or coalesce(task_data->>'fotoDespues','')!~'^data:image/(jpeg|png|webp);base64,' or task_data->>'realizado' is distinct from 'true' then raise exception 'Faltan fotos antes/después o confirmar aseo realizado';end if;
   task_data:=task_data||jsonb_build_object('cleaningCompletedAt',stamp,'cleaningOnTime',g->>'expired'<>'true' and task_data->>'cleaningDeadlineMissed' is distinct from 'true');r.status:='Por validar';
  end if;
 end if;
 perform set_config('xoxo.cleaning_write','server',true);
 if task_action in('start','resume') then update centro_operation_records set status='Pausada',version=version+1,updated_at=stamp,history=history||jsonb_build_array(jsonb_build_object('at',stamp,'actor',actor,'action','pause','note','Cambio de actividad; conserva avance')) where day=target_day and owner_id=actor and task_id<>target_task and status='En curso';end if;
 update centro_operation_records set status=r.status,data=task_data,version=version+1,updated_at=stamp,history=audit_history||jsonb_build_array(jsonb_build_object('at',stamp,'actor',actor,'action',task_action,'note',action_note)) where day=target_day and task_id=target_task returning * into r;
 perform set_config('xoxo.cleaning_write','',true);return to_jsonb(r);
end $$;
create or replace function cleaning_centro_write_guard()
returns trigger language plpgsql security definer set search_path=public as $$begin
 if current_setting('xoxo.cleaning_write',true)='server' or new.day<(select activated_on from cleaning_deadline_policy where id) or not exists(select 1 from centro_task_templates where task_id=new.task_id and definition->>'category'='Aseo') then return new;end if;
 if TG_OP='UPDATE' and new.data=old.data and new.status=old.status and new.owner_id=old.owner_id then return new;end if;
 raise exception 'El aseo debe actualizarse por su proceso con control de horario';
end $$;
drop trigger if exists cleaning_centro_control on centro_operation_records;create trigger cleaning_centro_control before insert or update on centro_operation_records for each row execute function cleaning_centro_write_guard();
create or replace function centro_context(target_day date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;assignment jsonb;spec jsonb;gates jsonb:='[]';r record;begin
 perform set_config('xoxo.cleaning_write','server',true);result:=cleaning_base_centro_context(target_day);
 if target_day=(now() at time zone 'America/Mexico_City')::date and target_day>=(select activated_on from cleaning_deadline_policy where id) then
  for assignment in select a from jsonb_array_elements(result->'assignments')a where a->>'taskId' like 'aseo-%' and coalesce(a->>'ownerId','')<>'' loop
   insert into centro_operation_records(day,task_id,owner_id) values(target_day,assignment->>'taskId',assignment->>'ownerId') on conflict(day,task_id) do update set owner_id=excluded.owner_id,version=centro_operation_records.version+1,updated_at=now(),history=centro_operation_records.history||jsonb_build_array(jsonb_build_object('at',now(),'actor','sistema','action','reassign','note','Cambio de disponibilidad antes del vencimiento; avance conservado')) where centro_operation_records.owner_id<>excluded.owner_id and coalesce(centro_operation_records.data->>'cleaningDeadlineMissed','false')<>'true' and centro_operation_records.status not in('Por validar','Validada');
  end loop;
  perform cleaning_reconcile(target_day);perform set_config('xoxo.cleaning_write','server',true);result:=cleaning_base_centro_context(target_day);
  for r in select c.*,t.definition from centro_operation_records c join centro_task_templates t using(task_id) where c.day=target_day and t.definition->>'category'='Aseo' and (c.owner_id=(current_profile()).employee_number or centro_is_supervisor()) loop
   gates:=gates||jsonb_build_array(cleaning_gate(r.owner_id,target_day,r.definition->>'start',r.definition->>'end',r.status in('Por validar','Validada'))||jsonb_build_object('taskId',r.task_id,'ownerId',r.owner_id));
  end loop;
 end if;
 perform set_config('xoxo.cleaning_write','',true);return result||jsonb_build_object('cleaningGates',gates);
end $$;
revoke all on function centro_context(date),centro_update_task(date,text,integer,text,jsonb,text) from public,anon;grant execute on function centro_context(date),centro_update_task(date,text,integer,text,jsonb,text) to authenticated;
revoke all on function centro_task_assignments(date),centro_reconcile_day(date),cleaning_centro_write_guard() from public,anon,authenticated;
revoke all on function cleaning_exit_time(text,date),cleaning_run_spec(text,date,text,text),cleaning_gate(text,date,text,text,boolean),cleaning_run_write_guard(),cleaning_reconcile(date) from public,anon,authenticated;
revoke all on function cleaning_run_action(text,text,text,jsonb),cleaning_deadline_context(date) from public,anon;grant execute on function cleaning_run_action(text,text,text,jsonb),cleaning_deadline_context(date) to authenticated;
do $$declare definition text;begin
 definition:=pg_get_functiondef('staff_week_items(text,date,date,timestamp)'::regprocedure);
 if position('cleaningDeadlineMissed' in definition)=0 then
  definition:=replace(definition,'when p->>''onTime''=''false'' or elapsed>','when p->>''cleaningDeadlineMissed''=''true'' or p->>''cleaningOnTime''=''false'' or p->>''onTime''=''false'' or elapsed>');
  execute definition;
 end if;
end $$;
notify pgrst,'reload schema';commit;
