begin;
create table if not exists invewin_project_settings(id boolean primary key default true check(id),starts_on date not null default (now() at time zone 'America/Mexico_City')::date,deadline date not null default '2026-12-01',minimum_codes integer not null default 50);
insert into invewin_project_settings(id) values(true) on conflict do nothing;
create table if not exists invewin_daily_records(record_id text primary key,employee_number text not null,branch text not null default 'Matriz' check(branch='Matriz'),record_date date not null,payload jsonb not null,version integer not null default 0,updated_at timestamptz not null default now());
alter table invewin_project_settings enable row level security;alter table invewin_daily_records enable row level security;
revoke all on invewin_project_settings,invewin_daily_records from public,anon,authenticated;grant select on invewin_daily_records to authenticated;
drop policy if exists invewin_read on invewin_daily_records;create policy invewin_read on invewin_daily_records for select to authenticated using(employee_number=(current_profile()).employee_number or staff_can_review(employee_number));
insert into app_state(key,value) values('xoxo.activitySchedules','[]') on conflict do nothing;
update app_state set value=value||jsonb_build_array('{"id":"matriz-invewin-configuracion","name":"Configuración del nuevo sistema Invewin · mínimo 50 códigos","area":"Catálogo Invewin","branch":"Matriz","ownerRoles":["JEFE_AREA"],"sharedRoutine":true,"activeFrom":"2026-11-06","activeUntil":"2026-12-01","start":"11:00","end":"12:30","durationMinutes":90,"evidence":"none","assignedBy":"Dirección","editableBy":["APODERADA_LEGAL","DIRECTOR","GERENTE_GENERAL","GERENTE_TIENDA"],"objective":"Tener en Invewin la totalidad de productos de Matriz dados de alta y verificados antes del 2 de diciembre de 2026.","instructions":"Registrar al menos 50 códigos diferentes por jefe y día laborable, con descripción, código, precio y cantidad de venta. Trabajar por zonas: terminar un anaquel o muestrario antes de empezar otro. Dar de alta y comprobar los datos en Invewin, registrar los códigos y referencia de comprobación en el proceso Invewin del Panel, y enviar a validación del superior. No volver a contar códigos ya validados. Fecha límite: 1 de diciembre de 2026; la atención al cliente conserva prioridad."}'::jsonb),updated_at=now() where key='xoxo.activitySchedules' and not exists(select 1 from jsonb_array_elements(value)a where a->>'id'='matriz-invewin-configuracion');
create or replace function invewin_eligible(person text,day date) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where employee_number=person and active and role='JEFE_AREA' and work_branch(person,day)='Matriz') and not staff_is_rest(person,day)$$;
create or replace function invewin_reconcile(day date) returns void language plpgsql security definer set search_path=public as $$
declare p profiles;cfg invewin_project_settings;spec jsonb;slot jsonb;
begin
 if day<>(now() at time zone 'America/Mexico_City')::date then return;end if;
 select * into cfg from invewin_project_settings where id;if day not between cfg.starts_on and cfg.deadline then return;end if;
 perform staff_capture_today_plans();select a into spec from app_state st cross join lateral jsonb_array_elements(st.value)a where st.key='xoxo.activitySchedules' and a->>'id'='matriz-invewin-configuracion';
 slot:=jsonb_build_object('key','Actividad-matriz-invewin-configuracion','kind','Actividad','itemId','matriz-invewin-configuracion','title',spec->>'name','start','11:00','end','12:30','instructions',spec->>'instructions','evidence','none','slaMinutes',90);
 for p in select * from profiles where active and role='JEFE_AREA' loop
  if not invewin_eligible(p.employee_number,day) then continue;end if;
  insert into invewin_daily_records(record_id,employee_number,record_date,payload) values(day||'-'||p.employee_number,p.employee_number,day,jsonb_build_object('id',day||'-'||p.employee_number,'employeeId',p.employee_number,'date',day,'branch','Matriz','title','Configuración del nuevo sistema Invewin','status','Pendiente','start','11:00','end','12:30','minimumCodes',cfg.minimum_codes,'batches','[]'::jsonb,'history','[]'::jsonb,'codeCount',0)) on conflict do nothing;
  insert into operation_day_plans(employee_number,day,branch,slots) values(p.employee_number,day,'Matriz',jsonb_build_array(slot)) on conflict do nothing;
  update operation_day_plans d set slots=(select jsonb_agg(case when a->>'itemId'='matriz-operacion-programada' then a||jsonb_build_object('start','12:30','slaMinutes',240) else a end) from jsonb_array_elements(d.slots)a)||case when exists(select 1 from jsonb_array_elements(d.slots)a where a->>'itemId'='matriz-invewin-configuracion') then '[]'::jsonb else jsonb_build_array(slot) end where employee_number=p.employee_number and d.day=invewin_reconcile.day and branch='Matriz';
 end loop;
