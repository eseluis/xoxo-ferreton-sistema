-- Ajusta únicamente bloques futuros y sin iniciar de la jornada vigente. Conserva el plan anterior.
begin;
create table if not exists daily_agenda_revisions(employee_number text not null,day date not null,branch text not null,policy_version integer not null default 1,previous_slots jsonb not null,revised_slots jsonb not null,applied_at timestamptz not null default now(),primary key(employee_number,day,branch,policy_version));
alter table daily_agenda_revisions enable row level security;revoke all on daily_agenda_revisions from public,anon,authenticated;grant select on daily_agenda_revisions to authenticated;
drop policy if exists daily_agenda_revision_read on daily_agenda_revisions;create policy daily_agenda_revision_read on daily_agenda_revisions for select to authenticated using(employee_number=(current_profile()).employee_number or staff_can_review(employee_number));
do $$declare person profiles;plan operation_day_plans;routine jsonb;source_rows jsonb;revised jsonb;s jsonb;targeted boolean;today date:=(now() at time zone 'America/Mexico_City')::date;clock text:=to_char(now() at time zone 'America/Mexico_City','HH24:MI');location text;begin
 if today<'2026-11-07' then return;end if;
 perform pg_advisory_xact_lock(hashtext('staff-today-plans'));
 for person in select * from profiles where active and display_name<>'Vacante' loop
  if staff_is_rest(person.employee_number,today) then continue;end if;
  location:=work_branch(person.employee_number,today);
  select * into plan from operation_day_plans where employee_number=person.employee_number and day=today and branch=location for update;
  if not found or exists(select 1 from daily_agenda_revisions where employee_number=person.employee_number and day=today and branch=location and policy_version=1) then continue;end if;
  select coalesce(jsonb_agg(a),'[]') into source_rows from app_state st cross join lateral jsonb_array_elements(st.value)a where st.key='xoxo.activitySchedules' and not coalesce(a->'excludeEmployeeIds','[]') ? person.employee_number and (coalesce(a->>'branch','')='' or a->>'branch'=location) and (not a?'weekdays' or a->'weekdays' @> to_jsonb(extract(dow from today)::integer)) and coalesce(nullif(a->>'activeFrom','')::date,today)<=today and coalesce(nullif(a->>'activeUntil','')::date,today)>=today;
  targeted:=exists(select 1 from jsonb_array_elements(source_rows)a where coalesce(a->>'sharedRoutine','false')<>'true' and a->'employeeIds' ? person.employee_number);
  select coalesce(jsonb_agg(a),'[]') into routine from jsonb_array_elements(source_rows)a where (a->>'sharedRoutine'='true' and case when jsonb_array_length(coalesce(a->'employeeIds','[]'))>0 then a->'employeeIds' ? person.employee_number else a->'ownerRoles' ? person.role end) or (location<>'Sucursal Centro' and coalesce(a->>'sharedRoutine','false')<>'true' and case when targeted then a->'employeeIds' ? person.employee_number else jsonb_array_length(coalesce(a->'employeeIds','[]'))=0 and a->'ownerRoles' ? person.role end);
  routine:=resolve_activity_routine(routine);
  -- Historial, aseos, procesos de Centro, encargos manuales y trabajo iniciado no se sustituyen.
  select coalesce(jsonb_agg(a),'[]') into revised from jsonb_array_elements(plan.slots)a where a->>'kind'<>'Actividad' or a->>'start'<clock or exists(select 1 from jsonb_array_elements(source_rows)cfg where lower(cfg->>'area') like '%aseo%' and (a->>'itemId'=cfg->>'id' or split_part(a->>'itemId','~',1)=cfg->>'id')) or not exists(select 1 from jsonb_array_elements(source_rows)cfg where a->>'itemId'=cfg->>'id' or split_part(a->>'itemId','~',1)=cfg->>'id') or exists(select 1 from activity_run_records r where r.employee_number=person.employee_number and r.record_date=today and coalesce(r.payload->>'startedAt','')<>'' and (r.payload->>'itemType'||'-'||(r.payload->>'itemId')=a->>'key' or coalesce(a->'aliases','[]') ? (r.payload->>'itemType'||'-'||(r.payload->>'itemId'))));
  for s in select a from jsonb_array_elements(routine)a where a->>'start'>=clock and lower(a->>'area') not like '%aseo%' loop
   if exists(select 1 from jsonb_array_elements(revised)a where a->>'key'='Actividad-'||(s->>'id')) then continue;end if;
   revised:=revised||jsonb_build_array(jsonb_build_object('key','Actividad-'||(s->>'id'),'kind','Actividad','itemId',s->>'id','title',s->>'name','start',s->>'start','end',s->>'end','instructions',coalesce(s->>'objective','')||' '||coalesce(s->>'instructions',''),'evidence',coalesce(s->>'evidence','none'),'slaMinutes',s->'durationMinutes'));
  end loop;
  select coalesce(jsonb_agg(a order by a->>'start',a->>'key'),'[]') into revised from jsonb_array_elements(revised)a;
  insert into daily_agenda_revisions(employee_number,day,branch,previous_slots,revised_slots) values(person.employee_number,today,location,plan.slots,revised) on conflict do nothing;
  update operation_day_plans p set slots=revised where p.employee_number=person.employee_number and p.day=today and p.branch=location;
 end loop;
end $$;
commit;
