-- Operación diaria Centro. Ejecutar después de supabase-stage2-modules.sql.
-- Migración aditiva: no borra registros ni modifica los procesos de apertura existentes.
begin;

create table if not exists public.centro_task_templates (
  task_id text primary key,
  definition jsonb not null
);
create table if not exists public.centro_operation_records (
  day date not null,
  task_id text not null references public.centro_task_templates(task_id),
  owner_id text not null,
  status text not null default 'Pendiente' check (status in ('Pendiente','En curso','Pausada','Por validar','Validada','Corrección')),
  version integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(day, task_id)
);
alter table public.centro_task_templates enable row level security;
alter table public.centro_operation_records enable row level security;
revoke all on public.centro_task_templates, public.centro_operation_records from public, anon, authenticated;

create or replace function public.centro_is_supervisor()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where user_id=auth.uid() and active and
    (employee_number='003' or role in ('APODERADA_LEGAL','DIRECTOR','GERENTE_GENERAL','ADMIN_GENERAL')))
$$;

create or replace function public.centro_roster(target_day date)
returns jsonb language sql stable security definer set search_path=public as $$
  with people as (
    select p.*, coalesce(c.item->>'name', p.display_name) as person_name,
      coalesce(c.item->>'roleLabel',p.role) as role_label,
      coalesce(w.item->>'start',s.item->>'start','08:50') as starts,
      coalesce(w.item->>'end',s.item->>'end','18:00') as ends,
      a.payload as attendance
    from public.profiles p
    left join lateral (select value item from jsonb_array_elements(coalesce((select value from public.app_state where key='xoxo.collaborators'),'[]'::jsonb)) where value->>'id'=p.employee_number limit 1) c on true
    left join lateral (select value item from jsonb_array_elements(coalesce((select value from public.app_state where key='xoxo.workLocations'),'[]'::jsonb)) where value->>'employeeId'=p.employee_number and value->>'date'=target_day::text limit 1) w on true
    left join lateral (select value item from jsonb_array_elements(coalesce((select value from public.app_state where key='xoxo.shiftConfigs'),'[]'::jsonb)) where value->>'key'=c.item->>'shift' limit 1) s on true
    left join lateral (select payload from public.attendance_records where payload->>'employeeId'=p.employee_number and payload->>'date'=target_day::text limit 1) a on true
    where p.active and coalesce(w.item->>'location',p.branch)='Sucursal Centro'
      and coalesce(c.item->>'name',p.display_name)<>'Vacante'
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',employee_number,'name',person_name,'role',role,'roleLabel',role_label,
    'start',starts,'end',ends,'arrived',coalesce(attendance->>'in','')<>'',
    'present',target_day=(now() at time zone 'America/Mexico_City')::date
      and coalesce(attendance->>'in','')<>'' and coalesce(attendance->>'out','')=''
      and (coalesce(attendance->>'lunchOut','')='' or coalesce(attendance->>'lunchIn','')>coalesce(attendance->>'lunchOut',''))
      and to_char(now() at time zone 'America/Mexico_City','HH24:MI')>=starts
      and to_char(now() at time zone 'America/Mexico_City','HH24:MI')<ends
  ) order by employee_number),'[]'::jsonb) from people
$$;

create or replace function public.centro_reconcile_day(target_day date)
returns void language plpgsql security definer set search_path=public as $$
declare roster jsonb; present_count integer;
begin
  if target_day<>(now() at time zone 'America/Mexico_City')::date then return; end if;
  perform pg_advisory_xact_lock(hashtext('centro-'||target_day::text));
  roster:=public.centro_roster(target_day);
  select count(*) into present_count from jsonb_array_elements(roster) where (value->>'present')::boolean;
  update public.centro_operation_records r set status='Pausada',version=version+1,updated_at=now(),
    data=case when data->>'mode'='Exterior' then data||'{"mode":"Digital / interior"}'::jsonb else data end,
    history=history||jsonb_build_array(jsonb_build_object('at',now(),'actor','sistema','action','pause','note',case when data->>'mode'='Exterior' then 'Seguridad: cambió la cobertura; regresar a tienda y continuar dentro' else 'Cambio de disponibilidad; avance conservado para reasignación' end))
    where day=target_day and status='En curso' and ((data->>'mode'='Exterior' and present_count<2)
      or not exists(select 1 from jsonb_array_elements(roster) p where p->>'id'=r.owner_id and (p->>'present')::boolean));
