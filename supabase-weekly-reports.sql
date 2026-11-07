-- Reporte entregado antes del descanso: la revisión es posterior y no bloquea la salida.
begin;
create table if not exists weekly_report_settings(id boolean primary key default true check(id),activated_on date not null default (now() at time zone 'America/Mexico_City')::date);
insert into weekly_report_settings(id) values(true) on conflict do nothing;
create table if not exists staff_workweek(employee_number text primary key,workdays jsonb not null check(jsonb_typeof(workdays)='array'));
insert into staff_workweek values('014','[5,6,0]') on conflict(employee_number) do update set workdays=excluded.workdays;
insert into staff_rest_settings(employee_number,weekday) select employee_number,case when employee_number='014' then 1 else 0 end from profiles where active and display_name<>'Vacante' on conflict do nothing;
update staff_rest_settings set weekday=1 where employee_number='014';
create or replace function staff_is_rest(person text,day date) returns boolean language sql stable security definer set search_path=public as $$select coalesce((select is_rest from staff_rest_exceptions where employee_number=person and staff_rest_exceptions.day=staff_is_rest.day),(select not(workdays @> to_jsonb(extract(dow from day)::integer)) from staff_workweek where employee_number=person),(select weekday=extract(dow from day)::integer from staff_rest_settings where employee_number=person),false)$$;
create table if not exists staff_weekly_reports(record_id text primary key,employee_number text not null,branch text not null,record_date date not null,cycle_start date not null,rest_date date not null,payload jsonb not null,version integer not null default 0,submitted_at timestamptz not null default now(),unique(employee_number,rest_date));
alter table weekly_report_settings enable row level security;alter table staff_workweek enable row level security;alter table staff_weekly_reports enable row level security;
revoke all on weekly_report_settings,staff_workweek,staff_weekly_reports from public,anon,authenticated;
grant select on staff_weekly_reports to authenticated;
drop policy if exists weekly_report_read on staff_weekly_reports;
create policy weekly_report_read on staff_weekly_reports for select to authenticated using(employee_number=(current_profile()).employee_number or staff_can_review(employee_number));
create or replace function weekly_report_dates(person text,asof date) returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('due',d::date,'restDate',d::date+1,'submitted',exists(select 1 from staff_weekly_reports r where r.employee_number=person and r.rest_date=d::date+1)) order by d),'[]') from weekly_report_settings cfg cross join lateral generate_series(cfg.activated_on,asof+14,interval '1 day')d where cfg.id and not staff_is_rest(person,d::date) and staff_is_rest(person,d::date+1)
$$;
create or replace function weekly_report_openings(person text,first_day date,last_day date) returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('date',d::date,'branch',coalesce(a.branch,work_branch(person,d::date)),'openedAt',o->>'openedAt','openedBy',o->>'openedById','missing',coalesce(o->>'openedAt','')='') order by d),'[]') from generate_series(first_day,last_day,interval '1 day')d left join attendance_records a on a.employee_number=person and a.record_date=d::date left join lateral (select v from app_state st cross join lateral jsonb_array_elements(st.value)v where st.key='xoxo.storeOpeningChecks' and v->>'date'=d::date::text and v->>'branch'=coalesce(a.branch,work_branch(person,d::date)) limit 1)q(o) on true where not staff_is_rest(person,d::date)
$$;
create or replace function weekly_report_context(target_employee text default null,due_day date default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor text:=(current_profile()).employee_number;person text:=coalesce(target_employee,actor);today date:=(now() at time zone 'America/Mexico_City')::date;due date;dates jsonb;info jsonb;first_day date;rows jsonb;people jsonb;report jsonb;
begin
 if actor is null or not(person=actor or staff_can_review(person)) then raise exception 'Sin permiso para este reporte';end if;
 perform staff_capture_today_plans();dates:=weekly_report_dates(person,today);
 select coalesce(due_day,(select (v->>'due')::date from jsonb_array_elements(dates)v where v->>'submitted'='false' order by v->>'due' limit 1),today) into due;
 if not exists(select 1 from jsonb_array_elements(dates)v where v->>'due'=due::text) then return jsonb_build_object('today',today,'employeeId',person,'dates',dates,'people','[]'::jsonb,'rows','[]'::jsonb);end if;
 info:=staff_cycle(person,due);first_day:=greatest((info->>'start')::date,(select activated_on from weekly_report_settings where id));
 report:=staff_cycle_report(person,first_day,least(due,today),now() at time zone 'America/Mexico_City');
 select coalesce(jsonb_agg(jsonb_build_object('record_id',record_id,'employee_number',employee_number,'branch',branch,'record_date',record_date,'cycle_start',cycle_start,'rest_date',rest_date,'submitted_at',submitted_at,'status',payload->>'status','version',version,'reviewNote',payload->>'reviewNote') order by submitted_at desc),'[]') into rows from (select * from staff_weekly_reports where employee_number=person order by submitted_at desc limit 52)r;
 select coalesce(jsonb_agg(jsonb_build_object('id',employee_number,'name',display_name) order by display_name),'[]') into people from profiles where active and display_name<>'Vacante' and (employee_number=actor or staff_can_review(employee_number));
 return jsonb_build_object('today',today,'employeeId',person,'due',due,'restDate',due+1,'firstDay',first_day,'dates',dates,'rows',rows,'people',people,'report',report,'openings',weekly_report_openings(person,first_day,least(due,today)),'canReview',staff_can_review(person),'blocked',exists(select 1 from jsonb_array_elements(dates)v where (v->>'due')::date<=today and v->>'submitted'='false'));
end $$;
create or replace function submit_weekly_report(due_day date,summary_text text,pending_text text,evidence jsonb,proof_keys jsonb default '[]') returns jsonb language plpgsql security definer set search_path=public as $$
declare person text:=(current_profile()).employee_number;today date:=(now() at time zone 'America/Mexico_City')::date;ctx jsonb;item jsonb;proof jsonb;proofs jsonb:='[]';doc jsonb;r staff_weekly_reports;
begin
 if person is null then raise exception 'Sesión requerida';end if;
 perform pg_advisory_xact_lock(hashtext('weekly-report-'||person));
 select * into r from staff_weekly_reports where employee_number=person and rest_date=due_day+1;if found then return to_jsonb(r);end if;
 if due_day>today or not exists(select 1 from jsonb_array_elements(weekly_report_dates(person,today))v where v->>'due'=due_day::text) then raise exception 'Entrega el reporte en tu última jornada antes del descanso, o después si quedó vencido';end if;
 if length(trim(coalesce(summary_text,'')))<30 or length(summary_text)>6000 or length(trim(coalesce(pending_text,'')))<10 or length(pending_text)>3000 then raise exception 'Describe tu semana (mínimo 30 caracteres) y los pendientes o que no hubo incidencias (mínimo 10)';end if;
 if evidence is null or jsonb_typeof(evidence)<>'array' or jsonb_array_length(evidence)>10 or octet_length(evidence::text)>8000000 or proof_keys is null or jsonb_typeof(proof_keys)<>'array' or jsonb_array_length(proof_keys)>30 then raise exception 'Evidencias inválidas: máximo 10 adjuntos y 30 actividades';end if;
 for item in select value from jsonb_array_elements(evidence) loop
  if length(trim(coalesce(item->>'description','')))<5 or not(coalesce(item->>'url','')~'^https?://[^[:space:]]+$' or coalesce(item->>'dataUrl','')~'^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$') then raise exception 'Cada evidencia requiere descripción y enlace http(s) o imagen válida';end if;
 end loop;
 ctx:=weekly_report_context(person,due_day);
 for item in select value from jsonb_array_elements(ctx#>'{report,items}') where value->>'completed'='true' and value->>'evidenceComplete'='true' and proof_keys ? (value->>'key') loop
  proof:=staff_activity_proof(person,item->>'key',item->>'fingerprint');
  if jsonb_array_length(coalesce(proof->'pictures','[]'))+jsonb_array_length(coalesce(proof->'links','[]'))>0 then proofs:=proofs||jsonb_build_array(jsonb_build_object('item',item,'proof',proof));end if;
 end loop;
 if jsonb_array_length(evidence)+jsonb_array_length(proofs)=0 then raise exception 'Adjunta al menos una evidencia con descripción o selecciona una actividad con fotos o enlaces';end if;
 doc:=jsonb_build_object('status','Entregado','summary',trim(summary_text),'pending',trim(pending_text),'evidence',evidence,'activityProofs',proofs,'report',ctx->'report','openings',ctx->'openings','due',due_day,'onTime',due_day=today,'completedAt',now(),'branch',work_branch(person,today));
 if octet_length(doc::text)>20000000 then raise exception 'Las evidencias superan 20 MB. Selecciona menos imágenes o usa enlaces';end if;
 insert into staff_weekly_reports(record_id,employee_number,branch,record_date,cycle_start,rest_date,payload) values(person||'-'||(due_day+1),person,work_branch(person,today),due_day,(ctx->>'firstDay')::date,due_day+1,doc) returning * into r;return to_jsonb(r);
end $$;
create or replace function weekly_report_detail(report_id text) returns jsonb language plpgsql security definer set search_path=public as $$declare r staff_weekly_reports;begin select * into r from staff_weekly_reports where record_id=report_id;if not found or not(r.employee_number=(current_profile()).employee_number or staff_can_review(r.employee_number)) then raise exception 'Sin permiso para este reporte';end if;return to_jsonb(r);end $$;
create or replace function review_weekly_report(report_id text,review_note text,expected_version integer) returns void language plpgsql security definer set search_path=public as $$declare r staff_weekly_reports;begin select * into r from staff_weekly_reports where record_id=report_id for update;if not found or not staff_can_review(r.employee_number) then raise exception 'Sólo el superior puede revisar el reporte';end if;if r.version<>expected_version then raise exception 'Otra sesión ya revisó el reporte. Actualiza';end if;if length(trim(coalesce(review_note,'')))<10 then raise exception 'Explica el resultado de la revisión';end if;update staff_weekly_reports set payload=payload||jsonb_build_object('status','Revisado','reviewNote',trim(review_note),'reviewedBy',(current_profile()).employee_number,'reviewedAt',now(),'reviewHistory',coalesce(payload->'reviewHistory','[]')||jsonb_build_array(jsonb_build_object('at',now(),'actor',(current_profile()).employee_number,'note',trim(review_note)))),version=version+1 where record_id=report_id;end $$;
create or replace function weekly_report_exit_guard() returns trigger language plpgsql security definer set search_path=public as $$declare missing date;today date:=(now() at time zone 'America/Mexico_City')::date;begin
 if coalesce(new.payload->>'out','')='' or new.record_date<>today or (TG_OP='UPDATE' and coalesce(old.payload->>'out','')<>'') then return new;end if;
 -- Mismo bloqueo serial que la entrega: dos dispositivos no pueden saltar la regla.
 perform pg_advisory_xact_lock(hashtext('weekly-report-'||new.employee_number));
 select (v->>'due')::date into missing from jsonb_array_elements(weekly_report_dates(new.employee_number,today))v where (v->>'due')::date<=today and v->>'submitted'='false' order by v->>'due' limit 1;
 if missing is not null then raise exception 'Salida no registrada: entrega tu reporte semanal con evidencias del % en Panel o Registro diario. La revisión posterior del superior no bloquea la salida.',missing;end if;return new;
end $$;
drop trigger if exists zz_weekly_report_exit on attendance_records;create trigger zz_weekly_report_exit before insert or update on attendance_records for each row execute function weekly_report_exit_guard();
create or replace function weekly_report_metrics(from_day date,to_day date) returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;today date:=(now() at time zone 'America/Mexico_City')::date;begin
 if (current_profile()).employee_number is null or from_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Sesión y periodo válido requeridos';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.employee_number||'-'||(d->>'restDate'),'employeeId',p.employee_number,'branch',coalesce(r.branch,work_branch(p.employee_number,(d->>'due')::date)),'date',d->>'due','dueDate',d->>'due','end','23:59','status',coalesce(r.payload->>'status','Pendiente'),'completedAt',r.payload->>'completedAt','onTime',r.payload->'onTime')),'[]') into result from profiles p cross join lateral jsonb_array_elements(weekly_report_dates(p.employee_number,least(to_day,today)))d left join staff_weekly_reports r on r.employee_number=p.employee_number and r.rest_date=(d->>'restDate')::date where p.active and p.display_name<>'Vacante' and (p.employee_number=(current_profile()).employee_number or staff_can_review(p.employee_number)) and (d->>'due')::date between from_day and least(to_day,today);
 return jsonb_build_object('staff_weekly_reports',jsonb_build_object('available',true,'rows',result));
end $$;
revoke all on function weekly_report_dates(text,date),weekly_report_openings(text,date,date),weekly_report_exit_guard() from public,anon,authenticated;
revoke all on function weekly_report_context(text,date),submit_weekly_report(date,text,text,jsonb,jsonb),weekly_report_detail(text),review_weekly_report(text,text,integer),weekly_report_metrics(date,date) from public,anon;
grant execute on function weekly_report_context(text,date),submit_weekly_report(date,text,text,jsonb,jsonb),weekly_report_detail(text),review_weekly_report(text,text,integer),weekly_report_metrics(date,date) to authenticated;
create or replace function weekly_report_evidence(from_day date,to_day date) returns jsonb language plpgsql security invoker set search_path=public as $$begin
 if (current_profile()).employee_number is null or from_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Sesión y periodo válido requeridos';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id','weekly-'||record_id,'employeeId',employee_number,'date',record_date,'branch',branch,'kind','Reporte','title','Reporte semanal antes del descanso','description','Resumen, pendientes y evidencias de la semana; incluye la apertura de la sucursal donde se laboró. El reporte completo se consulta en Panel o Registro diario.','scheduled','00:00-23:59','status',case when payload->>'status'='Revisado' then 'Validada' else 'Por validar' end,'completedAt',payload->>'completedAt','requiresEvidence',false,'recordProof',true,'validationRequired',true,'comment',payload->>'summary','links',coalesce((select jsonb_agg(jsonb_build_object('label',e->>'description','url',e->>'url')) from jsonb_array_elements(payload->'evidence')e where coalesce(e->>'url','')<>''),'[]'),'single',(select jsonb_build_object('dataUrl',e->>'dataUrl','capturedAt',payload->>'completedAt') from jsonb_array_elements(payload->'evidence')e where coalesce(e->>'dataUrl','')<>'' limit 1))) from staff_weekly_reports where record_date between from_day and to_day),'[]');
end $$;
revoke all on function weekly_report_evidence(date,date) from public,anon;grant execute on function weekly_report_evidence(date,date) to authenticated;
notify pgrst,'reload schema';commit;
