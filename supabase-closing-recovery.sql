-- Ventana de cierre y repetición de aseo vencido con fotos nuevas.
begin;
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
  if gate->>'expired'='true' and coalesce(p->>'cleaningFreshRecovery','false')<>'true' then
   p:=(p-array['beforeEvidenceCapture','afterEvidenceCapture','evidenceCapture','completedAt','startedAt','pausedAt','pauseReason'])||jsonb_build_object('cleaningEarlierAttempts',coalesce(p->'cleaningEarlierAttempts','[]')||jsonb_build_array(jsonb_build_object('archivedAt',stamp,'startedAt',p->'startedAt','completedAt',p->'completedAt','before',p->'beforeEvidenceCapture','after',p->'afterEvidenceCapture','reason','Repetir aseo incompleto después de la salida')),'cleaningFreshRecovery',true,'cleaningRecoveryStartedAt',stamp,'cleaningPriorPausedMinutes',p->'pausedMinutes','pausedMinutes',0);
  end if;
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
   if gate->>'expired'='true' and (coalesce(p->>'cleaningFreshRecovery','false')<>'true' or coalesce((p#>>'{beforeEvidenceCapture,capturedAt}')::timestamptz,'-infinity'::timestamptz)<(p->>'cleaningRecoveryStartedAt')::timestamptz or coalesce((p#>>'{afterEvidenceCapture,capturedAt}')::timestamptz,'-infinity'::timestamptz)<(p->>'cleaningRecoveryStartedAt')::timestamptz) then raise exception 'Repite el aseo después de tu salida y registra fotos nuevas de antes y después';end if;
   p:=p||jsonb_build_object('completedAt',stamp,'status',case when p->>'cleaningDeadlineMissed'='true' then 'Completada con retraso' else 'Completada' end,'onTime',p->>'cleaningDeadlineMissed' is distinct from 'true');
  else raise exception 'El aseo requiere fotos antes y después';end if;
 end if;
 p:=p||jsonb_build_object('cleaningAudit',coalesce(p->'cleaningAudit','[]')||jsonb_build_array(jsonb_build_object('at',stamp,'action',run_action,'actor',actor)));
 perform set_config('xoxo.cleaning_write','server',true);
 insert into activity_run_records(record_id,employee_number,branch,record_date,payload,updated_by) values(rid,actor,work_branch(actor,day),day,p,auth.uid()) on conflict(record_id) do update set payload=excluded.payload,updated_at=now(),updated_by=auth.uid();
 perform set_config('xoxo.cleaning_write','',true);return p;
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
  if g->>'expired'='true' and coalesce(task_data->>'cleaningFreshRecovery','false')<>'true' then
   task_data:=(task_data-array['fotoAntes','fotoDespues','realizado','cleaningStartedAt','cleaningCompletedAt','cleaningBeforeCapturedAt','cleaningAfterCapturedAt'])||jsonb_build_object('cleaningEarlierAttempts',coalesce(r.data->'cleaningEarlierAttempts','[]')||jsonb_build_array(jsonb_build_object('archivedAt',stamp,'before',r.data->'fotoAntes','after',r.data->'fotoDespues','reason','Repetir aseo incompleto después de la salida')),'cleaningFreshRecovery',true,'cleaningRecoveryStartedAt',stamp);
  end if;
  if r.status='En curso' and (g->>'expired'<>'true' or coalesce(r.data->>'cleaningFreshRecovery','false')='true') then return to_jsonb(r);end if;
  task_data:=task_data||jsonb_build_object('cleaningStartedAt',coalesce(r.data->'cleaningStartedAt',to_jsonb(stamp)));
  if g->>'expired'='true' then task_data:=task_data||jsonb_build_object('cleaningDeadlineMissed',true,'cleaningStoppedAt',g->'deadlineAt','cleaningRecoveryAvailableAt',g->'releaseAt','cleaningRecoveryStartedAt',stamp);end if;
  r.status:='En curso';
 else
  if r.status<>'En curso' then raise exception 'Primero inicia o retoma el aseo habilitado';end if;
  if g->>'expired'='true' and coalesce(task_data->>'cleaningRecoveryStartedAt','')='' then raise exception 'Retoma el aseo desde tu hora de salida programada';end if;
  if task_action='pause' then if action_note not in('Cliente','Seguridad','Incidencia') then raise exception 'Motivo de pausa inválido';end if;r.status:='Pausada';end if;
  if g->>'expired'='true' then
   if coalesce(task_data->>'fotoAntes','')<>'' and task_data->>'fotoAntes' is distinct from r.data->>'fotoAntes' then task_data:=task_data||jsonb_build_object('cleaningBeforeCapturedAt',stamp);end if;
   if coalesce(task_data->>'fotoDespues','')<>'' and task_data->>'fotoDespues' is distinct from r.data->>'fotoDespues' then task_data:=task_data||jsonb_build_object('cleaningAfterCapturedAt',stamp);end if;
  end if;
  if task_action='submit' then
   if g->>'expired'='true' and (coalesce(task_data->>'cleaningFreshRecovery','false')<>'true' or coalesce((task_data->>'cleaningBeforeCapturedAt')::timestamptz,'-infinity'::timestamptz)<(task_data->>'cleaningRecoveryStartedAt')::timestamptz or coalesce((task_data->>'cleaningAfterCapturedAt')::timestamptz,'-infinity'::timestamptz)<(task_data->>'cleaningRecoveryStartedAt')::timestamptz) then raise exception 'Repite el aseo después de tu salida y registra fotos nuevas de antes y después';end if;
   if coalesce(task_data->>'fotoAntes','')!~'^data:image/(jpeg|png|webp);base64,' or coalesce(task_data->>'fotoDespues','')!~'^data:image/(jpeg|png|webp);base64,' or task_data->>'realizado' is distinct from 'true' then raise exception 'Faltan fotos antes/después o confirmar aseo realizado';end if;
   task_data:=task_data||jsonb_build_object('cleaningCompletedAt',stamp,'cleaningOnTime',g->>'expired'<>'true' and task_data->>'cleaningDeadlineMissed' is distinct from 'true');r.status:='Por validar';
  end if;
 end if;
 perform set_config('xoxo.cleaning_write','server',true);
 if task_action in('start','resume') then update centro_operation_records set status='Pausada',version=version+1,updated_at=stamp,history=history||jsonb_build_array(jsonb_build_object('at',stamp,'actor',actor,'action','pause','note','Cambio de actividad; conserva avance')) where day=target_day and owner_id=actor and task_id<>target_task and status='En curso';end if;
 update centro_operation_records set status=r.status,data=task_data,version=version+1,updated_at=stamp,history=audit_history||jsonb_build_array(jsonb_build_object('at',stamp,'actor',actor,'action',task_action,'note',action_note)) where day=target_day and task_id=target_task returning * into r;
 perform set_config('xoxo.cleaning_write','',true);return to_jsonb(r);
end $$;
create or replace function closing_recovery_context() returns jsonb language plpgsql security definer set search_path=public as $$
declare actor text:=(current_profile()).employee_number;day date:=(now() at time zone 'America/Mexico_City')::date;clock timestamp:=now() at time zone 'America/Mexico_City';exit_time text;release timestamp;items jsonb;applicable boolean;
begin
 if actor is null then raise exception 'Sesión requerida';end if;
 exit_time:=cleaning_exit_time(actor,day);if exit_time is null then return jsonb_build_object('applicable',false);end if;
 applicable:=not staff_is_rest(actor,day) or exists(select 1 from attendance_records where employee_number=actor and record_date=day and coalesce(payload->>'in','')<>'');
 release:=day+exit_time::time-interval '5 minutes';perform staff_capture_today_plans();
 select coalesce(jsonb_agg(i),'[]') into items from jsonb_array_elements(staff_week_items(actor,day,day,clock))i where (i->>'completed'='false' or i->>'evidenceComplete'='false') and (i->>'due'='true' or coalesce(i->>'end','23:59')<=exit_time);
 return jsonb_build_object('applicable',applicable,'clock',clock at time zone 'America/Mexico_City','releaseAt',release at time zone 'America/Mexico_City','releaseTime',to_char(release,'HH24:MI'),'exitTime',exit_time,'items',items);
end $$;
create or replace function closing_recovery_open() returns jsonb language plpgsql security definer set search_path=public as $$declare ctx jsonb;begin
 ctx:=closing_recovery_context();if ctx->>'applicable'<>'true' then raise exception 'Sin jornada activa para regularizar';end if;
 if now()<(ctx->>'releaseAt')::timestamptz then raise exception 'La regularización se habilita a las %, cinco minutos antes de tu salida de %',ctx->>'releaseTime',ctx->>'exitTime';end if;return ctx;
end $$;
revoke all on function closing_recovery_context(),closing_recovery_open() from public,anon;grant execute on function closing_recovery_context(),closing_recovery_open() to authenticated;
notify pgrst,'reload schema';commit;
