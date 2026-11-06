-- Equipo de apertura exclusivo de Matriz. Conserva aperturas previas y el flujo de Centro.
begin;
create table if not exists public.matriz_opening_config (
 id boolean primary key default true check(id), activated_on date not null default (now() at time zone 'America/Mexico_City')::date,
 owners jsonb not null, version integer not null default 1, history jsonb not null default '[]'
);
insert into matriz_opening_config(id,owners) values(true,'{"entrance":"009","computers":"008","authorization":"009","shutters":"006"}') on conflict do nothing;
create table if not exists public.matriz_opening_step_records (
 record_id text primary key,employee_number text not null,branch text not null default 'Matriz' check(branch='Matriz'),record_date date not null,
 payload jsonb not null,version integer not null default 0,updated_at timestamptz not null default now()
);
alter table matriz_opening_config enable row level security;
alter table matriz_opening_step_records enable row level security;
revoke all on matriz_opening_config,matriz_opening_step_records from public,anon,authenticated;
grant select on matriz_opening_step_records to authenticated;
drop policy if exists opening_team_read on matriz_opening_step_records;
create policy opening_team_read on matriz_opening_step_records for select to authenticated using(employee_number=(current_profile()).employee_number or can_manage_branch('Matriz'));

create or replace function public.matriz_opening_specs()
returns jsonb language sql immutable set search_path=public as $$ select '[
 {"step":"entrance","title":"Abrir puertas de entrada","start":"07:45","end":"08:00","description":"Abrir las puertas de entrada de Matriz y confirmar su condición segura."},
 {"step":"authorization","title":"Autorizar apertura de cortinas y portón","start":"07:45","end":"08:00","description":"Revisar las condiciones de seguridad y dar autorización expresa a quien abrirá cortinas y portón. Siempre inicia pendiente cada día."},
 {"step":"computers","title":"Encender equipos y abrir ERP Visorus","start":"08:00","end":"08:05","description":"Encender todos los equipos de cómputo de Matriz y abrir el sistema ERP Visorus en los equipos correspondientes."},
 {"step":"shutters","title":"Abrir cortinas y portón","start":"08:00","end":"08:10","description":"Esperar la autorización expresa del encargado y después abrir las cortinas y el portón de Matriz."}
 ]'::jsonb $$;

create or replace function public.matriz_opening_reconcile(day date)
returns void language plpgsql security definer set search_path=public as $$
declare conf matriz_opening_config; spec jsonb; official jsonb; owner text;
begin
 perform pg_advisory_xact_lock(hashtext('matriz-opening-team'));
 select * into conf from matriz_opening_config where id;
 if day<>(now() at time zone 'America/Mexico_City')::date or day<conf.activated_on then return; end if;
 select entry.value into official from app_state s cross join lateral jsonb_array_elements(s.value) entry where s.key='xoxo.storeOpeningChecks' and entry.value->>'id'=day::text||'-Matriz';
 if coalesce(official->>'openedAt','')<>'' and not exists(select 1 from matriz_opening_step_records where record_date=day) then return;end if;
 for spec in select value from jsonb_array_elements(matriz_opening_specs()) loop
  owner:=conf.owners->>(spec->>'step');
  insert into matriz_opening_step_records(record_id,employee_number,record_date,payload) values(day::text||'-'||(spec->>'step'),owner,day,
   spec||jsonb_build_object('id',day::text||'-'||(spec->>'step'),'employeeId',owner,'branch','Matriz','date',day,'status','Pendiente','evidence','none','configVersion',conf.version,'assignmentHistory','[]'::jsonb)) on conflict do nothing;
  update matriz_opening_step_records r set employee_number=owner,version=version+1,updated_at=now(),payload=payload||jsonb_build_object('employeeId',owner,'configVersion',conf.version,'assignmentHistory',coalesce(payload->'assignmentHistory','[]')||jsonb_build_array(jsonb_build_object('at',now(),'from',employee_number,'to',owner)))
   where record_id=day::text||'-'||(spec->>'step') and payload->>'status'<>'Completada' and employee_number<>owner;
 end loop;
end $$;

