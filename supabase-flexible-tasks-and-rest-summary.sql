-- Tareas y actividades flexibles; aseos conservan las ventanas y fotos obligatorias.
begin;
create or replace function public.validate_assigned_task_schedule() returns trigger language plpgsql security definer set search_path=public as $$begin
 if coalesce(new.payload->>'start','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(new.payload->>'end','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or new.payload->>'end'<=new.payload->>'start' then raise exception 'Indica un horario válido: la hora final debe ser posterior a la inicial.';end if;
 return new;end $$;
do $$declare def text;begin
 if to_regprocedure('invewin_action(date,text,text,integer,jsonb)') is not null then
 def:=pg_get_functiondef('invewin_action(date,text,text,integer,jsonb)'::regprocedure);
 def:=replace(def,$a$if clock<'11:00' then raise exception 'La actividad inicia a las 11:00';end if;$a$,'');
 def:=replace(def,$a$clock<='12:30'$a$,$a$(clock between '11:00' and '12:30')$a$);execute def;end if;
 if to_regprocedure('matriz_order_action(text,text,text,text)') is not null then
 def:=pg_get_functiondef('matriz_order_action(text,text,text,text)'::regprocedure);
 def:=replace(def,$a$if clock<'10:00' then raise exception 'El pedido inicia a las 10:00'; end if;$a$,'');
 def:=replace(def,$a$if clock<coalesce(r.payload->>'start','10:00') then raise exception 'El pedido inicia a las %',coalesce(r.payload->>'start','10:00'); end if;$a$,'');
 def:=replace(def,$a$'onTime',clock<=coalesce(r.payload->>'end','11:00')$a$,$a$'onTime',(clock between coalesce(r.payload->>'start','10:00') and coalesce(r.payload->>'end','11:00'))$a$);execute def;end if;
 if to_regprocedure('area_handover_write_guard()') is not null then
 def:=pg_get_functiondef('area_handover_write_guard()'::regprocedure);
 def:=replace(def,$a$new.record_date<>clock::date or to_char(clock,'HH24:MI')<new.payload->>'start'$a$,$a$new.record_date<>clock::date$a$);execute def;end if;
 if to_regprocedure('closing_recovery_open()') is not null then
 def:=pg_get_functiondef('closing_recovery_open()'::regprocedure);
 def:=replace(def,$a$if now()<(ctx->>'releaseAt')::timestamptz then raise exception 'La regularización se habilita a las %, cinco minutos antes de tu salida de %',ctx->>'releaseTime',ctx->>'exitTime';end if;$a$,'');execute def;end if;
 if to_regprocedure('staff_activity_proof(text,text,text)') is not null then
 def:=pg_get_functiondef('staff_activity_proof(text,text,text)'::regprocedure);
 def:=replace(def,$a$coalesce(p->>'deliveryNote',p->>'employeeComment',p->>'pendientes',p->>'notes',p->>'note',p->>'description',p->>'comment','')$a$,$a$coalesce(nullif(p->>'deliveryNote',''),nullif(p->>'employeeComment',''),nullif(p->>'pendientes',''),nullif(p->>'note',''),nullif(p->>'comment',''),'Sin resultado escrito registrado')$a$);execute def;end if;
end $$;
create or replace function non_cleaning_timing_note() returns trigger language plpgsql security definer set search_path=public as $$declare a timestamp;z timestamp;t timestamp;outside boolean:=false;begin
 if new.payload->>'itemType'='Aseo' or new.payload->>'cleaningControlled'='true' or coalesce(new.payload->>'completedAt','')='' then return new;end if;
 if coalesce(new.payload->>'start',new.payload->>'scheduledStart','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(new.payload->>'end',new.payload->>'scheduledEnd','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then return new;end if;
 a:=new.record_date+coalesce(new.payload->>'start',new.payload->>'scheduledStart')::time;z:=new.record_date+coalesce(new.payload->>'end',new.payload->>'scheduledEnd')::time;
 t:=(new.payload->>'completedAt')::timestamptz at time zone 'America/Mexico_City';outside:=t<a or t>z;
 if coalesce(new.payload->>'startedAt','')<>'' then t:=(new.payload->>'startedAt')::timestamptz at time zone 'America/Mexico_City';outside:=outside or t<a or t>z;end if;
 new.payload:=new.payload||jsonb_build_object('outsideSchedule',outside,'timingNote',case when outside then 'Tarea o actividad hecha fuera de horario' else 'Hecha en horario' end);return new;end $$;
revoke all on function non_cleaning_timing_note() from public,anon,authenticated;
drop trigger if exists zz_non_cleaning_timing on daily_task_records;create trigger zz_non_cleaning_timing before insert or update on daily_task_records for each row execute function non_cleaning_timing_note();
drop trigger if exists zz_non_cleaning_timing on activity_run_records;create trigger zz_non_cleaning_timing before insert or update on activity_run_records for each row execute function non_cleaning_timing_note();
create or replace function director_rest_eve_summary() returns jsonb language plpgsql security definer set search_path=public as $$declare today date:=(now() at time zone 'America/Mexico_City')::date;p profiles;cycle jsonb;first_day date;people jsonb:='[]';r jsonb;begin
 if (current_profile()).employee_number is distinct from '003' then raise exception 'Resumen exclusivo de 003';end if;
 perform staff_capture_today_plans();
 for p in select * from profiles where active and display_name<>'Vacante' and employee_number<>'003' order by display_name loop
 if not staff_is_rest(p.employee_number,today+1) or staff_is_rest(p.employee_number,today) then continue;end if;
 cycle:=staff_cycle(p.employee_number,today);first_day:=coalesce((cycle->>'start')::date,today-6);
 select payload into r from staff_weekly_reports where employee_number=p.employee_number and record_date=today limit 1;
 people:=people||jsonb_build_array(jsonb_build_object('id',p.employee_number,'name',p.display_name,'branch',work_branch(p.employee_number,today),'from',first_day,'to',today,'report',staff_cycle_report(p.employee_number,first_day,today,now() at time zone 'America/Mexico_City'),'summary',r->>'summary','pending',r->>'pending'));
 end loop;return jsonb_build_object('today',today,'restDate',today+1,'people',people);end $$;
revoke all on function director_rest_eve_summary() from public,anon;grant execute on function director_rest_eve_summary() to authenticated;
notify pgrst,'reload schema';commit;
