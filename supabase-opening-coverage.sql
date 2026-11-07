-- Suplencia de apertura: administradores, 001/002/003 y Julio; no otorga permisos de caja ni de cierre.
begin;
create or replace function can_cover_opening() returns boolean language sql stable security definer set search_path=public as $$select coalesce((current_profile()).employee_number in('001','002','003','009') or (current_profile()).role in('ADMIN_GENERAL','ADMIN_TIENDA'),false)$$;
revoke all on function can_cover_opening() from public,anon;grant execute on function can_cover_opening() to authenticated;
-- La excepción del guard compartido sólo permite los campos de apertura de Matriz hoy.
create or replace function opening_cover_changes(before_rows jsonb,after_rows jsonb) returns boolean language plpgsql stable security definer set search_path=public as $$
declare r jsonb;prior jsonb;allowed text[]:=array['managerAuthorizedAt','managerAuthorizedById','erpReady','systemsReady','computersReadyAt','computersReadyById','doorsOpenedAt','doorsOpenedById','minimumStaff','processComplete','cashOpenConfirmedAt','cashOpenConfirmedById','cashierAuthorizedAt','cashierAuthorizedById','openedAt','openedById','openingLocation'];begin
 if not can_cover_opening() or jsonb_typeof(after_rows)<>'array' then return false;end if;
 if exists(select 1 from jsonb_array_elements(before_rows)b where not exists(select 1 from jsonb_array_elements(after_rows)a where a->>'id'=b->>'id')) then return false;end if;
 for r in select value from jsonb_array_elements(after_rows) loop
  select value into prior from jsonb_array_elements(before_rows)b where b->>'id'=r->>'id';
  if r=prior then continue;end if;
  if r->>'branch'<>'Matriz' or r->>'date'<>(now() at time zone 'America/Mexico_City')::date::text or r->>'id'<>r->>'date'||'-Matriz' then return false;end if;
  prior:=coalesce(prior,jsonb_build_object('id',r->>'id','date',r->>'date','branch','Matriz','minimumStaff',false,'systemsReady',false,'processComplete',false));
  if (r-allowed)<>(prior-allowed) then return false;end if;
 end loop;return true;
end $$;
revoke all on function opening_cover_changes(jsonb,jsonb) from public,anon,authenticated;
do $$declare definition text;begin
 definition:=pg_get_functiondef('guard_store_configuration()'::regprocedure);
 if position('opening_cover_changes' in definition)=0 then definition:=replace(definition,$old$ if actor.user_id is null then$old$,$new$ if TG_OP<>'DELETE' and new.key='xoxo.storeOpeningChecks' and opening_cover_changes(case when TG_OP='INSERT' then '[]'::jsonb else old.value end,new.value) then return new;end if;
 if actor.user_id is null then$new$);execute definition;end if;
 definition:=pg_get_functiondef('matriz_opening_context(date)'::regprocedure);
 definition:=replace(definition,$old$applicable:=can_manage_all() or$old$,$new$applicable:=can_cover_opening() or can_manage_all() or$new$);
 definition:=replace(definition,$old$if can_manage_branch('Matriz') then$old$,$new$if can_manage_branch('Matriz') or can_cover_opening() then$new$);
 definition:=replace(definition,$old$'canConfigure',can_manage_branch('Matriz')$old$,$new$'canConfigure',can_manage_branch('Matriz') or can_cover_opening(),'canCover',can_cover_opening()$new$);execute definition;
 definition:=pg_get_functiondef('save_matriz_opening_owners(jsonb,integer)'::regprocedure);
 definition:=replace(definition,$old$or not can_manage_branch('Matriz') then$old$,$new$or not(can_manage_branch('Matriz') or can_cover_opening()) then$new$);execute definition;
 definition:=pg_get_functiondef('mark_matriz_opening_step(text,integer)'::regprocedure);
 definition:=replace(definition,$old$or work_branch(actor.employee_number,day)<>'Matriz' then$old$,$new$or (work_branch(actor.employee_number,day)<>'Matriz' and not can_cover_opening()) then$new$);
 definition:=replace(definition,$old$if r.employee_number<>actor.employee_number then$old$,$new$if r.employee_number<>actor.employee_number and not can_cover_opening() then$new$);
 definition:=replace(definition,$old$set version=version+1,updated_at=now(),payload=payload||jsonb_build_object('status','Completada'$old$,$new$set employee_number=actor.employee_number,version=version+1,updated_at=now(),payload=payload||jsonb_build_object('assignedEmployeeId',coalesce(payload->>'assignedEmployeeId',r.employee_number),'employeeId',actor.employee_number,'substitution',r.employee_number<>actor.employee_number,'status','Completada'$new$);execute definition;
 definition:=pg_get_functiondef('patch_store_opening_checks(jsonb)'::regprocedure);
 definition:=replace(definition,$old$if not can_manage_all() and actor.branch is distinct from item->>'branch' then$old$,$new$if not can_manage_all() and actor.branch is distinct from item->>'branch' and not(item->>'branch'='Matriz' and can_cover_opening()) then$new$);
 definition:=replace(definition,$old$if not can_manage_branch('Matriz') then raise exception 'Gerencia debe confirmar$old$,$new$if not(can_manage_branch('Matriz') or can_cover_opening()) then raise exception 'Gerencia debe confirmar$new$);execute definition;
end $$;
create or replace function store_opening_checks() returns jsonb language sql stable security definer set search_path=public as $$select coalesce(jsonb_agg(item),'[]') from app_state st cross join lateral jsonb_array_elements(st.value)item where st.key='xoxo.storeOpeningChecks' and (current_profile()).active and (can_manage_all() or item->>'branch'=(current_profile()).branch or item->>'branch'='Matriz' and can_cover_opening())$$;
notify pgrst,'reload schema';commit;
