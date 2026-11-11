-- Reinicio semanal y sincronizacion de tienda/puesto desde Colaboradores.
-- No borra reportes, evidencias ni checadas; aplicar despues de las migraciones existentes.
-- Mantiene directorio, perfiles y ubicación operativa en la misma transacción.
-- No cambia asignaciones de otros días ni avances/evidencias de actividades.
begin;
create or replace function public.sync_profiles_from_collaborators()
returns trigger language plpgsql security definer set search_path=public as $$
declare item jsonb; previous_branch text; locations jsonb; merged jsonb;
  today text := (now() at time zone 'America/Mexico_City')::date::text;
begin
  if new.key <> 'xoxo.collaborators' then return new; end if;
  for item in select value from jsonb_array_elements(new.value) loop
    update public.profiles
      set display_name=coalesce(item->>'name',display_name),
          role=coalesce(item->>'role',role), branch=coalesce(item->>'branch',branch), updated_at=now()
      where employee_number=item->>'id';
    previous_branch := null;
    if tg_op='UPDATE' then
      select e.value->>'branch' into previous_branch from jsonb_array_elements(old.value) e where e.value->>'id'=item->>'id' limit 1;
    end if;
    if previous_branch is not null and previous_branch is distinct from item->>'branch' then
      perform pg_advisory_xact_lock(hashtext('centro-assignments'));
      select value into locations from public.app_state where key='xoxo.workLocations' for update;
      if locations is not null then
        select coalesce(jsonb_agg(case when e.value->>'employeeId'=item->>'id' and e.value->>'date'=today
          then jsonb_set(e.value,'{location}',to_jsonb(item->>'branch')) else e.value end),'[]'::jsonb)
          into merged from jsonb_array_elements(locations) e;
        if merged is distinct from locations then
          update public.app_state set value=merged,updated_at=now(),updated_by=auth.uid() where key='xoxo.workLocations';
        end if;
      end if;
    end if;
  end loop;
  perform public.centro_reconcile_day(today::date);
  return new;
end $$;
revoke all on function public.sync_profiles_from_collaborators() from public,anon,authenticated;
drop trigger if exists collaborators_profile_sync on public.app_state;
create trigger collaborators_profile_sync after insert or update of value on public.app_state
for each row when (new.key='xoxo.collaborators') execute function public.sync_profiles_from_collaborators();
-- Reparar los perfiles que conservaban la tienda anterior por faltar el trigger.
update public.profiles p set display_name=coalesce(e.value->>'name',p.display_name),
 role=coalesce(e.value->>'role',p.role),branch=coalesce(e.value->>'branch',p.branch),updated_at=now()
from public.app_state s cross join lateral jsonb_array_elements(s.value) e
where s.key='xoxo.collaborators' and p.employee_number=e.value->>'id';
select public.centro_reconcile_day((now() at time zone 'America/Mexico_City')::date);

create or replace function weekly_report_dates(person text,asof date) returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('due',d::date,'restDate',d::date+1,'status',case when exists(select 1 from staff_weekly_reports r where r.employee_number=person and r.rest_date=d::date+1) then 'Entregado' when d::date<asof then 'No entregado · pendiente de seguimiento del superior' else 'Pendiente' end,'submitted',exists(select 1 from staff_weekly_reports r where r.employee_number=person and r.rest_date=d::date+1)) order by d),'[]') from weekly_report_settings cfg cross join lateral generate_series(cfg.activated_on,asof+14,interval '1 day')d where cfg.id and not staff_is_rest(person,d::date) and staff_is_rest(person,d::date+1)
$$;