end $$;
create or replace function invewin_context(target_day date default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor profiles:=current_profile();cfg invewin_project_settings;day date:=(now() at time zone 'America/Mexico_City')::date;rows jsonb;team jsonb;codes integer;
begin
 if actor.employee_number is null then raise exception 'Sesión requerida';end if;
 perform invewin_reconcile(day);select * into cfg from invewin_project_settings where id;
 select coalesce(jsonb_agg(to_jsonb(r) order by record_date desc,employee_number),'[]') into rows from (select * from invewin_daily_records where record_date=coalesce(target_day,day) and (employee_number=actor.employee_number or staff_can_review(employee_number)) order by record_date desc limit 120)r;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.employee_number,'name',p.display_name) order by p.display_name),'[]') into team from profiles p where p.active and p.role='JEFE_AREA' and work_branch(p.employee_number,day)='Matriz' and (p.employee_number=actor.employee_number or staff_can_review(p.employee_number));
 select count(distinct upper(trim(product->>'code'))) into codes from invewin_daily_records r cross join lateral jsonb_array_elements(r.payload->'batches')b cross join lateral jsonb_array_elements(b->'products')product where r.payload->>'status'='Validada' and (r.employee_number=actor.employee_number or staff_can_review(r.employee_number));
 return jsonb_build_object('rows',rows,'team',team,'eligible',invewin_eligible(actor.employee_number,day),'active',day between cfg.starts_on and cfg.deadline,'start',cfg.starts_on,'deadline',cfg.deadline,'minimumCodes',cfg.minimum_codes,'validatedCodes',codes,'clock',to_char(now() at time zone 'America/Mexico_City','HH24:MI'),'today',day);
end $$;
create or replace function invewin_run_guard() returns trigger language plpgsql security definer set search_path=public as $$begin
 if TG_OP='DELETE' then if old.payload->>'itemId'='matriz-invewin-configuracion' then raise exception 'El historial Invewin se conserva';end if;return old;end if;
 if new.payload->>'itemId' is distinct from 'matriz-invewin-configuracion' and (TG_OP<>'UPDATE' or old.payload->>'itemId' is distinct from 'matriz-invewin-configuracion') then return new;end if;
 if current_setting('xoxo.invewin_write',true)='server' or TG_OP='UPDATE' and new.payload=old.payload then return new;end if;
 if TG_OP='UPDATE' and (new.payload-array['pausedAt','pauseReason','status','employeeComment','escalated'])=(old.payload-array['pausedAt','pauseReason','status','employeeComment','escalated']) and (new.payload->>'pauseReason' in('Cliente','Seguridad') and coalesce(new.payload->>'pausedAt','')<>'' or new.payload->>'escalated'='true') then return new;end if;
 raise exception 'Registra los códigos y entrega la actividad desde el proceso Invewin del Panel';