create or replace function public.matriz_opening_context(day date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor profiles; conf matriz_opening_config; rows jsonb; official jsonb; candidates jsonb; applicable boolean;
begin
 actor:=current_profile();if actor.employee_number is null then raise exception 'Sesión requerida';end if;
 if day is null or day<>(now() at time zone 'America/Mexico_City')::date then raise exception 'Consulta la jornada actual';end if;
 applicable:=can_manage_all() or work_branch(actor.employee_number,day)='Matriz';
 if not applicable then return jsonb_build_object('applicable',false,'steps','[]'::jsonb);end if;
 perform matriz_opening_reconcile(day);select * into conf from matriz_opening_config where id;
 select entry.value into official from app_state s cross join lateral jsonb_array_elements(s.value) entry where s.key='xoxo.storeOpeningChecks' and entry.value->>'id'=day::text||'-Matriz';
 select coalesce(jsonb_agg(payload||jsonb_build_object('version',version,'ownerName',coalesce(p.display_name,r.employee_number),'ownerAvailable',coalesce(p.active,false) and work_branch(r.employee_number,day)='Matriz') order by array_position(array['entrance','authorization','computers','shutters'],payload->>'step')),'[]') into rows from matriz_opening_step_records r left join profiles p on p.employee_number=r.employee_number where record_date=day;
 if jsonb_array_length(rows)=0 then select jsonb_agg(spec||jsonb_build_object('id',day::text||'-'||(spec->>'step'),'employeeId',conf.owners->>(spec->>'step'),'ownerName',(select display_name from profiles where employee_number=conf.owners->>(spec->>'step')),'status','Pendiente','version',0,'preview',true)) into rows from jsonb_array_elements(matriz_opening_specs())spec;end if;
 if can_manage_branch('Matriz') then select coalesce(jsonb_agg(jsonb_build_object('id',employee_number,'name',display_name) order by display_name),'[]') into candidates from profiles where active and display_name<>'Vacante' and work_branch(employee_number,day)='Matriz';else candidates:='[]';end if;
 return jsonb_build_object('applicable',true,'required',exists(select 1 from matriz_opening_step_records where record_date=day),'legacyOpened',coalesce(official->>'openedAt','')<>'' and not exists(select 1 from matriz_opening_step_records where record_date=day),
 'steps',rows,'owners',conf.owners,'configVersion',conf.version,'canConfigure',can_manage_branch('Matriz'),'candidates',candidates,'opening',official,'clock',to_char(now() at time zone 'America/Mexico_City','HH24:MI'));
end $$;

create or replace function public.save_matriz_opening_owners(owners jsonb,expected_version integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor profiles; conf matriz_opening_config; spec jsonb; person text; day date:=(now() at time zone 'America/Mexico_City')::date;
begin
 actor:=current_profile();if actor.employee_number is null or not can_manage_branch('Matriz') then raise exception 'Sólo gerencia de Matriz o dirección puede cambiar los encargados';end if;
 perform pg_advisory_xact_lock(hashtext('matriz-opening-team'));select * into conf from matriz_opening_config where id for update;
 if conf.version<>expected_version then raise exception 'La configuración cambió en otra sesión. Actualiza antes de guardar';end if;
 if jsonb_typeof(owners) is distinct from 'object' or (select count(*) from jsonb_object_keys(owners))<>4 then raise exception 'Asigna los cuatro encargados';end if;
 for spec in select value from jsonb_array_elements(matriz_opening_specs()) loop
  person:=owners->>(spec->>'step');
  if not exists(select 1 from profiles where active and employee_number=person and work_branch(person,day)='Matriz') then raise exception 'El encargado debe tener acceso activo y estar asignado a Matriz';end if;
 end loop;
 update matriz_opening_config set owners=save_matriz_opening_owners.owners,version=version+1,history=history||jsonb_build_array(jsonb_build_object('at',now(),'actor',actor.employee_number,'owners',save_matriz_opening_owners.owners)) where id;
 return matriz_opening_context(day);
end $$;

create or replace function public.mark_matriz_opening_step(step_id text,expected_version integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor profiles; day date:=(now() at time zone 'America/Mexico_City')::date; r matriz_opening_step_records; clock text:=to_char(now() at time zone 'America/Mexico_City','HH24:MI'); saved jsonb; official jsonb; patch jsonb:='{}';
begin
 actor:=current_profile();if actor.employee_number is null or work_branch(actor.employee_number,day)<>'Matriz' then raise exception 'Debes estar asignado a Matriz';end if;
 perform matriz_opening_reconcile(day);
 select * into r from matriz_opening_step_records where record_id=day::text||'-'||step_id for update;
 if r.record_id is null then raise exception 'No hay un paso de apertura pendiente para hoy';end if;
 if r.employee_number<>actor.employee_number then raise exception 'Sólo el encargado asignado puede marcar este paso';end if;
 if r.payload->>'status'='Completada' then return matriz_opening_context(day);end if;
 if r.version<>expected_version then raise exception 'El paso cambió en otra sesión. Actualiza antes de marcarlo';end if;
 if clock<r.payload->>'start' then raise exception 'Todavía no inicia el horario de esta actividad';end if;
 if step_id='shutters' and not exists(select 1 from matriz_opening_step_records where record_date=day and payload->>'step'='authorization' and payload->>'status'='Completada') then raise exception 'Pendiente de autorización para abrir cortinas y portón';end if;
 update matriz_opening_step_records set version=version+1,updated_at=now(),payload=payload||jsonb_build_object('status','Completada','completedAt',now(),'completedById',actor.employee_number,'completedByName',actor.display_name,'onTime',clock<=payload->>'end') where record_id=r.record_id;
 if step_id='authorization' then patch:=jsonb_build_object('managerAuthorizedAt',now(),'managerAuthorizedById',actor.employee_number);end if;
 if step_id='computers' then patch:=jsonb_build_object('erpReady',true,'systemsReady',true,'computersReadyAt',now(),'computersReadyById',actor.employee_number);end if;
 if step_id='shutters' then patch:=jsonb_build_object('doorsOpenedAt',now(),'doorsOpenedById',actor.employee_number);end if;
 insert into app_state(key,value,updated_by) values('xoxo.storeOpeningChecks','[]',auth.uid()) on conflict do nothing;
 select value into saved from app_state where key='xoxo.storeOpeningChecks' for update;
 select value into official from jsonb_array_elements(saved) where value->>'id'=day::text||'-Matriz';
 official:=coalesce(official,jsonb_build_object('id',day::text||'-Matriz','date',day,'branch','Matriz','minimumStaff',false,'systemsReady',false,'processComplete',false))||patch;
 select coalesce(jsonb_agg(value),'[]') into saved from jsonb_array_elements(saved) where value->>'id'<>day::text||'-Matriz';
 update app_state set value=saved||jsonb_build_array(official),updated_by=auth.uid(),updated_at=now() where key='xoxo.storeOpeningChecks';
 return matriz_opening_context(day);
end $$;

-- Mantiene el RPC compartido; bloquea la confirmación final de Matriz desde clientes antiguos.
create or replace function public.patch_store_opening_checks(records jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare actor profiles; saved jsonb; item jsonb; existing jsonb; before_patch jsonb; conf matriz_opening_config; team_required boolean; auth_step jsonb; pc_step jsonb; doors_step jsonb;
begin
 actor:=current_profile();if auth.uid() is null or actor.employee_number is null then raise exception 'Sesión no autorizada';end if;
 if jsonb_typeof(records) is distinct from 'array' then raise exception 'Se requiere una lista de cambios';end if;
 perform pg_advisory_xact_lock(hashtext('matriz-opening-team'));select * into conf from matriz_opening_config where id;
 insert into app_state(key,value,updated_by) values('xoxo.storeOpeningChecks','[]',auth.uid()) on conflict do nothing;
 select value into saved from app_state where key='xoxo.storeOpeningChecks' for update;
 for item in select value from jsonb_array_elements(records) loop
  if coalesce(item->>'branch','') not in ('Matriz','Sucursal Centro') or coalesce(item->>'date','')='' or item->>'id' is distinct from (item->>'date')||'-'||(item->>'branch') then raise exception 'Identificador de apertura inválido';end if;
  if not can_manage_all() and actor.branch is distinct from item->>'branch' then raise exception 'Sin permiso para esta sucursal';end if;
  select value into before_patch from jsonb_array_elements(saved) where value->>'id'=item->>'id';
  existing:=coalesce(before_patch,jsonb_build_object('minimumStaff',false,'systemsReady',false,'processComplete',false))||item;
  team_required:=item->>'branch'='Matriz' and (item->>'date')::date>=conf.activated_on and (coalesce(before_patch->>'openedAt','')='' or exists(select 1 from matriz_opening_step_records where record_date=(item->>'date')::date));
  if team_required then
   select payload into auth_step from matriz_opening_step_records where record_date=(item->>'date')::date and payload->>'step'='authorization' and payload->>'status'='Completada';
   select payload into pc_step from matriz_opening_step_records where record_date=(item->>'date')::date and payload->>'step'='computers' and payload->>'status'='Completada';
   select payload into doors_step from matriz_opening_step_records where record_date=(item->>'date')::date and payload->>'step'='shutters' and payload->>'status'='Completada';
   existing:=existing||jsonb_build_object('managerAuthorizedAt',auth_step->>'completedAt','managerAuthorizedById',auth_step->>'completedById','erpReady',pc_step is not null,'systemsReady',pc_step is not null,'doorsOpenedAt',doors_step->>'completedAt','doorsOpenedById',doors_step->>'completedById');
   if coalesce(item->>'openedAt','')<>'' and coalesce(before_patch->>'openedAt','')='' then
    if (select count(*) from matriz_opening_step_records where record_date=(item->>'date')::date and payload->>'status'='Completada')<>4 then raise exception 'Primero deben marcar su parte todos los encargados de apertura de Matriz';end if;
    if not can_manage_branch('Matriz') then raise exception 'Gerencia debe confirmar la apertura al público';end if;
    if not coalesce((existing->>'minimumStaff')::boolean,false) or not coalesce((existing->>'processComplete')::boolean,false) or coalesce(existing->>'cashOpenConfirmedAt','')='' then raise exception 'Falta validar personal, seguridad o caja antes de abrir al público';end if;
    existing:=existing||jsonb_build_object('openedAt',now(),'openedById',actor.employee_number);
   end if;
  end if;
  if item->>'branch'='Matriz' and coalesce(before_patch->>'openedAt','')<>'' then existing:=existing||jsonb_build_object('openedAt',before_patch->'openedAt','openedById',before_patch->'openedById');end if;
  select coalesce(jsonb_agg(value),'[]') into saved from jsonb_array_elements(saved) where value->>'id' is distinct from item->>'id';saved:=saved||jsonb_build_array(existing);
 end loop;
 update app_state set value=saved,updated_by=auth.uid(),updated_at=now() where key='xoxo.storeOpeningChecks';
end $$;

create or replace function public.matriz_opening_evidence(from_day date,to_day date)
returns jsonb language plpgsql security invoker set search_path=public as $$
begin
 if (current_profile()).employee_number is null then raise exception 'Sesión requerida';end if;
 if from_day is null or to_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Selecciona hasta 63 días';end if;
 return coalesce((select jsonb_agg(payload||jsonb_build_object('id',record_id,'employeeId',employee_number,'date',record_date,'branch','Matriz','kind','Proceso','scheduled',(payload->>'start')||'-'||(payload->>'end'),'recordProof',true,'requiresEvidence',false,'comment','Responsable: '||coalesce(payload->>'completedByName',employee_number))) from matriz_opening_step_records where record_date between from_day and to_day),'[]');
end $$;
revoke all on function public.matriz_opening_specs(),public.matriz_opening_reconcile(date) from public,anon,authenticated;
revoke all on function public.matriz_opening_context(date),public.save_matriz_opening_owners(jsonb,integer),public.mark_matriz_opening_step(text,integer),public.patch_store_opening_checks(jsonb),public.matriz_opening_evidence(date,date) from public,anon;
grant execute on function public.matriz_opening_context(date),public.save_matriz_opening_owners(jsonb,integer),public.mark_matriz_opening_step(text,integer),public.patch_store_opening_checks(jsonb),public.matriz_opening_evidence(date,date) to authenticated;
commit;
