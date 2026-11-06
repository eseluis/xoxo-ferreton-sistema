-- Permisos con decisión humana, cumplimiento validado y ciclos por descanso.
begin;
create table if not exists staff_rest_settings(employee_number text primary key,weekday integer not null check(weekday between 0 and 6),activated_on date not null default (now() at time zone 'America/Mexico_City')::date);
insert into staff_rest_settings(employee_number,weekday) values('008',6),('010',4),('006',0),('009',0),('005',0),('011',3),('015',0),('007',5) on conflict do nothing;
create table if not exists staff_rest_exceptions(employee_number text not null,day date not null,is_rest boolean not null,request_id text not null,primary key(employee_number,day));
create table if not exists staff_weekly_reviews(employee_number text not null,item_key text not null,fingerprint text not null,reviewer text not null,note text not null,reviewed_at timestamptz not null default now(),primary key(employee_number,item_key));
create table if not exists staff_cycle_snapshots(employee_number text not null,cycle_start date not null,cycle_end date not null,payload jsonb not null,closed_at timestamptz not null default now(),primary key(employee_number,cycle_start));
create table if not exists staff_permission_requests(id text primary key default gen_random_uuid()::text,employee_number text not null,supervisor_id text not null,branch text not null,kind text not null check(kind in('Permiso','Cambio de descanso','Falta por urgencia','No regresar de comida')),target_day date not null,original_rest_day date,reason text not null,status text not null default 'Pendiente' check(status in('Pendiente','Autorizada','Rechazada')),compliance jsonb not null,decision_compliance jsonb,requested_at timestamptz not null default now(),responded_at timestamptz,responded_by text,response text,version integer not null default 0,client_token text not null,unique(employee_number,client_token));
create or replace function staff_role_rank(role_name text)
returns integer language sql immutable set search_path=public as $$select case role_name when 'AUXILIAR' then 1 when 'JEFE_AREA' then 2 when 'CAJERO' then 2 when 'GERENTE_TIENDA' then 3 when 'ADMIN_TIENDA' then 3 when 'ADMIN_GENERAL' then 4 when 'GERENTE_GENERAL' then 5 when 'DIRECTOR' then 6 when 'APODERADA_LEGAL' then 7 else 0 end$$;
create or replace function staff_supervisor(person text,day date)
returns text language plpgsql stable security definer set search_path=public as $$
declare p profiles; candidate text; own_rank integer;
begin
 select * into p from profiles where employee_number=person and active;if p.employee_number is null then return null;end if;
 own_rank:=staff_role_rank(p.role);
 if own_rank=1 then select c->>'supervisorId' into candidate from app_state st cross join lateral jsonb_array_elements(st.value)c join profiles boss on boss.employee_number=c->>'supervisorId' where st.key='xoxo.collaborators' and c->>'id'=person and boss.active and boss.role='JEFE_AREA' and work_branch(boss.employee_number,day)=work_branch(person,day) limit 1;end if;
 if own_rank<3 and candidate is null then select employee_number into candidate from profiles where active and role in('GERENTE_TIENDA','ADMIN_TIENDA') and branch=work_branch(person,day) and employee_number<>person order by employee_number limit 1;end if;
 if candidate is null then
 select c->>'supervisorId' into candidate from app_state s cross join lateral jsonb_array_elements(s.value)c join profiles boss on boss.employee_number=c->>'supervisorId' and boss.active where s.key='xoxo.collaborators' and c->>'id'=person and boss.employee_number<>person and
 staff_role_rank(boss.role)>own_rank and (boss.branch=work_branch(person,day) or boss.role in('APODERADA_LEGAL','DIRECTOR','GERENTE_GENERAL','ADMIN_GENERAL')) limit 1;
 end if;
 if candidate is null and own_rank<5 and person<>'003' and exists(select 1 from profiles where employee_number='003' and active) then candidate:='003';end if;return candidate;