end $$;
drop trigger if exists invewin_run_control on activity_run_records;create trigger invewin_run_control before insert or update or delete on activity_run_records for each row execute function invewin_run_guard();
create or replace function invewin_action(record_day date,person text,action text,expected_version integer,changes jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public as $$
declare actor profiles:=current_profile();r invewin_daily_records;cfg invewin_project_settings;data jsonb;batches jsonb;batch jsonb;product jsonb;codes text[]:=array[]::text[];code_key text;batch_id text;run_id text;run jsonb;stamp timestamptz:=now();clock text:=to_char(now() at time zone 'America/Mexico_City','HH24:MI');review boolean:=action in('approve','reject');
begin
 if actor.employee_number is null then raise exception 'Sesión requerida';end if;
 if jsonb_typeof(changes) is distinct from 'object' or octet_length(changes::text)>1000000 then raise exception 'Captura inválida o demasiado grande';end if;
 if action not in('start','save','submit','approve','reject') then raise exception 'Acción inválida';end if;
 perform pg_advisory_xact_lock(hashtext('invewin-project'));select * into cfg from invewin_project_settings where id;perform invewin_reconcile((now() at time zone 'America/Mexico_City')::date);
 select * into r from invewin_daily_records where employee_number=person and record_date=record_day for update;
 if r.record_id is null then raise exception 'Actividad no asignada';end if;
 if r.version<>expected_version then raise exception 'El avance cambió en otra sesión. Actualiza antes de guardar';end if;
 if review then
  if not staff_can_review(person) then raise exception 'Sólo el superior puede validar; no se permite autovalidación';end if;
  if r.payload->>'status'<>'Por validar' then raise exception 'La entrega no está pendiente de validación';end if;
  if coalesce(length(trim(changes->>'note')),0)<10 then raise exception 'Agrega una observación de revisión (mínimo 10 caracteres)';end if;
 else
  if actor.employee_number<>person or record_day<>(now() at time zone 'America/Mexico_City')::date or not invewin_eligible(person,record_day) or record_day not between cfg.starts_on and cfg.deadline then raise exception 'Actividad exclusiva de jefes de área de Matriz durante el proyecto y en su jornada laborable';end if;
  if clock<'11:00' then raise exception 'La actividad inicia a las 11:00';end if;
  if r.payload->>'status' in('Por validar','Validada') then raise exception 'La entrega está cerrada; requiere devolución del superior';end if;
 end if;
 data:=r.payload;batches:=data->'batches';run_id:=person||'-'||record_day||'-Actividad-matriz-invewin-configuracion';select payload into run from activity_run_records where record_id=run_id;run:=coalesce(run,jsonb_build_object('id',run_id,'employeeId',person,'date',record_day,'branch','Matriz','itemType','Actividad','itemId','matriz-invewin-configuracion','title','Configuración del nuevo sistema Invewin · mínimo 50 códigos','scheduledStart','11:00','scheduledEnd','12:30','slaMinutes',90,'evidence','none','validationRequired',true));
 if action in('save','submit') and coalesce(run->>'pausedAt','')<>'' then raise exception 'Retoma el proceso antes de guardar o entregar';end if;
 if action='start' then
  if coalesce(data->>'startedAt','')='' then data:=data||jsonb_build_object('startedAt',stamp);end if;
  if coalesce(run->>'pausedAt','')<>'' then run:=run||jsonb_build_object('pausedMinutes',coalesce((run->>'pausedMinutes')::numeric,0)+greatest(0,extract(epoch from (stamp-(run->>'pausedAt')::timestamptz))/60));end if;
  run:=(run-array['pausedAt','pauseReason'])||jsonb_build_object('startedAt',data->'startedAt','status','En curso');data:=data||jsonb_build_object('status','En curso');
 elsif action='save' then
  if coalesce(data->>'startedAt','')='' then raise exception 'Primero inicia el proceso';end if;
  if coalesce(changes->>'zoneType','') not in('Anaquel','Muestrario') or coalesce(length(trim(changes->>'zone')),0)<2 or jsonb_typeof(changes->'products') is distinct from 'array' or jsonb_array_length(changes->'products')>300 then raise exception 'Indica anaquel o muestrario, zona y hasta 300 productos por lote';end if;
  batch_id:=coalesce(nullif(changes->>'batchId',''),gen_random_uuid()::text);
  if coalesce(changes->>'batchId','')<>'' and not exists(select 1 from jsonb_array_elements(batches)b where b->>'id'=batch_id) then raise exception 'Zona no reconocida';end if;
  if exists(select 1 from jsonb_array_elements(batches)b where b->>'id'<>batch_id and b->>'closed'<>'true') then raise exception 'Termina el anaquel o muestrario abierto antes de comenzar otra zona';end if;
  for batch in select b from jsonb_array_elements(batches)b where b->>'id'<>batch_id loop for product in select value from jsonb_array_elements(batch->'products') loop codes:=array_append(codes,upper(trim(product->>'code')));end loop;end loop;
  for product in select value from jsonb_array_elements(changes->'products') loop
   code_key:=upper(trim(product->>'code'));
   if coalesce(code_key,'')='' or length(code_key)>100 or coalesce(length(trim(product->>'description')),0)<3 or coalesce(product->>'price','')!~'^[0-9]+(\.[0-9]+)?$' or coalesce(product->>'saleQuantity','')!~'^[0-9]+(\.[0-9]+)?$' then raise exception 'Cada producto requiere código, descripción, precio y cantidad de venta numéricos no negativos';end if;
   if code_key=any(codes) then raise exception 'Código repetido en el día: %',code_key;end if;codes:=array_append(codes,code_key);
   if exists(select 1 from invewin_daily_records d cross join lateral jsonb_array_elements(d.payload->'batches')b cross join lateral jsonb_array_elements(b->'products')p where d.record_id<>r.record_id and d.payload->>'status'='Validada' and upper(trim(p->>'code'))=code_key) then raise exception 'El código % ya fue validado; no cuenta otra vez como alta nueva',code_key;end if;
  end loop;
  batch:=jsonb_build_object('id',batch_id,'zoneType',changes->>'zoneType','zone',trim(changes->>'zone'),'products',changes->'products','closed',coalesce((changes->>'closed')::boolean,false),'updatedAt',stamp);
  select coalesce(jsonb_agg(case when b->>'id'=batch_id then batch else b end),'[]') into batches from jsonb_array_elements(batches)b;
  if not exists(select 1 from jsonb_array_elements(batches)b where b->>'id'=batch_id) then batches:=batches||jsonb_build_array(batch);end if;
  data:=data||jsonb_build_object('batches',batches,'codeCount',cardinality(codes),'status','En curso');
 elsif action='submit' then
  if coalesce((data->>'codeCount')::integer,0)<cfg.minimum_codes then raise exception 'Se requieren al menos % códigos diferentes en el día',cfg.minimum_codes;end if;
  if exists(select 1 from jsonb_array_elements(batches)b where b->>'closed'<>'true') then raise exception 'Confirma que cada anaquel o muestrario está terminado';end if;
  if changes->>'confirmedInErp' is distinct from 'true' or coalesce(length(trim(changes->>'reference')),0)<5 then raise exception 'Confirma el alta en Invewin e indica folio, exportación o referencia verificable';end if;
  data:=data||jsonb_build_object('status','Por validar','completedAt',stamp,'onTime',clock<='12:30','reference',trim(changes->>'reference'),'confirmedInErp',true,'areaComplete',coalesce((changes->>'areaComplete')::boolean,false));
  run:=run||jsonb_build_object('completedAt',stamp,'status',case when clock<='12:30' then 'Completada' else 'Completada con retraso' end,'onTime',clock<='12:30','approvalStatus','Pendiente');
 elsif action='approve' then
  if exists(select 1 from jsonb_array_elements(batches)b cross join lateral jsonb_array_elements(b->'products')p join invewin_daily_records other on other.record_id<>r.record_id and other.payload->>'status'='Validada' cross join lateral jsonb_array_elements(other.payload->'batches')ob cross join lateral jsonb_array_elements(ob->'products')op where upper(trim(p->>'code'))=upper(trim(op->>'code'))) then raise exception 'Otra entrega validada ya incluye uno de estos códigos. Devuelve la entrega para corregir el duplicado';end if;
  data:=data||jsonb_build_object('status','Validada','validatedAt',stamp,'validatedById',actor.employee_number,'reviewNote',trim(changes->>'note'));run:=run||jsonb_build_object('approvalStatus','Aprobada','validatedAt',stamp,'validatedById',actor.employee_number);
 else
  data:=data||jsonb_build_object('status','Corrección','reviewNote',trim(changes->>'note'));run:=(run-array['completedAt','validatedAt','validatedById'])||jsonb_build_object('status','Pausada','pausedAt',stamp,'pauseReason','Corrección solicitada por el superior','approvalStatus','Pendiente');
 end if;
 data:=data||jsonb_build_object('history',coalesce(data->'history','[]')||jsonb_build_array(jsonb_build_object('at',stamp,'actor',actor.employee_number,'action',action,'codeCount',data->'codeCount','note',case when review then changes->>'note' end)));
 update invewin_daily_records set payload=data,version=version+1,updated_at=stamp where record_id=r.record_id returning * into r;
 perform set_config('xoxo.invewin_write','server',true);insert into activity_run_records(record_id,employee_number,branch,record_date,payload,updated_by) values(run_id,person,'Matriz',record_day,run,auth.uid()) on conflict(record_id) do update set payload=excluded.payload,updated_at=now(),updated_by=auth.uid();perform set_config('xoxo.invewin_write','',true);return to_jsonb(r);
end $$;
create or replace function invewin_evidence(from_day date,to_day date) returns jsonb language plpgsql security invoker set search_path=public as $$begin
 if (current_profile()).employee_number is null or from_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Sesión y periodo de hasta 63 días requeridos';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id','invewin-'||record_id,'employeeId',employee_number,'date',record_date,'branch','Matriz','kind','Actividad','title','Configuración del nuevo sistema Invewin','description','Alta por anaquel o muestrario: código, descripción, precio y cantidad de venta. Meta diaria de 50 códigos; cierre antes del 2 de diciembre de 2026.','scheduled','11:00-12:30','status',payload->>'status','completedAt',payload->>'completedAt','startedAt',payload->>'startedAt','requiresEvidence',false,'recordProof',true,'validationRequired',true,'comment',coalesce(payload->>'codeCount','0')||' códigos. Referencia: '||coalesce(payload->>'reference','Sin entregar'))) from invewin_daily_records where record_date between from_day and to_day),'[]');