end $$;

create or replace function public.centro_context(target_day date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare roster jsonb; actor text;
begin
  select employee_number into actor from public.profiles where user_id=auth.uid() and active;
  if actor is null then raise exception 'Sesión no autorizada'; end if;
  roster := public.centro_roster(target_day);
  if not public.centro_is_supervisor() and not exists(select 1 from jsonb_array_elements(roster) where value->>'id'=actor) then
    raise exception 'No estás asignado a Centro en este día';
  end if;
  perform public.centro_reconcile_day(target_day);
  return jsonb_build_object('roster',roster,
    'records',coalesce((select jsonb_agg(to_jsonb(r) order by task_id) from public.centro_operation_records r where day=target_day),'[]'::jsonb),
    'previous',coalesce((select jsonb_agg(to_jsonb(r) order by day desc,task_id) from public.centro_operation_records r where day<target_day and (day>=target_day-7 or (task_id='exhibicion' and status='Validada'))),'[]'::jsonb));
end $$;

-- An assignment is a privileged operation, including when written through legacy screens.
drop policy if exists centro_protect_assignments on public.app_state;
create policy centro_protect_assignments on public.app_state as restrictive for all to authenticated
  using (true)
  with check (key not in ('xoxo.workLocations','xoxo.shiftConfigs','xoxo.collaborators') or public.centro_is_supervisor() or exists(select 1 from public.profiles where user_id=auth.uid() and active and employee_number='005'));
drop policy if exists centro_protect_assignment_deletion on public.app_state;
create policy centro_protect_assignment_deletion on public.app_state as restrictive for delete to authenticated
  using (key not in ('xoxo.workLocations','xoxo.shiftConfigs','xoxo.collaborators') or public.centro_is_supervisor() or exists(select 1 from public.profiles where user_id=auth.uid() and active and employee_number='005'));

create or replace function public.centro_assign_day(employee_id text, target_day date, target_location text, shift_start text, shift_end text)
returns void language plpgsql security definer set search_path=public as $$
declare actor text; entries jsonb;
begin
  if not public.centro_is_supervisor() then raise exception 'Solo dirección y 003 pueden asignar personal'; end if;
  select employee_number into actor from public.profiles where user_id=auth.uid() and active;
  if target_day<(now() at time zone 'America/Mexico_City')::date then raise exception 'No se puede cambiar una asignación histórica'; end if;
  if target_location not in ('Matriz','Sucursal Centro') or shift_start!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or shift_end!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or shift_start>=shift_end then raise exception 'Sucursal u horario inválido'; end if;
  if not exists(select 1 from public.profiles where employee_number=employee_id and active) then raise exception 'Colaborador sin perfil activo'; end if;
  perform pg_advisory_xact_lock(hashtext('centro-assignments'));
  select value into entries from public.app_state where key='xoxo.workLocations' for update;
  select coalesce(jsonb_agg(value),'[]'::jsonb) into entries from jsonb_array_elements(coalesce(entries,'[]'::jsonb))
    where not (value->>'employeeId'=employee_id and value->>'date'=target_day::text);
  entries:=entries||jsonb_build_array(jsonb_build_object('id',target_day::text||'-'||employee_id,'employeeId',employee_id,'date',target_day::text,'location',target_location,'start',shift_start,'end',shift_end,'assignedById',actor));
  insert into public.app_state(key,value,updated_by) values('xoxo.workLocations',entries,auth.uid())
    on conflict(key) do update set value=excluded.value,updated_at=now(),updated_by=auth.uid();
end $$;

create or replace function public.centro_update_task(target_day date, target_task text, expected_version integer, task_action text, task_data jsonb, action_note text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  actor text; roster jsonb; me jsonb; rec public.centro_operation_records; spec jsonb; field jsonb;
  item jsonb; other_codes text[]; code_count integer; distinct_codes integer; present_count integer;
  new_status text; mode text; opening jsonb; old_owner text;
begin
  select employee_number into actor from public.profiles where user_id=auth.uid() and active;
  if actor is null then raise exception 'Sesión no autorizada'; end if;
  if task_action not in ('start','save','pause','resume','submit','approve','reject') then raise exception 'Acción no permitida'; end if;
  select definition into spec from public.centro_task_templates where task_id=target_task;
  if spec is null then raise exception 'Actividad no reconocida'; end if;
  if jsonb_typeof(task_data)<>'object' or octet_length(task_data::text)>250000 then raise exception 'Captura inválida o demasiado grande'; end if;
  perform pg_advisory_xact_lock(hashtext('centro-'||target_day::text));
  roster:=public.centro_roster(target_day);
  select value into me from jsonb_array_elements(roster) where value->>'id'=actor;
  select count(*) into present_count from jsonb_array_elements(roster) where (value->>'present')::boolean;
  if task_action in ('approve','reject') then
    if not public.centro_is_supervisor() then raise exception 'Solo dirección y 003 pueden validar o rechazar'; end if;
  else
    if target_day<>(now() at time zone 'America/Mexico_City')::date or me is null or not (me->>'present')::boolean then raise exception 'Debes estar presente, dentro de turno y asignado a Centro hoy'; end if;
    if (me->>'start'>=spec->>'end' or me->>'end'<=spec->>'start') and to_char(now() at time zone 'America/Mexico_City','HH24:MI')<spec->>'end' then raise exception 'La actividad no coincide con tu horario'; end if;
  end if;
  insert into public.centro_operation_records(day,task_id,owner_id) values(target_day,target_task,actor) on conflict do nothing;
  select * into rec from public.centro_operation_records where day=target_day and task_id=target_task for update;
  if rec.version<>expected_version then raise exception 'Otro usuario actualizó esta actividad. Actualiza la agenda antes de guardar para no sobrescribir sus cambios.'; end if;
  old_owner:=rec.owner_id;
  new_status:=rec.status;
  if task_action in ('approve','reject') then
    if rec.status<>'Por validar' then raise exception 'La actividad no está pendiente de validación'; end if;
    if task_action='approve' and rec.owner_id=actor then raise exception 'Otro supervisor debe validar tu actividad'; end if;
    if task_action='reject' and length(trim(action_note))<3 then raise exception 'Indica el motivo de rechazo'; end if;
    task_data:=rec.data;
    new_status:=case task_action when 'approve' then 'Validada' else 'Corrección' end;
  else
    if rec.status in ('Por validar','Validada') then raise exception 'La captura está cerrada; requiere devolución del supervisor'; end if;
    if rec.owner_id<>actor and exists(select 1 from jsonb_array_elements(roster) where value->>'id'=rec.owner_id and (value->>'present')::boolean) then raise exception 'La actividad pertenece a otro colaborador presente'; end if;
    if task_action='pause' and (rec.status<>'En curso' or action_note not in ('Cliente','Seguridad','Incidencia')) then raise exception 'Pausa o motivo inválido'; end if;
    if task_action='resume' and rec.status<>'Pausada' then raise exception 'Solo se retoman actividades pausadas'; end if;
    if task_action='start' and rec.status not in ('Pendiente','Corrección') then raise exception 'La actividad ya fue iniciada'; end if;
    rec.owner_id:=actor;
    task_data:=task_data-'mode';
    mode:=case when coalesce((spec->>'outdoor')::boolean,false) and present_count>=2 then 'Exterior' else 'Digital / interior' end;
    if coalesce((spec->>'outdoor')::boolean,false) then
      if task_action in ('start','resume') and (coalesce(trim(task_data->>'propuesta'),'')='' or coalesce(trim(task_data->>'herramientas'),'')='' or coalesce(task_data->>'metaContactos','')!~'^[1-9][0-9]*$') then raise exception 'Antes de prospectar registra propuesta, herramientas y meta de contactos mayor a cero'; end if;
      -- Starting/resuming is the only point at which an exterior trip is authorized.
      if task_action in ('start','resume') and mode='Exterior' and exists(select 1 from public.centro_operation_records where day=target_day and task_id<>target_task and status='En curso' and data->>'mode'='Exterior') then raise exception 'Otra persona está afuera. Espera su regreso; nunca dejes la tienda sola.'; end if;
      task_data:=task_data||jsonb_build_object('mode',case when task_action in ('start','resume') then mode else coalesce(rec.data->>'mode','Digital / interior') end);
    end if;
    for field in select value from jsonb_array_elements(spec->'fields') loop
      if field->>'type'='number' and coalesce(task_data->>(field->>'key'),'')<>'' then
        if (task_data->>(field->>'key'))!~'^[0-9]+([.][0-9]+)?$' then raise exception 'Número inválido: %',field->>'label'; end if;
      end if;
    end loop;
    if coalesce((spec->>'inventory')::boolean,false) and task_data ? 'items' then
      if jsonb_typeof(task_data->'items')<>'array' or jsonb_array_length(task_data->'items')>500 then raise exception 'Lista de inventario inválida'; end if;
      for item in select value from jsonb_array_elements(task_data->'items') loop
        if jsonb_typeof(item)<>'object' or not (item ?& array['code','description','physical','system','price','location','label','registered','result','correction','evidence']) then raise exception 'Producto incompleto o inválido'; end if;
        if jsonb_typeof(item->'code')<>'string' or jsonb_typeof(item->'description')<>'string' or jsonb_typeof(item->'location')<>'string' or jsonb_typeof(item->'result')<>'string' or jsonb_typeof(item->'correction')<>'string' or jsonb_typeof(item->'evidence')<>'string' or jsonb_typeof(item->'label')<>'boolean' or jsonb_typeof(item->'registered')<>'boolean' then raise exception 'Formato de producto inválido'; end if;
      end loop;
    end if;
    if task_action='submit' then
      for field in select value from jsonb_array_elements(spec->'fields') loop
        if coalesce((field->>'required')::boolean,false) and (coalesce(trim(task_data->>(field->>'key')),'')='' or (field->>'type'='check' and task_data->>(field->>'key')<>'true')) then raise exception 'Falta: %',field->>'label'; end if;
      end loop;
      if coalesce((spec->>'evidence')::boolean,false) and coalesce(task_data->>'evidence','')!~'^https?://' then raise exception 'Agrega un enlace de evidencia'; end if;
      if coalesce((spec->>'inventory')::boolean,false) then
        if jsonb_typeof(task_data->'items') is distinct from 'array' or jsonb_array_length(task_data->'items')<25 then raise exception 'Se requieren 25 códigos por bloque'; end if;
        select count(*),count(distinct lower(trim(value->>'code'))) into code_count,distinct_codes from jsonb_array_elements(task_data->'items');
        if code_count<>distinct_codes then raise exception 'Hay códigos duplicados'; end if;
        select array_agg(lower(trim(i->>'code'))) into other_codes from public.centro_operation_records r cross join lateral jsonb_array_elements(coalesce(r.data->'items','[]'::jsonb)) i where day=target_day and task_id<>target_task and task_id like 'inventario-%';
        for item in select value from jsonb_array_elements(task_data->'items') loop
          if coalesce(trim(item->>'code'),'')='' or coalesce(trim(item->>'description'),'')='' or coalesce(trim(item->>'location'),'')='' or coalesce(item->>'result','')='' then raise exception 'Completa los datos de cada código'; end if;
          if lower(trim(item->>'code'))=any(other_codes) then raise exception 'Código ya contado en otro bloque: %',item->>'code'; end if;
          if coalesce(item->>'physical','')!~'^[0-9]+([.][0-9]+)?$' or coalesce(item->>'system','')!~'^[0-9]+([.][0-9]+)?$' or coalesce(item->>'price','')!~'^[0-9]+([.][0-9]+)?$' then raise exception 'Existencias y precio inválidos'; end if;
          if item->>'result'<>'Correcto' and (coalesce(trim(item->>'correction'),'')='' or coalesce(item->>'evidence','')!~'^https?://') then raise exception 'Las diferencias requieren corrección o seguimiento y evidencia'; end if;
          if item->>'result'='Correcto' and (item->>'label'<>'true' or item->>'registered'<>'true' or (item->>'physical')::numeric<>(item->>'system')::numeric) then raise exception 'Un producto con diferencia, sin etiqueta o sin alta no puede marcarse correcto'; end if;
        end loop;
      end if;
      if target_task='exhibicion' and coalesce(nullif(task_data->>'avance',''),'0')::numeric>100 then raise exception 'Avance máximo: 100%%'; end if;
      if target_task='atencion' and coalesce(nullif(task_data->>'compradores',''),'0')::numeric>coalesce(nullif(task_data->>'visitantes',''),'0')::numeric then raise exception 'Compradores no puede superar visitantes'; end if;
      if target_task in ('apertura','cierre') then
        select value into opening from jsonb_array_elements(coalesce((select value from public.app_state where key='xoxo.storeOpeningChecks'),'[]'::jsonb)) where value->>'date'=target_day::text and value->>'branch'='Sucursal Centro' limit 1;
        if target_task='apertura' and not coalesce(opening->>'erpReady'='true' and opening->>'systemsReady'='true' and opening->>'processComplete'='true' and length(opening->>'cashOpenConfirmedAt')>0 and length(opening->>'doorsOpenedAt')>0 and length(opening->>'openedAt')>0,false) then raise exception 'Completa primero la apertura autorizada en el panel'; end if;
        if target_task='cierre' and coalesce(opening->>'closedAt','')='' then raise exception 'Completa primero el cierre autorizado en el panel'; end if;
      end if;
    end if;
    new_status:=case task_action when 'start' then 'En curso' when 'resume' then 'En curso' when 'pause' then 'Pausada' when 'submit' then 'Por validar' else rec.status end;
    if task_action in ('start','resume') then
      update public.centro_operation_records set status='Pausada',version=version+1,updated_at=now(),
        history=history||jsonb_build_array(jsonb_build_object('at',now(),'actor',actor,'action','pause','note','Cambio de actividad; conserva avance'))
        where day=target_day and owner_id=actor and task_id<>target_task and status='En curso';
    end if;
  end if;
  update public.centro_operation_records set owner_id=rec.owner_id,status=new_status,data=task_data,version=version+1,updated_at=now(),
    history=history||case when old_owner<>rec.owner_id then jsonb_build_array(jsonb_build_object('at',now(),'actor',actor,'action','reassign','note','Transferida de '||old_owner||' por cambio de disponibilidad')) else '[]'::jsonb end
      ||jsonb_build_array(jsonb_build_object('at',now(),'actor',actor,'action',task_action,'note',action_note))
    where day=target_day and task_id=target_task returning * into rec;
  return to_jsonb(rec);
end $$;

revoke all on function public.centro_roster(date),public.centro_reconcile_day(date),public.centro_context(date),public.centro_update_task(date,text,integer,text,jsonb,text),public.centro_assign_day(text,date,text,text,text),public.centro_is_supervisor() from public,anon,authenticated;
grant execute on function public.centro_context(date),public.centro_update_task(date,text,integer,text,jsonb,text),public.centro_assign_day(text,date,text,text,text),public.centro_is_supervisor() to authenticated;

create or replace function public.centro_presence_changed()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name='app_state' then
    if coalesce(new.key,old.key) not in ('xoxo.workLocations','xoxo.shiftConfigs','xoxo.collaborators') then return null; end if;
  end if;
  perform public.centro_reconcile_day((now() at time zone 'America/Mexico_City')::date);
  return null;
end $$;
revoke all on function public.centro_presence_changed() from public,anon,authenticated;
drop trigger if exists centro_attendance_changed on public.attendance_records;
create trigger centro_attendance_changed after insert or update or delete on public.attendance_records
  for each statement execute function public.centro_presence_changed();
drop trigger if exists centro_assignments_changed on public.app_state;
create trigger centro_assignments_changed after insert or update or delete on public.app_state
  for each row execute function public.centro_presence_changed();

-- TEMPLATE_SEED: generated from src/centroOperation.ts by scripts/centro-templates.cjs.
insert into public.centro_task_templates(task_id,definition) values ('apertura', '{"id":"apertura","title":"Apertura oficial","start":"08:50","end":"09:10","category":"Apertura","control":true,"instructions":"La apertura se confirma en el control existente: venta lista para cobrar, sesión Xoxo, checklist completo y puerta abierta. Ventana correcta: 8:50–9:10. Sin descuentos económicos automáticos.","fields":[{"key":"incidencias","label":"Incidencias de apertura","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('aseo-1', '{"id":"aseo-1","title":"Aseo · parte 1","start":"09:00","end":"09:30","category":"Aseo","instructions":"Alternar piso y baños cada día. Intercambiar barrer/trapear o baño 1/baño 2. Registrar fotos de antes y después en esta misma actividad; no repetir el aseo en otro módulo.","fields":[{"key":"fotoAntes","label":"Foto antes del aseo","type":"photo","required":true},{"key":"fotoDespues","label":"Foto después del aseo","type":"photo","required":true},{"key":"realizado","label":"Aseo realizado","type":"check","required":true},{"key":"incidencias","label":"Incidencias encontradas","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('aseo-2', '{"id":"aseo-2","title":"Aseo · parte 2","start":"09:00","end":"09:30","category":"Aseo","instructions":"Alternar piso y baños cada día. Intercambiar barrer/trapear o baño 1/baño 2. Registrar fotos de antes y después en esta misma actividad; no repetir el aseo en otro módulo.","fields":[{"key":"fotoAntes","label":"Foto antes del aseo","type":"photo","required":true},{"key":"fotoDespues","label":"Foto después del aseo","type":"photo","required":true},{"key":"realizado","label":"Aseo realizado","type":"check","required":true},{"key":"incidencias","label":"Incidencias encontradas","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('presentacion', '{"id":"presentacion","title":"Mostradores y entrada","start":"09:30","end":"10:00","category":"Exhibición","instructions":"Limpiar mostradores y exhibición, retirar objetos ajenos, regresar productos a su ubicación y cuidar la primera impresión.","fields":[{"key":"mostradores","label":"Mostradores listos","type":"check","required":true},{"key":"entrada","label":"Entrada lista","type":"check","required":true},{"key":"precios","label":"Precios faltantes","required":false},{"key":"fuera","label":"Productos fuera de lugar","required":false},{"key":"vacios","label":"Espacios vacíos detectados","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('inventario-1', '{"id":"inventario-1","title":"Inventario · 25 códigos (1/2)","start":"10:00","end":"11:00","category":"Inventario","inventory":true,"instructions":"Meta sucursal: 50 códigos distintos. Revisar código, descripción, existencia física/sistema, precio, ubicación, etiqueta y alta. Error → corrección → evidencia → responsable → validación. Atender clientes y retomar sin perder avances.","fields":[{"key":"pendientes","label":"Correcciones pendientes","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('inventario-2', '{"id":"inventario-2","title":"Inventario · 25 códigos (2/2)","start":"10:00","end":"11:00","category":"Inventario","inventory":true,"instructions":"Meta sucursal: 50 códigos distintos. Revisar código, descripción, existencia física/sistema, precio, ubicación, etiqueta y alta. Error → corrección → evidencia → responsable → validación. Atender clientes y retomar sin perder avances.","fields":[{"key":"pendientes","label":"Correcciones pendientes","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('trafico-1', '{"id":"trafico-1","title":"Generación de tráfico · turno 1","start":"11:00","end":"12:00","category":"Tráfico","outdoor":true,"instructions":"Preparar propuesta antes de salir. Solo una persona afuera y otra disponible en tienda. En modo reducido: seguimientos digitales e invitaciones desde tienda.","fields":[{"key":"propuesta","label":"¿Qué harás, dónde, a quién y qué ofrecerás?","required":true},{"key":"metaContactos","label":"Meta de contactos","type":"number"},{"key":"herramientas","label":"Herramientas necesarias","required":true},{"key":"contactados","label":"Personas contactadas","type":"number"},{"key":"negocios","label":"Negocios visitados","type":"number"},{"key":"contactos","label":"Contactos obtenidos","type":"number"},{"key":"interesados","label":"Interesados","type":"number"},{"key":"cotizaciones","label":"Cotizaciones generadas","type":"number"},{"key":"visitas","label":"Posibles visitas","type":"number"},{"key":"aprendizaje","label":"¿Qué aprendiste?","required":true}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('trafico-2', '{"id":"trafico-2","title":"Generación de tráfico · turno 2","start":"12:00","end":"13:00","category":"Tráfico","outdoor":true,"instructions":"Preparar propuesta antes de salir. Solo una persona afuera y otra disponible en tienda. En modo reducido: seguimientos digitales e invitaciones desde tienda.","fields":[{"key":"propuesta","label":"¿Qué harás, dónde, a quién y qué ofrecerás?","required":true},{"key":"metaContactos","label":"Meta de contactos","type":"number"},{"key":"herramientas","label":"Herramientas necesarias","required":true},{"key":"contactados","label":"Personas contactadas","type":"number"},{"key":"negocios","label":"Negocios visitados","type":"number"},{"key":"contactos","label":"Contactos obtenidos","type":"number"},{"key":"interesados","label":"Interesados","type":"number"},{"key":"cotizaciones","label":"Cotizaciones generadas","type":"number"},{"key":"visitas","label":"Posibles visitas","type":"number"},{"key":"aprendizaje","label":"¿Qué aprendiste?","required":true}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('exhibicion', '{"id":"exhibicion","title":"Adaptación Sucursal Centro","start":"13:00","end":"14:00","category":"Exhibición","evidence":true,"instructions":"Elegir una actividad del proyecto. Registrar avance diario y acumulado; al terminar, continuar con la siguiente mejora.","fields":[{"key":"proyecto","label":"Actividad del proyecto","required":true},{"key":"material","label":"Material y herramientas","required":false},{"key":"inicio","label":"Fecha de inicio","required":false},{"key":"terminacion","label":"Fecha de terminación","required":false},{"key":"avance","label":"Avance acumulado (%)","type":"number"},{"key":"antes","label":"Antes: descripción o enlace","required":true},{"key":"despues","label":"Después: descripción o enlace","required":true},{"key":"problemas","label":"Problemas y material faltante","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('seguimiento', '{"id":"seguimiento","title":"Comidas escalonadas y seguimiento","start":"14:00","end":"15:00","category":"Atención","instructions":"Coordinar las comidas sin dejar la tienda sola. Registrar salida/regreso de comida en Registro diario. Atender WhatsApp, cotizaciones, visitantes y prospectos. Con una persona, solicitar cobertura al supervisor para el descanso.","fields":[{"key":"seguimientos","label":"Seguimientos realizados","type":"number"},{"key":"pendientes","label":"Clientes y cotizaciones pendientes","required":false},{"key":"cobertura","label":"Organización de comidas / cobertura","required":true}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('experiencia', '{"id":"experiencia","title":"Experiencia Xoxo y redes","start":"15:00","end":"16:00","category":"Experiencia","instructions":"Mejorar señalización, iluminación, etiquetas, precios, lonas, viniles y recorrido. No dejar espacios vacíos si existe mercancía disponible. Registrar resultados concretos de redes.","fields":[{"key":"mejora","label":"Mejora realizada","required":true},{"key":"solucion","label":"Problema solucionado","required":true},{"key":"interacciones","label":"Interacciones realizadas","type":"number"},{"key":"mensajes","label":"Mensajes respondidos","type":"number"},{"key":"invitados","label":"Personas invitadas","type":"number"},{"key":"prospectos","label":"Posibles clientes detectados","type":"number"}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('preparacion', '{"id":"preparacion","title":"Preparar Hora Xoxo","start":"16:00","end":"16:15","category":"Demostración","instructions":"Elegir producto, limpiar y preparar espacio y herramientas. Revisar características, existencia, precio y explicación. Auxiliares pueden apoyar; un jefe puede orientar y capacitar.","fields":[{"key":"producto","label":"Producto y código","required":true},{"key":"listo","label":"Espacio, producto y herramientas listos","type":"check","required":true},{"key":"capacitacion","label":"Capacitación o apoyo requerido","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('demostracion', '{"id":"demostracion","title":"Demostración / producto del día","start":"16:15","end":"17:00","category":"Demostración","evidence":true,"instructions":"Una persona presenta y otra apoya, graba y atiende. Con una persona: demostración breve dentro de tienda, interrumpible por clientes y solo dentro de sus competencias.","fields":[{"key":"producto","label":"Producto presentado","required":true},{"key":"explicacion","label":"Qué es, para qué y quién sirve, uso, problema que resuelve, precio y por qué lo tenemos","required":true},{"key":"interesados","label":"Interesados registrados","type":"number"},{"key":"apoyo","label":"Apoyo técnico / capacitación","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('contenido', '{"id":"contenido","title":"Contenido de la demostración","start":"17:00","end":"17:15","category":"Contenido","instructions":"Generar cuando sea posible video corto, foto, historia, WhatsApp Status, Reel/TikTok o material para YouTube.","fields":[{"key":"contenido","label":"Contenido generado o impedimento","required":true},{"key":"publicacion","label":"Dónde se publicó / pendiente","required":false},{"key":"enlace","label":"Enlace de publicación","required":false},{"key":"interacciones","label":"Interacciones iniciales","type":"number"}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('manana', '{"id":"manana","title":"Tres productos para mañana","start":"17:15","end":"17:30","category":"Demostración","instructions":"Proponer 3 productos: código, existencia, precio, interés para el cliente y demostración posible. El supervisor valida la selección.","fields":[{"key":"producto1","label":"Propuesta 1 (producto, código, existencia, precio, motivo y demostración)","required":true},{"key":"producto2","label":"Propuesta 2 (producto, código, existencia, precio, motivo y demostración)","required":true},{"key":"producto3","label":"Propuesta 3 (producto, código, existencia, precio, motivo y demostración)","required":true}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('cierre', '{"id":"cierre","title":"Cierre operativo y reporte","start":"17:30","end":"18:00","category":"Cierre","control":true,"instructions":"Cerrar seguimientos, cotizaciones, solicitudes y orden básico. Confirmar cierre con el proceso autorizado de la tienda. El reporte resume los registros del día.","fields":[{"key":"orden","label":"Orden y revisión final realizados","type":"check","required":true},{"key":"pendientes","label":"Pendientes para mañana","required":false},{"key":"necesidades","label":"Productos solicitados no disponibles / más solicitados","required":false},{"key":"comentarios","label":"Comentarios de clientes e incidencias","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('atencion', '{"id":"atencion","title":"Atención y resultados del día","start":"08:50","end":"18:00","category":"Atención","control":true,"instructions":"Consolidar los totales de sucursal sin duplicar visitantes. La atención tiene prioridad durante toda la jornada; registrar procedencia, contactos, cotizaciones y necesidades.","fields":[{"key":"visitantes","label":"Visitantes (meta 50)","type":"number"},{"key":"nuevos","label":"Nuevos","type":"number"},{"key":"recurrentes","label":"Recurrentes","type":"number"},{"key":"compradores","label":"Compradores","type":"number"},{"key":"ventas","label":"Ventas ($)","type":"number"},{"key":"tickets","label":"Tickets","type":"number"},{"key":"cotizaciones","label":"Cotizaciones ($)","type":"number"},{"key":"procedencia","label":"Procedencia, contactos y productos solicitados","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
commit;
