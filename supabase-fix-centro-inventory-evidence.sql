-- Inventario: enlace de Alegra POS o comentario del resultado, incluso Sin incidencias.
begin;
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
    if task_action='submit' then
      for field in select value from jsonb_array_elements(spec->'fields') loop
        if coalesce((field->>'required')::boolean,false) and (coalesce(trim(task_data->>(field->>'key')),'')='' or (field->>'type'='check' and task_data->>(field->>'key')<>'true')) then raise exception 'Falta: %',field->>'label'; end if;
      end loop;
      if coalesce((spec->>'evidence')::boolean,false) and coalesce(task_data->>'evidence','')!~'^https?://' then raise exception 'Agrega un enlace de evidencia'; end if;
      if coalesce((spec->>'inventory')::boolean,false) then
        if coalesce(trim(task_data->>'evidence'),'')<>'' and trim(task_data->>'evidence')!~*'^https?://[^[:space:]]+$' then raise exception 'Agrega un enlace válido de Alegra POS'; end if;
        if coalesce(trim(task_data->>'evidence'),'')='' and coalesce(trim(task_data->>'pendientes'),'')='' then raise exception 'Agrega el enlace de Alegra POS o comenta las correcciones realizadas; si no hubo incidencias, escribe Sin incidencias'; end if;
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

insert into public.centro_task_templates(task_id,definition) values ('inventario-1', '{"id":"inventario-1","title":"Inventario · revisión en Alegra POS · bloque 1/2","start":"10:00","end":"11:00","category":"Inventario","inventory":true,"instructions":"Revisa el inventario en Alegra POS. Para terminar este bloque, agrega el enlace de evidencia de Alegra POS o comenta las correcciones realizadas. Si no encontraste incidencias, escribe Sin incidencias. No es necesario volver a capturar productos ni cantidades.","fields":[{"key":"pendientes","label":"Resultado de la revisión: correcciones realizadas o Sin incidencias","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
insert into public.centro_task_templates(task_id,definition) values ('inventario-2', '{"id":"inventario-2","title":"Inventario · revisión en Alegra POS · bloque 2/2","start":"10:00","end":"11:00","category":"Inventario","inventory":true,"instructions":"Revisa el inventario en Alegra POS. Para terminar este bloque, agrega el enlace de evidencia de Alegra POS o comenta las correcciones realizadas. Si no encontraste incidencias, escribe Sin incidencias. No es necesario volver a capturar productos ni cantidades.","fields":[{"key":"pendientes","label":"Resultado de la revisión: correcciones realizadas o Sin incidencias","required":false}]}'::jsonb) on conflict(task_id) do update set definition=excluded.definition;
commit;