end $$;
create or replace function invewin_metrics(from_day date,to_day date) returns jsonb language plpgsql security invoker set search_path=public as $$begin
 if (current_profile()).employee_number is null or from_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Sesión y periodo válido requeridos';end if;
 return jsonb_build_object('invewin_daily_records',jsonb_build_object('available',true,'rows',coalesce((select jsonb_agg(jsonb_build_object('id',record_id,'employeeId',employee_number,'branch',branch,'date',record_date,'status',payload->>'status','codeCount',payload->'codeCount','minimumCodes',payload->'minimumCodes','completedAt',payload->>'completedAt','areaComplete',payload->'areaComplete','onTime',payload->'onTime')) from invewin_daily_records where record_date between from_day and to_day),'[]')));
end $$;
revoke all on function invewin_metrics(date,date) from public,anon;grant execute on function invewin_metrics(date,date) to authenticated;
do $$declare definition text;begin
 definition:=pg_get_functiondef('staff_capture_today_plans()'::regprocedure);
 if position('activeUntil' in definition)=0 then definition:=replace(definition,$old$and (not a?'weekdays' or a->'weekdays' @> to_jsonb(extract(dow from capture_day)::integer));$old$,$new$and (not a?'weekdays' or a->'weekdays' @> to_jsonb(extract(dow from capture_day)::integer)) and coalesce(nullif(a->>'activeFrom','')::date,capture_day)<=capture_day and coalesce(nullif(a->>'activeUntil','')::date,capture_day)>=capture_day;$new$);end if;
 if position('matriz-invewin-configuracion' in definition)=0 then definition:=replace(definition,$old$  if branch<>'Sucursal Centro' then$old$,$new$  if exists(select 1 from jsonb_array_elements(routine)a where a->>'id'='matriz-invewin-configuracion') then select jsonb_agg(case when a->>'id'='matriz-operacion-programada' then a||jsonb_build_object('start','12:30','durationMinutes',240) else a end) into routine from jsonb_array_elements(routine)a;end if;
  if branch<>'Sucursal Centro' then$new$);end if;execute definition;
 definition:=pg_get_functiondef('staff_week_items(text,date,date,timestamp)'::regprocedure);
 if position('invewin_daily_records' in definition)=0 then definition:=replace(definition,$old$  elapsed:=case$old$,$new$  if p->>'itemId'='matriz-invewin-configuracion' and exists(select 1 from invewin_daily_records d where d.employee_number=person and d.record_date=day and d.payload->>'status'='Validada') then validated:=true;end if;
  elapsed:=case$new$);execute definition;end if;
end $$;
revoke all on function invewin_eligible(text,date),invewin_reconcile(date),invewin_run_guard() from public,anon,authenticated;
revoke all on function invewin_context(date),invewin_action(date,text,text,integer,jsonb),invewin_evidence(date,date) from public,anon;grant execute on function invewin_context(date),invewin_action(date,text,text,integer,jsonb),invewin_evidence(date,date) to authenticated;
notify pgrst,'reload schema';commit;