create or replace function weekly_report_context(target_employee text default null,due_day date default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor text:=(current_profile()).employee_number;person text:=coalesce(target_employee,actor);today date:=(now() at time zone 'America/Mexico_City')::date;due date;dates jsonb;info jsonb;first_day date;rows jsonb;people jsonb;report jsonb;incoming jsonb:='[]';
begin
 if actor is null or not(person=actor or weekly_report_director()) then raise exception 'Sin permiso para este reporte';end if;
 if weekly_report_director() then select coalesce(jsonb_agg(jsonb_build_object('record_id',record_id,'employee_number',employee_number,'record_date',record_date,'cycle_start',cycle_start,'rest_date',rest_date,'submitted_at',submitted_at,'status',payload->>'status','version',version,'name',(select display_name from profiles where employee_number=r.employee_number)) order by submitted_at desc),'[]') into incoming from (select * from staff_weekly_reports order by submitted_at desc limit 100)r;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',employee_number,'name',display_name) order by display_name),'[]') into people from profiles where active and display_name<>'Vacante' and (employee_number=actor or weekly_report_director());
 perform staff_capture_today_plans();dates:=weekly_report_dates(person,today);
 select coalesce(due_day,(select (v->>'due')::date from jsonb_array_elements(dates)v where (v->>'due')::date>=today order by v->>'due' limit 1),today) into due;
 if not exists(select 1 from jsonb_array_elements(dates)v where v->>'due'=due::text) then return jsonb_build_object('incoming',incoming,'recipientIds',jsonb_build_array('001','002','003'),'today',today,'employeeId',person,'dates',dates,'people',people,'rows','[]'::jsonb);end if;
 info:=staff_cycle(person,due);first_day:=(info->>'start')::date;
 report:=staff_cycle_report(person,first_day,least(due,today),now() at time zone 'America/Mexico_City');
 select coalesce(jsonb_agg(jsonb_build_object('record_id',record_id,'employee_number',employee_number,'branch',branch,'record_date',record_date,'cycle_start',cycle_start,'rest_date',rest_date,'submitted_at',submitted_at,'status',payload->>'status','version',version,'reviewNote',payload->>'reviewNote') order by submitted_at desc),'[]') into rows from (select * from staff_weekly_reports where employee_number=person order by submitted_at desc limit 52)r;
 select coalesce(jsonb_agg(jsonb_build_object('id',employee_number,'name',display_name) order by display_name),'[]') into people from profiles where active and display_name<>'Vacante' and (employee_number=actor or weekly_report_director());
 if weekly_report_director() then select coalesce(jsonb_agg(jsonb_build_object('record_id',record_id,'employee_number',employee_number,'record_date',record_date,'cycle_start',cycle_start,'rest_date',rest_date,'submitted_at',submitted_at,'status',payload->>'status','version',version,'name',(select display_name from profiles where employee_number=r.employee_number)) order by submitted_at desc),'[]') into incoming from (select * from staff_weekly_reports order by submitted_at desc limit 100)r;end if;
 return jsonb_build_object('incoming',incoming,'recipientIds',jsonb_build_array('001','002','003'),'today',today,'employeeId',person,'due',due,'restDate',due+1,'firstDay',first_day,'dates',dates,'rows',rows,'people',people,'report',report,'openings',weekly_report_openings(person,first_day,least(due,today)),'canReview',weekly_report_director() and actor<>person,'blocked',exists(select 1 from jsonb_array_elements(dates)v where (v->>'due')::date=today and v->>'submitted'='false'));
end $$;

create or replace function weekly_report_exit_guard() returns trigger language plpgsql security definer set search_path=public as $$declare missing date;today date:=(now() at time zone 'America/Mexico_City')::date;begin
 if coalesce(new.payload->>'out','')='' or new.record_date<>today or (TG_OP='UPDATE' and coalesce(old.payload->>'out','')<>'') then return new;end if;
 -- Mismo bloqueo serial que la entrega: dos dispositivos no pueden saltar la regla.
 perform pg_advisory_xact_lock(hashtext('weekly-report-'||new.employee_number));
 select (v->>'due')::date into missing from jsonb_array_elements(weekly_report_dates(new.employee_number,today))v where (v->>'due')::date=today and v->>'submitted'='false' order by v->>'due' limit 1;
 if missing is not null then raise exception 'Salida no registrada: entrega tu reporte semanal con evidencias del % en Panel o Registro diario. La revisión posterior del superior no bloquea la salida.',missing;end if;return new;
end $$;

create or replace function weekly_report_metrics(from_day date,to_day date) returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;today date:=(now() at time zone 'America/Mexico_City')::date;begin
 if (current_profile()).employee_number is null or from_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Sesión y periodo válido requeridos';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.employee_number||'-'||(d->>'restDate'),'employeeId',p.employee_number,'branch',coalesce(r.branch,work_branch(p.employee_number,(d->>'due')::date)),'date',d->>'due','dueDate',d->>'due','end','23:59','status',coalesce(r.payload->>'status',case when (d->>'due')::date<today then 'No entregado' else 'Pendiente' end),'completedAt',r.payload->>'completedAt','onTime',r.payload->'onTime')),'[]') into result from profiles p cross join lateral jsonb_array_elements(weekly_report_dates(p.employee_number,least(to_day,today)))d left join staff_weekly_reports r on r.employee_number=p.employee_number and r.rest_date=(d->>'restDate')::date where p.active and p.display_name<>'Vacante' and (p.employee_number=(current_profile()).employee_number or weekly_report_director()) and (d->>'due')::date between from_day and least(to_day,today);
 return jsonb_build_object('staff_weekly_reports',jsonb_build_object('available',true,'rows',result));
end $$;
notify pgrst,'reload schema';
commit;