end $$;
create or replace function staff_can_review(person text)
returns boolean language sql stable security definer set search_path=public as $$select coalesce((current_profile()).employee_number<>person and ((can_manage_all() and staff_role_rank((current_profile()).role)>(select staff_role_rank(role) from profiles where employee_number=person)) or (current_profile()).employee_number=staff_supervisor(person,(now() at time zone 'America/Mexico_City')::date)),false)$$;
create or replace function staff_is_rest(person text,day date)
returns boolean language sql stable security definer set search_path=public as $$select coalesce((select is_rest from staff_rest_exceptions where employee_number=person and staff_rest_exceptions.day=staff_is_rest.day),(select weekday=extract(dow from day)::integer from staff_rest_settings where employee_number=person),false)$$;
create or replace function staff_cycle(person text,day date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare first_day date;last_day date;activation date;
begin
 select activated_on into activation from staff_rest_settings where employee_number=person;if activation is null then return jsonb_build_object('configured',false);end if;
 select max(d::date)+1 into first_day from generate_series(day-28,day-1,interval '1 day')d where staff_is_rest(person,d::date);
 select min(d::date) into last_day from generate_series(day,day+28,interval '1 day')d where staff_is_rest(person,d::date);
 return jsonb_build_object('configured',true,'start',greatest(first_day,activation),'end',last_day,'restDay',(select weekday from staff_rest_settings where employee_number=person),'partial',first_day<activation);
end $$;
-- Normaliza obligaciones guardadas, sin exponer fotografías al indicador.
create or replace function staff_week_items(person text,from_day date,to_day date,cutoff timestamp)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb:='[]';r record;s jsonb;p jsonb;entry jsonb;key text;seen text[]:=array[]::text[];finger text;completed boolean;proof boolean;validated boolean;cleaning boolean;due boolean;elapsed numeric;points integer;table_name text;day date;
begin
 for r in select * from operation_day_plans where employee_number=person and operation_day_plans.day between from_day and to_day and not staff_is_rest(person,operation_day_plans.day) order by operation_day_plans.day loop
  for s in select value from jsonb_array_elements(r.slots) where value->>'kind'<>'Centro' loop
   select a.payload,a.record_id into p,key from activity_run_records a where a.employee_number=person and a.record_date=r.day and ((a.payload->>'itemType')||'-'||(a.payload->>'itemId')=s->>'key' or coalesce(s->'aliases','[]') ? ((a.payload->>'itemType')||'-'||(a.payload->>'itemId'))) and coalesce(a.payload->>'removedAt','')='' order by coalesce(a.payload->>'completedAt','') desc limit 1;
   if key is not null then seen:=array_append(seen,key);end if;
   key:='plan:'||r.day||':'||(s->>'key');p:=coalesce(p,'{}')||jsonb_build_object('title',s->>'title','start',s->>'start','end',s->>'end','itemType',s->>'kind','itemId',s->>'itemId','evidence',s->>'evidence','slaMinutes',s->'slaMinutes');
   result:=result||jsonb_build_array(jsonb_build_object('key',key,'date',r.day,'source','Agenda','raw',p));
  end loop;
 end loop;
 for r in select * from activity_run_records where employee_number=person and record_date between from_day and to_day and not(record_id=any(seen)) and not staff_is_rest(person,record_date) loop result:=result||jsonb_build_array(jsonb_build_object('key','run:'||r.record_id,'date',r.record_date,'source','Actividad','raw',r.payload));end loop;
 for r in select * from daily_task_records where employee_number=person and record_date between from_day and to_day loop result:=result||jsonb_build_array(jsonb_build_object('key','task:'||r.record_id,'date',r.record_date,'source','Tarea','raw',r.payload));end loop;
 for r in select * from process_instance_records where employee_number=person and record_date between from_day and to_day and payload->>'processId'<>'apertura' loop result:=result||jsonb_build_array(jsonb_build_object('key','process:'||r.record_id,'date',r.record_date,'source','Proceso','raw',r.payload));end loop;
 foreach table_name in array array['matriz_order_records','matriz_opening_step_records','work_readiness_records'] loop
  if to_regclass('public.'||table_name) is not null then
   for r in execute format('select record_id,record_date,payload from %I where employee_number=$1 and record_date between $2 and $3',table_name) using person,from_day,to_day loop
    result:=result||jsonb_build_array(jsonb_build_object('key',table_name||':'||r.record_id,'date',r.record_date,'source',case table_name when 'matriz_order_records' then 'Pedido Matriz' when 'work_readiness_records' then 'Uniforme y herramientas' else 'Apertura Matriz' end,'raw',r.payload));
   end loop;
  end if;
 end loop;
 for r in select c.*,t.definition from centro_operation_records c join centro_task_templates t using(task_id) where owner_id=person and c.day between from_day and to_day loop
  p:=r.data||jsonb_build_object('title',r.definition->>'title','start',r.definition->>'start','end',r.definition->>'end','status',r.status,'itemType',r.definition->>'category','evidence',case when r.definition->>'category'='Aseo' then 'photo' else coalesce(r.data->>'evidence','none') end,'completedAt',(select h->>'at' from jsonb_array_elements(r.history)h where h->>'action'='submit' order by h->>'at' desc limit 1),'slaMinutes',greatest(1,extract(epoch from ((r.definition->>'end')::time-(r.definition->>'start')::time))/60),'startedAt',(select h->>'at' from jsonb_array_elements(r.history)h where h->>'action'='start' order by h->>'at' limit 1));
  result:=result||jsonb_build_array(jsonb_build_object('key','centro:'||r.day||':'||r.task_id,'date',r.day,'source','Centro','raw',p));
 end loop;
 entry:='[]';
 for s in select value from jsonb_array_elements(result) loop
  p:=s->'raw';key:=s->>'key';day:=(s->>'date')::date;
  if coalesce(p->>'removedAt','')<>'' or p->>'affectsEvaluation'='false' then continue;end if;
  completed:=coalesce(p->>'completedAt','')<>'' or coalesce(p->>'status','') in('Completada','Completada con retraso','Completado','Validada','Por validar');
  if s->>'source'='Uniforme y herramientas' then completed:=true;end if;
  if coalesce(p->>'completedAt','')<>'' and (p->>'completedAt')::timestamptz at time zone 'America/Mexico_City'>cutoff then completed:=false;end if;
  due:=day<cutoff::date or completed or (day=cutoff::date and coalesce(nullif(p->>'end',''),nullif(p->>'scheduledEnd',''),'23:59')<=to_char(cutoff,'HH24:MI'));
  cleaning:=coalesce(p->>'itemType'='Aseo',false) or exists(select 1 from app_state st cross join lateral jsonb_array_elements(st.value)a where st.key='xoxo.activitySchedules' and a->>'id'=p->>'itemId' and lower(a->>'area') like '%aseo%');
  proof:=case when cleaning or p->>'requiresPhoto'='true' or p->>'evidence'='photo' then (coalesce(p#>>'{beforeEvidenceCapture,dataUrl}',p->>'fotoAntes','')<>'' and coalesce(p#>>'{afterEvidenceCapture,dataUrl}',p->>'fotoDespues','')<>'') when p->>'evidence' in('signature','ticket') then coalesce(p#>>'{evidenceCapture,dataUrl}','')<>'' else true end;
  if s->>'source'='Uniforme y herramientas' then proof:=not exists(select 1 from jsonb_each(coalesce(p->'checks','{}'))c where c.value='false'::jsonb);end if;
  if s->>'source'='Centro' and not cleaning then
   proof:=not exists(select 1 from centro_task_templates t where t.task_id=split_part(key,':',3) and (t.definition->>'inventory'='true' or t.definition->>'evidence'='true')) or coalesce(trim(p->>'pendientes'),'')<>'' or coalesce(p->>'evidence','')~'^https?://';
  end if;
  finger:=md5(p::text);validated:=exists(select 1 from staff_weekly_reviews v where v.employee_number=person and v.item_key=key and v.fingerprint=finger and v.reviewed_at at time zone 'America/Mexico_City'<=cutoff);
  -- La validación nativa de Centro se controla en su RPC; no se confía en marcas del cliente.
  if s->>'source'='Centro' and p->>'status'='Validada' then validated:=true;end if;
  elapsed:=case when coalesce(p->>'startedAt','')<>'' and coalesce(p->>'completedAt','')<>'' then greatest(0,extract(epoch from ((p->>'completedAt')::timestamptz-(p->>'startedAt')::timestamptz))/60-coalesce((p->>'pausedMinutes')::numeric,0)) else null end;
  points:=case when not completed or not proof then 0 when p->>'onTime'='false' or elapsed>coalesce((p->>'slaMinutes')::numeric,99999) then 1 else 2 end;
  entry:=entry||jsonb_build_array((s-'raw')||jsonb_build_object('title',coalesce(p->>'title',p->>'phase','Actividad'),'start',coalesce(p->>'start',p->>'scheduledStart'),'end',coalesce(p->>'end',p->>'scheduledEnd'),'cleaning',cleaning,'completed',completed,'evidenceComplete',proof,'validated',completed and proof and validated,'due',due,'fingerprint',finger,'autoPoints',case when cleaning then points else 0 end));
 end loop;
 return entry;
end $$;
create or replace function staff_cycle_report(person text,from_day date,to_day date,cutoff timestamp)
returns jsonb language plpgsql security definer set search_path=public as $$
declare items jsonb;total integer;done integer;clean integer;expected integer;earned integer;missing integer;
begin
 items:=staff_week_items(person,from_day,to_day,cutoff);
 select count(*),count(*) filter(where i->>'validated'='true') into total,done from jsonb_array_elements(items)i where i->>'due'='true';
 select count(*),coalesce(sum((i->>'autoPoints')::integer),0) into clean,earned from jsonb_array_elements(items)i where i->>'cleaning'='true' and i->>'due'='true';expected:=clean*2;
 select count(*) into missing from generate_series(from_day,least(to_day,cutoff::date-1),interval '1 day')d where not staff_is_rest(person,d::date) and not exists(select 1 from operation_day_plans where employee_number=person and day=d::date);
 return jsonb_build_object('start',from_day,'end',to_day,'total',total,'validated',done,'percent',case when total>0 then trunc(100.0*done/total,1) else null end,'cleaningTotal',clean,'cleaningExpected',expected,'cleaningEarned',earned,'missingPlanDays',missing,'items',items,'capturedAt',now());
end $$;
-- Cierra una sola vez los ciclos terminados. Nunca elimina el historial ni lo recalcula.
create or replace function staff_close_cycles(person text)
returns void language plpgsql security definer set search_path=public as $$
declare activation date;last_rest date;cycle_info jsonb;d date;today date:=(now() at time zone 'America/Mexico_City')::date;
begin
 perform pg_advisory_xact_lock(hashtext('staff-cycle-'||person));select activated_on into activation from staff_rest_settings where employee_number=person;
 if activation is null then return;end if;
 last_rest:=coalesce((select max(cycle_end) from staff_cycle_snapshots where employee_number=person),activation-1);
 for d in select a::date from generate_series(last_rest+1,today-1,interval '1 day')a where staff_is_rest(person,a::date) loop
  cycle_info:=staff_cycle(person,d);
  insert into staff_cycle_snapshots values(person,(cycle_info->>'start')::date,d,staff_cycle_report(person,(cycle_info->>'start')::date,d,(d+1)::timestamp-interval '1 microsecond')||jsonb_build_object('branch',work_branch(person,d)),now()) on conflict do nothing;
 end loop;
end $$;
-- Captura el plan de hoy para todos, incluso si aún no registraron entrada.
-- Nunca reconstruye días pasados con una configuración actual.
create or replace function staff_capture_today_plans()
returns void language plpgsql security definer set search_path=public as $$
declare person profiles;capture_day date:=(now() at time zone 'America/Mexico_City')::date;branch text;slots jsonb;routine jsonb;s jsonb;c jsonb;aliases jsonb;consumed jsonb;targeted boolean;weekday text;row_kind text;
begin
 perform pg_advisory_xact_lock(hashtext('staff-today-plans'));
 weekday:=(array['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'])[extract(dow from capture_day)::integer+1];
 for person in select * from profiles where active and display_name<>'Vacante' loop
  if staff_is_rest(person.employee_number,capture_day) or exists(select 1 from operation_day_plans where employee_number=person.employee_number and operation_day_plans.day=capture_day) then continue;end if;
  branch:=work_branch(person.employee_number,capture_day);slots:='[]';consumed:='[]';
  select coalesce(jsonb_agg(a),'[]') into routine from app_state st cross join lateral jsonb_array_elements(st.value)a where st.key='xoxo.activitySchedules' and (coalesce(a->>'branch','')='' or a->>'branch'=branch) and (not a?'weekdays' or a->'weekdays' @> to_jsonb(extract(dow from capture_day)::integer));
  targeted:=exists(select 1 from jsonb_array_elements(routine)a where coalesce(a->>'sharedRoutine','false')<>'true' and a->'employeeIds' ? person.employee_number);
  select coalesce(jsonb_agg(a),'[]') into routine from jsonb_array_elements(routine)a where
   (a->>'sharedRoutine'='true' and (case when jsonb_array_length(coalesce(a->'employeeIds','[]'))>0 then a->'employeeIds' ? person.employee_number else a->'ownerRoles' ? person.role end)) or
   (branch<>'Sucursal Centro' and coalesce(a->>'sharedRoutine','false')<>'true' and (case when targeted then a->'employeeIds' ? person.employee_number else jsonb_array_length(coalesce(a->'employeeIds','[]'))=0 and a->'ownerRoles' ? person.role end));
  if branch<>'Sucursal Centro' then
   for c in select a from app_state st cross join lateral jsonb_array_elements(st.value)a where st.key='xoxo.cleaningRole' and a->>'branch'=branch and exists(select 1 from regexp_split_to_table(coalesce(a#>>array['assignments',weekday],''),'/') n where lower(trim(n))=lower(person.display_name)) loop
    select coalesce(jsonb_agg('Actividad-'||(a->>'id')),'[]') into aliases from jsonb_array_elements(routine)a where not consumed ? (a->>'id') and ((a->>'id'='matriz-turno1-bloque2' and person.employee_number='010') or lower(a->>'area')='aseo' and ((coalesce(a->>'name','')||' '||coalesce(a->>'instructions',''))~*'aseo asignado|aseo de turno|rol de aseo' or (a->>'id' like 'aseo-bloque-%' and a->>'start'<c->>'end' and a->>'end'>c->>'start')));
    select consumed||coalesce(jsonb_agg(replace(a#>>'{}','Actividad-','')),'[]') into consumed from jsonb_array_elements(aliases)a;
    slots:=slots||jsonb_build_array(jsonb_build_object('key','Aseo-'||(c->>'activity'),'kind','Aseo','itemId',c->>'activity','title',c->>'activity','start',c->>'start','end',c->>'end','instructions',c->>'details','evidence','photo','slaMinutes',greatest(5,extract(epoch from ((c->>'end')::time-(c->>'start')::time))/60),'aliases',aliases));
   end loop;
  end if;
  for s in select a from jsonb_array_elements(routine)a where not consumed ? (a->>'id') loop
   slots:=slots||jsonb_build_array(jsonb_build_object('key','Actividad-'||(s->>'id'),'kind','Actividad','itemId',s->>'id','title',s->>'name','start',s->>'start','end',s->>'end','instructions',coalesce(s->>'objective','')||' '||coalesce(s->>'instructions',''),'evidence',case when lower(s->>'area') like '%aseo%' then 'photo' else coalesce(s->>'evidence','none') end,'slaMinutes',s->'durationMinutes'));
  end loop;
  -- No plan is invented if source configuration is unavailable.
  if jsonb_array_length(slots)>0 then insert into operation_day_plans(employee_number,day,branch,slots) values(person.employee_number,capture_day,branch,slots) on conflict do nothing;end if;
 end loop;
end $$;
create or replace function staff_permission_context(target_employee text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor text:=(current_profile()).employee_number;person text:=coalesce(target_employee,actor);info jsonb;report jsonb;requests jsonb;history jsonb;people jsonb;today date:=(now() at time zone 'America/Mexico_City')::date;
begin
 if actor is null then raise exception 'Sesión requerida';end if;
 if person<>actor and not staff_can_review(person) then raise exception 'Sin permiso para consultar este colaborador';end if;
 perform staff_capture_today_plans();perform staff_close_cycles(person);info:=staff_cycle(person,today);
 if info->>'configured'='true' then report:=staff_cycle_report(person,(info->>'start')::date,(info->>'end')::date,now() at time zone 'America/Mexico_City');end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by requested_at desc),'[]') into requests from (select * from staff_permission_requests where employee_number=actor or supervisor_id=actor or staff_can_review(employee_number) order by requested_at desc limit 150)r;
 select coalesce(jsonb_agg(to_jsonb(r) order by cycle_end desc),'[]') into history from (select * from staff_cycle_snapshots where employee_number=person order by cycle_end desc limit 26)r;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.employee_number,'name',p.display_name,'restDay',s.weekday) order by p.display_name),'[]') into people from profiles p left join staff_rest_settings s using(employee_number) where p.active and (p.employee_number=actor or staff_can_review(p.employee_number));
 return jsonb_build_object('employeeId',person,'cycle',info,'report',report,'history',history,'requests',requests,'people',people,'supervisorId',staff_supervisor(actor,today),'canReview',staff_can_review(person),'canConfigure',can_manage_all(),'clock',to_char(now() at time zone 'America/Mexico_City','HH24:MI'));
end $$;
create or replace function staff_activity_proof(person text,item_key text,expected_fingerprint text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare info jsonb;item jsonb;p jsonb;slot jsonb;record_day date;table_name text;source_id text;pictures jsonb;links jsonb;
begin
 if (current_profile()).employee_number is null or not ((current_profile()).employee_number=person or staff_can_review(person)) then raise exception 'Sin permiso para esta evidencia';end if;
 info:=staff_cycle(person,(now() at time zone 'America/Mexico_City')::date);
 select i into item from jsonb_array_elements(staff_week_items(person,(info->>'start')::date,(info->>'end')::date,now() at time zone 'America/Mexico_City'))i where i->>'key'=item_key;
 if item is null or item->>'fingerprint' is distinct from expected_fingerprint then raise exception 'La actividad cambió. Actualiza antes de revisar su evidencia';end if;
 source_id:=substring(item_key from position(':' in item_key)+1);
 case split_part(item_key,':',1)
 when 'task' then select payload into p from daily_task_records where record_id=source_id and employee_number=person;
 when 'run' then select payload into p from activity_run_records where record_id=source_id and employee_number=person;
 when 'process' then select payload into p from process_instance_records where record_id=source_id and employee_number=person;
 when 'centro' then select data into p from centro_operation_records where day=split_part(item_key,':',2)::date and task_id=substring(item_key from 19) and owner_id=person;
 when 'plan' then
  record_day:=split_part(item_key,':',2)::date;
  select a into slot from operation_day_plans d cross join lateral jsonb_array_elements(d.slots)a where d.employee_number=person and d.day=record_day and a->>'key'=substring(item_key from 17);
  select r.payload into p from activity_run_records r where employee_number=person and record_date=record_day and ((r.payload->>'itemType')||'-'||(r.payload->>'itemId')=slot->>'key' or coalesce(slot->'aliases','[]') ? ((r.payload->>'itemType')||'-'||(r.payload->>'itemId'))) and coalesce(r.payload->>'removedAt','')='' order by coalesce(r.payload->>'completedAt','') desc limit 1;
 else
  table_name:=split_part(item_key,':',1);
  if table_name not in('matriz_order_records','matriz_opening_step_records','work_readiness_records') then raise exception 'Fuente no disponible';end if;
  execute format('select payload from %I where record_id=$1 and employee_number=$2',table_name) into p using source_id,person;
 end case;
 select coalesce(jsonb_agg(jsonb_build_object('label',label,'dataUrl',data_url)),'[]') into pictures from (values('Antes',coalesce(p#>>'{beforeEvidenceCapture,dataUrl}',p->>'fotoAntes')),('Después',coalesce(p#>>'{afterEvidenceCapture,dataUrl}',p->>'fotoDespues')),('Evidencia',p#>>'{evidenceCapture,dataUrl}'),('Uniforme y herramientas',p->>'photo'))v(label,data_url) where data_url~'^data:image/(jpeg|png|webp);base64,';
 select coalesce(jsonb_agg(jsonb_build_object('label',key,'url',value)),'[]') into links from jsonb_each_text(coalesce(p,'{}')) where value~'^https?://';
 return jsonb_build_object('key',item_key,'fingerprint',expected_fingerprint,'title',item->>'title','pictures',pictures,'links',links,'notes',coalesce(p->>'deliveryNote',p->>'employeeComment',p->>'pendientes',p->>'notes',p->>'note',p->>'description',p->>'comment',''),'status',p->>'status','completedAt',p->>'completedAt');
end $$;
revoke all on function staff_activity_proof(text,text,text) from public,anon;grant execute on function staff_activity_proof(text,text,text) to authenticated;
create or replace function staff_review_activity(person text,item_key text,expected_fingerprint text,review_note text)
returns void language plpgsql security definer set search_path=public as $$
declare info jsonb;item jsonb;today date:=(now() at time zone 'America/Mexico_City')::date;
begin
 if not staff_can_review(person) then raise exception 'Sólo el superior puede validar; no se permite autovalidación';end if;
 perform staff_close_cycles(person);info:=staff_cycle(person,today);
 select i into item from jsonb_array_elements(staff_week_items(person,(info->>'start')::date,(info->>'end')::date,now() at time zone 'America/Mexico_City'))i where i->>'key'=item_key;
 if item is null or item->>'completed'<>'true' or item->>'evidenceComplete'<>'true' then raise exception 'Debe estar terminada y tener la evidencia requerida';end if;
 if item->>'fingerprint' is distinct from expected_fingerprint then raise exception 'La actividad cambió. Actualiza antes de validar';end if;
 if length(trim(review_note))<5 then raise exception 'Agrega una observación de validación';end if;
 insert into staff_weekly_reviews values(person,item_key,expected_fingerprint,(current_profile()).employee_number,trim(review_note),now()) on conflict on constraint staff_weekly_reviews_pkey do update set fingerprint=excluded.fingerprint,reviewer=excluded.reviewer,note=excluded.note,reviewed_at=excluded.reviewed_at;
end $$;
create or replace function staff_request_permission(request_kind text,request_day date,request_reason text,original_day date default null,request_token text default null)
returns text language plpgsql security definer set search_path=public as $$
declare actor profiles:=current_profile();boss text;info jsonb;report jsonb;id text;today date:=(now() at time zone 'America/Mexico_City')::date;
begin
 if actor.employee_number is null then raise exception 'Sesión requerida';end if;
 if request_token is null or length(request_token)>100 then raise exception 'Identificador de envío requerido';end if;
 select r.id into id from staff_permission_requests r where employee_number=actor.employee_number and client_token=request_token;if id is not null then return id;end if;
 if request_kind not in('Permiso','Cambio de descanso','Falta por urgencia','No regresar de comida') or request_day<today or request_day>today+60 then raise exception 'Selecciona el tipo y una fecha entre hoy y 60 días';end if;
 if length(trim(request_reason))<10 or length(request_reason)>2000 then raise exception 'Describe el motivo (10 a 2000 caracteres)';end if;
 boss:=staff_supervisor(actor.employee_number,today);if boss is null then raise exception 'Configura un superior activo antes de enviar';end if;
 perform staff_close_cycles(actor.employee_number);info:=staff_cycle(actor.employee_number,today);
 if request_kind='Cambio de descanso' and (original_day is null or original_day<today or not staff_is_rest(actor.employee_number,original_day) or abs(request_day-original_day)>6 or staff_is_rest(actor.employee_number,request_day)) then raise exception 'Selecciona tu descanso vigente y un nuevo día distinto a máximo 6 días';end if;
 if info->>'configured'='true' then report:=staff_cycle_report(actor.employee_number,(info->>'start')::date,(info->>'end')::date,now() at time zone 'America/Mexico_City');else report:=jsonb_build_object('unconfigured',true);end if;
 insert into staff_permission_requests(employee_number,supervisor_id,branch,kind,target_day,original_rest_day,reason,compliance,client_token) values(actor.employee_number,boss,work_branch(actor.employee_number,today),request_kind,request_day,original_day,trim(request_reason),report,request_token) returning staff_permission_requests.id into id;return id;
end $$;
create or replace function staff_respond_permission(request_id text,approve boolean,response_note text,expected_version integer)
returns void language plpgsql security definer set search_path=public as $$
declare r staff_permission_requests;info jsonb;report jsonb;actor text:=(current_profile()).employee_number;today date:=(now() at time zone 'America/Mexico_City')::date;
begin
 if actor is null then raise exception 'Sesión requerida';end if;
 select * into r from staff_permission_requests where id=request_id for update;
 if r.id is null or actor=r.employee_number or (actor<>r.supervisor_id and not staff_can_review(r.employee_number)) then raise exception 'Sólo el superior autorizado puede responder';end if;
 if r.status<>'Pendiente' or r.version<>expected_version then raise exception 'La solicitud ya cambió en otra sesión';end if;
 if length(trim(response_note))<10 then raise exception 'Explica la decisión (mínimo 10 caracteres), incluyendo la excepción si no cumple 80%%';end if;
 if approve and r.target_day<today then raise exception 'No se autorizan cambios retroactivos';end if;
 perform staff_close_cycles(r.employee_number);info:=staff_cycle(r.employee_number,today);
 if info->>'configured'='true' then report:=staff_cycle_report(r.employee_number,(info->>'start')::date,(info->>'end')::date,now() at time zone 'America/Mexico_City');end if;
 if approve and r.kind='Cambio de descanso' then
  perform pg_advisory_xact_lock(hashtext('staff-cycle-'||r.employee_number));
  if r.original_rest_day<today or not staff_is_rest(r.employee_number,r.original_rest_day) or staff_is_rest(r.employee_number,r.target_day) or exists(select 1 from staff_rest_exceptions where employee_number=r.employee_number and day in(r.original_rest_day,r.target_day)) then raise exception 'El descanso cambió o ya tiene una excepción autorizada. Revisa las fechas';end if;
  insert into staff_rest_exceptions values(r.employee_number,r.original_rest_day,false,r.id),(r.employee_number,r.target_day,true,r.id);
 end if;
 update staff_permission_requests set status=case when approve then 'Autorizada' else 'Rechazada' end,response=trim(response_note),responded_at=now(),responded_by=actor,decision_compliance=report,version=version+1 where id=r.id;
end $$;
create or replace function staff_cleaning_scoreboard(from_day date,to_day date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare rows jsonb:='[]';r record;report jsonb;cycle_info jsonb;weekly jsonb;
begin
 if not can_view_cleaning_board() then raise exception 'Sin permiso para el marcador de aseo';end if;
 perform staff_capture_today_plans();
 if from_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Selecciona hasta 63 días';end if;
 for r in select p.employee_number,p.display_name from profiles p where active and (can_manage_all() or work_branch(p.employee_number,(now() at time zone 'America/Mexico_City')::date)=(current_profile()).branch) loop
  report:=staff_cycle_report(r.employee_number,from_day,least(to_day,(now() at time zone 'America/Mexico_City')::date),now() at time zone 'America/Mexico_City');
  perform staff_close_cycles(r.employee_number);cycle_info:=staff_cycle(r.employee_number,(now() at time zone 'America/Mexico_City')::date);weekly:=null;
  if cycle_info->>'configured'='true' then weekly:=staff_cycle_report(r.employee_number,(cycle_info->>'start')::date,(cycle_info->>'end')::date,now() at time zone 'America/Mexico_City');end if;
  if (report->>'cleaningTotal')::integer>0 or cycle_info->>'configured'='true' then rows:=rows||jsonb_build_array(jsonb_build_object('employeeId',r.employee_number,'name',r.display_name,'report',report-'items','cycle',cycle_info,'weekly',weekly-'items'));end if;
 end loop;return rows;
end $$;
-- Conserva el cierre anterior antes de cambiar evidencia fuente después del descanso.
create or replace function staff_close_before_source_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare person text;
begin
 if TG_TABLE_NAME='centro_operation_records' then
  if TG_OP<>'INSERT' then perform staff_close_cycles(old.owner_id);end if;
  if TG_OP<>'DELETE' then perform staff_close_cycles(new.owner_id);end if;
 else
  if TG_OP<>'INSERT' then perform staff_close_cycles(old.employee_number);end if;
  if TG_OP<>'DELETE' then perform staff_close_cycles(new.employee_number);end if;
 end if;
 if TG_OP='DELETE' then return old;end if;return new;
end $$;
do $$declare t text;begin
 foreach t in array array['operation_day_plans','activity_run_records','daily_task_records','process_instance_records','centro_operation_records','matriz_order_records','matriz_opening_step_records','work_readiness_records'] loop
  if to_regclass('public.'||t) is not null then execute format('drop trigger if exists staff_freeze_previous_cycles on %I',t);execute format('create trigger staff_freeze_previous_cycles before insert or update or delete on %I for each row execute function staff_close_before_source_change()',t);end if;
 end loop;
end $$;
-- Sólo lectura directa; todas las mutaciones pasan por RPCs verificados.
alter table staff_rest_settings enable row level security;alter table staff_rest_exceptions enable row level security;alter table staff_weekly_reviews enable row level security;alter table staff_cycle_snapshots enable row level security;alter table staff_permission_requests enable row level security;
revoke all on staff_rest_settings,staff_rest_exceptions,staff_weekly_reviews,staff_cycle_snapshots,staff_permission_requests from public,anon,authenticated;
grant select on staff_rest_settings,staff_rest_exceptions,staff_cycle_snapshots,staff_permission_requests to authenticated;
drop policy if exists staff_rest_read on staff_rest_settings;create policy staff_rest_read on staff_rest_settings for select to authenticated using(employee_number=(current_profile()).employee_number or staff_can_review(employee_number));
drop policy if exists staff_exception_read on staff_rest_exceptions;create policy staff_exception_read on staff_rest_exceptions for select to authenticated using(employee_number=(current_profile()).employee_number or staff_can_review(employee_number));
drop policy if exists staff_cycle_read on staff_cycle_snapshots;create policy staff_cycle_read on staff_cycle_snapshots for select to authenticated using(employee_number=(current_profile()).employee_number or staff_can_review(employee_number));
drop policy if exists staff_request_read on staff_permission_requests;create policy staff_request_read on staff_permission_requests for select to authenticated using(employee_number=(current_profile()).employee_number or supervisor_id=(current_profile()).employee_number or staff_can_review(employee_number));
create or replace function staff_permission_metrics(from_day date,to_day date)
returns jsonb language plpgsql security invoker set search_path=public as $$
begin
 if (current_profile()).employee_number is null then raise exception 'Sesión requerida';end if;
 if from_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Selecciona hasta 63 días';end if;
 return jsonb_build_object('staff_permission_records',jsonb_build_object('available',true,'rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'employeeId',employee_number,'branch',branch,'date',target_day,'status',status,'createdAt',requested_at,'completedAt',responded_at)) from staff_permission_requests where target_day between from_day and to_day),'[]')),'staff_cycle_records',jsonb_build_object('available',true,'rows',coalesce((select jsonb_agg(jsonb_build_object('id',employee_number||'-'||cycle_start,'employeeId',employee_number,'date',cycle_end,'branch',payload->>'branch','validated',payload->'validated','total',payload->'total','percent',payload->'percent','cleaningExpected',payload->'cleaningExpected','cleaningEarned',payload->'cleaningEarned','missingPlanDays',payload->'missingPlanDays')) from staff_cycle_snapshots where cycle_end between from_day and to_day),'[]')));
end $$;
revoke all on function staff_permission_metrics(date,date) from public,anon;grant execute on function staff_permission_metrics(date,date) to authenticated;
-- Internal adapters are never exposed to clients.
revoke all on function staff_role_rank(text),staff_supervisor(text,date),staff_is_rest(text,date),staff_cycle(text,date),staff_week_items(text,date,date,timestamp),staff_cycle_report(text,date,date,timestamp),staff_close_cycles(text),staff_capture_today_plans(),staff_close_before_source_change() from public,anon,authenticated;
revoke all on function staff_can_review(text) from public,anon;grant execute on function staff_can_review(text) to authenticated;
revoke all on function staff_permission_context(text),staff_review_activity(text,text,text,text),staff_request_permission(text,date,text,date,text),staff_respond_permission(text,boolean,text,integer),staff_cleaning_scoreboard(date,date) from public,anon;
grant execute on function staff_permission_context(text),staff_review_activity(text,text,text,text),staff_request_permission(text,date,text,date,text),staff_respond_permission(text,boolean,text,integer),staff_cleaning_scoreboard(date,date) to authenticated;
notify pgrst,'reload schema';commit;
