-- Incluye al personal del siguiente turno en la agenda prevista. La ejecucion conserva el control de presencia.
begin;
create or replace function public.cleaning_base_centro_assignments(target_day date)
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
revoke all on function public.cleaning_base_centro_assignments(date) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
