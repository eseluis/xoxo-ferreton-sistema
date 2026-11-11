-- Las actividades de Centro se entregan según la jerarquía, también por API.
begin;
create or replace function public.centro_task_assignments(target_day date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare roster jsonb; pool jsonb; present jsonb; result jsonb:='[]'; loads jsonb:='{}'; pairs jsonb:='{}';
 spec jsonb; rec public.centro_operation_records; owner text; task_group text; preview boolean;
 clock text:=to_char(now() at time zone 'America/Mexico_City','HH24:MI');
begin
 roster:=public.centro_roster(target_day);
 select coalesce(jsonb_agg(p),'[]'::jsonb) into present from jsonb_array_elements(roster) p
 where (p->>'present')::boolean and p->>'start'<=clock and p->>'end'>clock;
 preview:=jsonb_array_length(present)=0 and not exists(select 1 from jsonb_array_elements(roster) p where (p->>'arrived')::boolean)
   and exists(select 1 from jsonb_array_elements(roster) p where clock<p->>'start');
 pool:=case when preview then roster else present end;
 for spec in select definition from public.centro_task_templates order by array_position(array[
  'apertura','aseo-1','aseo-2','presentacion','inventario-1','inventario-2','trafico-1','trafico-2',
  'exhibicion','seguimiento','experiencia','preparacion','demostracion','contenido','manana','cierre','atencion'],task_id),task_id loop
  select coalesce(jsonb_agg(p),'[]'::jsonb) into pool from jsonb_array_elements(roster) p where (p->>'present')::boolean or (clock<p->>'start' and p->>'start'<spec->>'end' and p->>'end'>spec->>'start');
  owner:=null;
  select * into rec from public.centro_operation_records where day=target_day and task_id=spec->>'id';
  task_group:=regexp_replace(spec->>'id','-[12]$','');
  if (target_day<(now() at time zone 'America/Mexico_City')::date and rec.owner_id is not null) or rec.status in ('Por validar','Validada') or exists(select 1 from jsonb_array_elements(pool) p where p->>'id'=rec.owner_id) then
   owner:=rec.owner_id;
  else
   select p->>'id' into owner from jsonb_array_elements(pool) p
    where (p->>'start'<spec->>'end' and p->>'end'>spec->>'start') or ((p->>'present')::boolean and clock>=spec->>'end')
    order by (case when pairs->>task_group=p->>'id' then 100 else 0 end)+coalesce((loads->>(p->>'id'))::integer,0)+
     (case when coalesce((spec->>'control')::boolean,false) then
       case when p->>'role' in ('APODERADA_LEGAL','DIRECTOR','GERENTE_GENERAL','ADMIN_GENERAL','GERENTE_TIENDA','ADMIN_TIENDA') then -8 when p->>'role'='JEFE_AREA' then -3 else 0 end
      when p->>'role' in ('APODERADA_LEGAL','DIRECTOR','GERENTE_GENERAL','ADMIN_GENERAL','GERENTE_TIENDA','ADMIN_TIENDA') then 8
      when spec->>'category'='Demostración' and p->>'role'='JEFE_AREA' then -3 else 0 end),p->>'id' limit 1;
  end if;
  if owner is not null then
   loads:=jsonb_set(loads,array[owner],to_jsonb(coalesce((loads->>owner)::integer,0)+2));
   if spec->>'id'~'-[12]$' then pairs:=jsonb_set(pairs,array[task_group],to_jsonb(owner)); end if;
  end if;
  result:=result||jsonb_build_array(jsonb_build_object('taskId',spec->>'id','ownerId',owner));
 end loop;
 return result;
end $$;
revoke all on function public.centro_task_assignments(date) from public,anon,authenticated;

create or replace function public.centro_context(target_day date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare roster jsonb; actor text; supervisor boolean; assignments jsonb;
begin
 select employee_number into actor from public.profiles where user_id=auth.uid() and active;
 if actor is null then raise exception 'Sesión no autorizada'; end if;
 supervisor:=public.centro_is_supervisor();
 roster:=public.centro_roster(target_day);
 if not supervisor and not exists(select 1 from jsonb_array_elements(roster) where value->>'id'=actor) then
  raise exception 'No estás asignado a Centro en este día';
 end if;
 perform public.centro_reconcile_day(target_day);
 assignments:=public.centro_task_assignments(target_day);
 if not supervisor then
  select coalesce(jsonb_agg(a),'[]'::jsonb) into assignments from jsonb_array_elements(assignments) a where a->>'ownerId'=actor;
 end if;
 return jsonb_build_object('roster',roster,'assignments',assignments,
  'outsideBusy',exists(select 1 from public.centro_operation_records where day=target_day and owner_id<>actor and status='En curso' and data->>'mode'='Exterior'),
  'records',coalesce((select jsonb_agg(to_jsonb(r) order by task_id) from public.centro_operation_records r where day=target_day and
   (supervisor or exists(select 1 from jsonb_array_elements(assignments) a where a->>'taskId'=r.task_id))),'[]'::jsonb),
  'previous',coalesce((select jsonb_agg(to_jsonb(r) order by day desc,task_id) from public.centro_operation_records r where day<target_day
   and (supervisor or owner_id=actor) and (day>=target_day-7 or (task_id='exhibicion' and status='Validada'))),'[]'::jsonb));
end $$;
revoke all on function public.centro_context(date) from public,anon;
grant execute on function public.centro_context(date) to authenticated;
create or replace function public.operation_calendar_centro(from_day date,to_day date,target_employee text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor text; target_branch text;
begin
  actor := (public.current_profile()).employee_number;
  if actor is null then raise exception 'Sesión no autorizada'; end if;
  if from_day is null or to_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Periodo no válido'; end if;
  select branch into target_branch from public.profiles where employee_number=target_employee and active limit 1;
  if actor<>target_employee and not public.can_manage_branch(coalesce(target_branch,'')) then raise exception 'Sin permiso para consultar a este colaborador'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('data','{}'::jsonb) order by day,task_id) from public.centro_operation_records r
    where day between from_day and to_day and (owner_id=target_employee or (public.centro_is_supervisor() and exists (
      select 1 from public.operation_day_plans p cross join lateral jsonb_array_elements(p.slots) s
      where p.employee_number=target_employee and p.day=r.day and s->>'key'='Centro-'||r.task_id
    )))),'[]'::jsonb);
end $$;
commit;
