-- Pedidos programados y preparación de jornada. No modifica asistencias históricas.
begin;
create table if not exists public.matriz_order_roster (
 area_id text primary key, area_name text not null, weekday integer not null check(weekday between 1 and 5),
 lead_id text not null, lead_name text not null
);
insert into public.matriz_order_roster values
 ('electrodomesticos','Electrodomésticos',1,'010','Celina'),('electricidad','Electricidad',2,'008','Sabina'),
 ('plomeria','Plomería',3,'015','Citlali'),('herramientas','Herramientas',4,'007','Anubis'),('tornilleria','Tornillería',5,'009','Julio')
on conflict(area_id) do update set area_name=excluded.area_name,weekday=excluded.weekday,lead_id=excluded.lead_id,lead_name=excluded.lead_name;
create table if not exists public.matriz_order_settings (id boolean primary key default true check(id), activated_on date not null default (now() at time zone 'America/Mexico_City')::date);
insert into public.matriz_order_settings(id) values(true) on conflict do nothing;
create table if not exists public.matriz_order_records (
 record_id text primary key, employee_number text not null, branch text not null default 'Matriz', record_date date not null,
 payload jsonb not null, updated_at timestamptz not null default now()
);
create table if not exists public.work_uniform_preferences (
 employee_number text primary key, variant text not null check(variant in ('Comun','Hombres','Mujeres')), updated_at timestamptz not null default now()
);
create table if not exists public.work_photo_weeks (
 employee_number text not null, week_start date not null, selected_day date not null, primary key(employee_number,week_start)
);
create table if not exists public.work_readiness_records (
 record_id text primary key, employee_number text not null, branch text not null, record_date date not null,
 payload jsonb not null, updated_at timestamptz not null default now()
);
alter table public.work_photo_weeks add column if not exists selected_phase text not null default (case when random()<0.5 then 'in' else 'out' end) check(selected_phase in ('in','out'));
alter table public.matriz_order_roster enable row level security;
alter table public.matriz_order_settings enable row level security;
alter table public.matriz_order_records enable row level security;
alter table public.work_uniform_preferences enable row level security;
alter table public.work_photo_weeks enable row level security;
alter table public.work_readiness_records enable row level security;
revoke all on public.matriz_order_roster,public.matriz_order_settings,public.matriz_order_records,public.work_uniform_preferences,public.work_photo_weeks,public.work_readiness_records from public,anon,authenticated;
grant select on public.matriz_order_roster,public.matriz_order_records,public.work_readiness_records to authenticated;
drop policy if exists roster_read on public.matriz_order_roster;
create policy roster_read on public.matriz_order_roster for select to authenticated using((public.current_profile()).employee_number is not null);
drop policy if exists orders_read on public.matriz_order_records;
create policy orders_read on public.matriz_order_records for select to authenticated using(employee_number=(public.current_profile()).employee_number or public.can_manage_branch(branch));
drop policy if exists readiness_read on public.work_readiness_records;
create policy readiness_read on public.work_readiness_records for select to authenticated using(employee_number=(public.current_profile()).employee_number or public.can_manage_branch(branch));

create or replace function public.work_branch(person text,day date)
returns text language sql stable security definer set search_path=public as $$
 select coalesce((select w->>'location' from app_state s cross join lateral jsonb_array_elements(s.value) w where s.key='xoxo.workLocations' and w->>'employeeId'=person and w->>'date'=day::text limit 1),(select branch from profiles where employee_number=person and active))
$$;
create or replace function public.work_uniform_color(variant text,day date)
returns text language sql immutable set search_path=public as $$
 select case when variant='Hombres' then (array['Negro','Azul','Rojo','Verde','Negro','Azul','Rojo'])[extract(isodow from day)::integer]
 else (array['Negro','Azul','Rojo','Negro','Azul','Rojo','Negro'])[extract(isodow from day)::integer] end
$$;

-- Reconciliación interna: claves por día/área/paso, sin duplicar ni borrar avances.
create or replace function public.matriz_orders_reconcile(day date)
returns void language plpgsql security definer set search_path=public as $$
declare r record; step integer; owner text; helper text; store_manager text; general_manager text; title text; order_key text; followup boolean; old_owner text;
begin
 if day<(select activated_on from matriz_order_settings limit 1) or extract(isodow from day)=7 then return; end if;
 perform pg_advisory_xact_lock(hashtext('matriz-orders-'||day::text));
 select employee_number into store_manager from profiles where active and branch='Matriz' and role in ('GERENTE_TIENDA','ADMIN_TIENDA','GERENTE_GENERAL') order by case role when 'GERENTE_TIENDA' then 1 when 'ADMIN_TIENDA' then 2 else 3 end,employee_number limit 1;
 select employee_number into general_manager from profiles where active and role='GERENTE_GENERAL' order by employee_number limit 1;
 followup:=extract(isodow from day)=6;
 for r in select * from matriz_order_roster where weekday=extract(isodow from day) or followup loop
  helper:=null;
  if day=(now() at time zone 'America/Mexico_City')::date then
   select p.employee_number into helper from profiles p
    join lateral(select value item from jsonb_array_elements(coalesce((select value from app_state where key='xoxo.collaborators'),'[]')) where value->>'id'=p.employee_number limit 1)c on true
    join attendance_records a on a.employee_number=p.employee_number and a.record_date=day
    where p.active and p.role='AUXILIAR' and public.work_branch(p.employee_number,day)='Matriz'
    and (c.item->>'supervisorId'=r.lead_id or lower(translate(coalesce(c.item->>'area',''),'áéíóú','aeiou')) like '%'||r.area_id||'%')
    and coalesce(a.payload->>'in','')<>'' and coalesce(a.payload->>'out','')=''
    and (coalesce(a.payload->>'lunchOut','')='' or coalesce(a.payload->>'lunchIn','')>coalesce(a.payload->>'lunchOut',''))
    order by p.employee_number limit 1;
  end if;
  for step in 1..case when followup then 2 else 5 end loop
   owner:=case when followup then r.lead_id when step=1 then coalesce(helper,r.lead_id) when step in (2,3) then r.lead_id when step=4 then coalesce(store_manager,general_manager,'SIN_GERENCIA') else coalesce(general_manager,'SIN_GERENCIA_GENERAL') end;
   title:=case when followup and step=1 then 'Consultar folios y estado de los pedidos de la semana' when followup then 'Registrar seguimiento con proveedor, pendientes y fecha compromiso'
    when step=1 then 'Detectar faltantes y contrastar existencias en Alegra POS'
    when step=2 then 'Revisar toda el área, cantidades y rotación'
    when step=3 then 'Preparar pedido formal con códigos, cantidades y folio o enlace'
    when step=4 then 'Validar stock, rotación y proveedor' else 'Autorizar compra antes de enviar al proveedor' end;
   order_key:=day::text||'-'||r.area_id||'-'||step;
   insert into matriz_order_records(record_id,employee_number,record_date,payload) values(order_key,owner,day,
    jsonb_build_object('id',order_key,'employeeId',owner,'branch','Matriz','date',day,'areaId',r.area_id,'area',r.area_name,'leadId',r.lead_id,'step',step,'title',title,'followup',followup,'status','Pendiente','start','10:00','end','11:00')) on conflict do nothing;
   -- Sólo el apoyo de detección cambia según presencia; los pasos entregados quedan firmados.
   if not followup and step=1 and day=(now() at time zone 'America/Mexico_City')::date then
    update matriz_order_records set employee_number=owner,payload=payload||jsonb_build_object('employeeId',owner),updated_at=now()
     where record_id=order_key and payload->>'status'<>'Completada' and employee_number<>owner;
   end if;
  end loop;
 end loop;
end $$;

create or replace function public.matriz_orders_context(day date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor profiles; rows jsonb; previous jsonb;
begin
 actor:=current_profile(); if actor.employee_number is null then raise exception 'Sesión requerida'; end if;
 if day<>(now() at time zone 'America/Mexico_City')::date then raise exception 'Consulta la jornada actual'; end if;
 perform matriz_orders_reconcile(day);
 select coalesce(jsonb_agg(r.payload||jsonb_build_object('available',not exists(select 1 from matriz_order_records p where p.record_date=r.record_date and p.payload->>'areaId'=r.payload->>'areaId' and (p.payload->>'step')::integer<(r.payload->>'step')::integer and p.payload->>'status'<>'Completada'),
 'ownerAvailable',public.work_branch(r.employee_number,day)='Matriz' and exists(select 1 from profiles where active and employee_number=r.employee_number)) order by r.record_id),'[]') into rows
 from matriz_order_records r where record_date=day and (employee_number=actor.employee_number or public.can_manage_branch('Matriz'));
 select coalesce(jsonb_agg(jsonb_build_object('date',r.record_date,'area',r.payload->>'area','title',r.payload->>'title','status',r.payload->>'status','note',r.payload->>'note','reference',r.payload->>'reference')),'[]') into previous
 from matriz_order_records r where extract(isodow from day)=6 and r.record_date>=date_trunc('week',day)::date and r.record_date<day and (r.employee_number=actor.employee_number or public.can_manage_branch('Matriz'));
 return jsonb_build_object('rows',rows,'week',previous,'today',day,'clock',to_char(now() at time zone 'America/Mexico_City','HH24:MI'));
end $$;

create or replace function public.matriz_order_action(id text,action text,note text default '',reference text default '')
returns void language plpgsql security definer set search_path=public as $$
declare actor profiles; r matriz_order_records; clock text; today date;
begin
 actor:=current_profile();today:=(now() at time zone 'America/Mexico_City')::date;clock:=to_char(now() at time zone 'America/Mexico_City','HH24:MI');
 if actor.employee_number is null then raise exception 'Sesión requerida'; end if;
 perform matriz_orders_reconcile(today);
 select * into r from matriz_order_records where record_id=id for update;
 if r.record_id is null or r.record_date<>today or r.employee_number<>actor.employee_number then raise exception 'Sólo el responsable puede realizar este paso'; end if;
 if public.work_branch(actor.employee_number,today)<>'Matriz' then raise exception 'Tu asignación de hoy no corresponde a Matriz'; end if;
 if clock<'10:00' then raise exception 'El pedido inicia a las 10:00'; end if;
 if r.payload->>'status'='Completada' then return; end if;
 if exists(select 1 from matriz_order_records p where p.record_date=today and p.payload->>'areaId'=r.payload->>'areaId' and (p.payload->>'step')::integer<(r.payload->>'step')::integer and p.payload->>'status'<>'Completada') then raise exception 'Primero debe terminarse el paso anterior'; end if;
 if action='start' then
  update matriz_order_records set payload=payload||jsonb_build_object('status','En proceso','startedAt',coalesce(payload->>'startedAt',now()::text)),updated_at=now() where record_id=id;
 elsif action='complete' then
  if r.payload->>'startedAt' is null then raise exception 'Primero inicia el paso'; end if;
  if length(trim(coalesce(note,'')))<10 then raise exception 'Describe el resultado, incluso si no hay faltantes o pedidos pendientes'; end if;
  if r.payload->>'step'='3' and coalesce(r.payload->>'followup','false')='false' and length(trim(coalesce(reference,'')))<3 then raise exception 'Registra folio o enlace del pedido; si no hay faltantes escribe Sin pedido'; end if;
  update matriz_order_records set payload=payload||jsonb_build_object('status','Completada','completedAt',now(),'note',left(note,4000),'reference',left(reference,2000),'completedBy',actor.employee_number,'onTime',clock<='11:00'),updated_at=now() where record_id=id;
 else raise exception 'Acción no permitida'; end if;
end $$;

create or replace function public.set_work_uniform(person text,variant text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if (current_profile()).employee_number is null or not exists(select 1 from profiles where employee_number=person and active and can_manage_branch(branch)) then raise exception 'Sin permiso'; end if;
 if variant not in ('Hombres','Mujeres','Comun') then raise exception 'Rol no válido'; end if;
 insert into work_uniform_preferences values(person,variant,now()) on conflict(employee_number) do update set variant=excluded.variant,updated_at=now();
end $$;

create or replace function public.work_readiness_context()
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor profiles; day date; wk date; selected date; chosen_phase text; effective_phase text; variant text; rows jsonb; team jsonb; photo_count integer; attendance jsonb;
begin
 actor:=current_profile(); if actor.employee_number is null then raise exception 'Sesión requerida'; end if;
 day:=(now() at time zone 'America/Mexico_City')::date;wk:=date_trunc('week',day)::date;
 insert into work_photo_weeks(employee_number,week_start,selected_day) values(actor.employee_number,wk,wk+floor(random()*6)::integer) on conflict do nothing;
 select selected_day,selected_phase into selected,chosen_phase from work_photo_weeks where employee_number=actor.employee_number and week_start=wk;
 select p.variant into variant from work_uniform_preferences p where employee_number=actor.employee_number;
 select coalesce(jsonb_agg(payload),'[]') into rows from work_readiness_records where employee_number=actor.employee_number and record_date=day;
 select count(*) into photo_count from work_readiness_records where employee_number=actor.employee_number and record_date between wk and day and coalesce(payload->>'photo','')<>'';
 select payload into attendance from attendance_records where employee_number=actor.employee_number and record_date=day limit 1;
 -- Si la entrada ya ocurrió sin muestra, recogerla en salida, nunca modificar una checada cerrada.
 effective_phase:=case when chosen_phase='in' and coalesce(attendance->>'in','')<>'' then 'out' else chosen_phase end;
 select coalesce(jsonb_agg(jsonb_build_object('employeeId',p.employee_number,'name',p.display_name,'variant',coalesce(u.variant,'Comun'),'branch',p.branch)),'[]') into team from profiles p left join work_uniform_preferences u using(employee_number) where p.active and (p.employee_number=actor.employee_number or can_manage_branch(p.branch));
 return jsonb_build_object('today',day,'variant',coalesce(variant,'Comun'),'color',work_uniform_color(variant,day),'tomorrowColor',work_uniform_color(variant,day+1),
 'toolsRequired',actor.role in ('JEFE_AREA','AUXILIAR'),'applicable',public.work_branch(actor.employee_number,day)<>'Corporativo',
 'entryPhotoRequired',photo_count=0 and day>=selected and effective_phase='in' and coalesce(attendance->>'in','')='',
 'exitPhotoRequired',photo_count=0 and day>=selected and effective_phase='out' and coalesce(attendance->>'out','')='',
 'weeklyEvidenceCount',photo_count,'weeklyEvidenceMet',photo_count>0,'rows',rows,'team',team);
end $$;

create or replace function public.save_work_readiness(phase text,checks jsonb,note text default '',photo text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor profiles; ctx jsonb; day date; key text; result jsonb; tools boolean; good boolean; existing jsonb; attendance jsonb;
begin
 actor:=current_profile(); ctx:=work_readiness_context(); day:=(ctx->>'today')::date;tools:=(ctx->>'toolsRequired')::boolean;
 if phase not in ('in','out') then raise exception 'Revisión no válida'; end if;
 perform pg_advisory_xact_lock(hashtext('readiness-'||actor.employee_number||day::text));
 key:=actor.employee_number||'-'||day::text||'-'||phase;
 select payload into existing from work_readiness_records where record_id=key;
 select payload into attendance from attendance_records where employee_number=actor.employee_number and record_date=day limit 1;
 if coalesce(attendance->>phase,'')<>'' then raise exception 'La revisión de una checada registrada ya no puede editarse'; end if;
 if phase='out' and coalesce(attendance->>'in','')='' then raise exception 'Registra primero tu entrada'; end if;
 if checks is null or jsonb_typeof(checks->'uniform') is distinct from 'boolean' or tools and (jsonb_typeof(checks->'cutter') is distinct from 'boolean' or jsonb_typeof(checks->'flexometro') is distinct from 'boolean' or jsonb_typeof(checks->'guantes') is distinct from 'boolean') then raise exception 'Responde todos los puntos del checklist'; end if;
 good:=(checks->>'uniform')::boolean and (not tools or (checks->>'cutter')::boolean and (checks->>'flexometro')::boolean and (checks->>'guantes')::boolean);
 if not good and length(trim(coalesce(note,'')))<10 then raise exception 'Describe la herramienta o uniforme faltante'; end if;
 if coalesce((ctx->>case phase when 'in' then 'entryPhotoRequired' else 'exitPhotoRequired' end)::boolean,false) and coalesce(photo,'')='' and coalesce(existing->>'photo','')='' then raise exception 'Hoy corresponde la foto semanal con uniforme y herramientas'; end if;
 if coalesce(photo,'')<>'' and (photo !~ '^data:image/(jpeg|png|webp);base64,' or length(photo)>1500000) then raise exception 'Usa una foto JPG, PNG o WebP de hasta 1 MB'; end if;
 result:=jsonb_build_object('id',key,'employeeId',actor.employee_number,'branch',public.work_branch(actor.employee_number,day),'date',day,'phase',phase,'title',case phase when 'in' then 'Herramientas y uniforme de entrada' else 'Herramientas y uniforme de salida' end,
 'checks',checks,'color',ctx->>'color','tomorrowColor',ctx->>'tomorrowColor','variant',ctx->>'variant','note',left(note,2000),'photo',coalesce(nullif(photo,''),existing->>'photo',''),'photoSubmittedAt',case when photo<>'' then now()::text else existing->>'photoSubmittedAt' end,
 'status',case when good then 'Conforme' else 'Incidencia' end,'completedAt',now());
 insert into work_readiness_records values(key,actor.employee_number,public.work_branch(actor.employee_number,day),day,result,now()) on conflict(record_id) do update set payload=excluded.payload,updated_at=now();
 return result;
end $$;

-- La checada exige respuestas verdaderas o una incidencia explicada, nunca una falsa conformidad.
create or replace function public.require_work_readiness()
returns trigger language plpgsql security definer set search_path=public as $$
declare phase text; actor profiles;
begin
 actor:=current_profile();
 if actor.employee_number is distinct from new.employee_number or public.work_branch(new.employee_number,new.record_date)='Corporativo' then return new; end if;
 foreach phase in array array['in','out'] loop
  if coalesce(new.payload->>phase,'')<>'' and (tg_op='INSERT' or coalesce(old.payload->>phase,'')='') and new.record_date=(now() at time zone 'America/Mexico_City')::date then
   if not exists(select 1 from work_readiness_records where employee_number=new.employee_number and record_date=new.record_date and payload->>'phase'=phase) then raise exception 'Completa y guarda el checklist de herramientas y uniforme antes de registrar la checada'; end if;
  end if;
 end loop;
 return new;
end $$;
drop trigger if exists attendance_work_readiness on public.attendance_records;
create trigger attendance_work_readiness before insert or update on public.attendance_records for each row execute function public.require_work_readiness();

create or replace function public.register_prepared_attendance(phase text,arrival jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor profiles; day date; clock text; ctx jsonb; saved jsonb; id text;
begin
 actor:=current_profile();if actor.employee_number is null then raise exception 'Sesión requerida'; end if;
 if phase not in ('in','out') then raise exception 'Checada no válida'; end if;
 day:=(now() at time zone 'America/Mexico_City')::date;clock:=to_char(now() at time zone 'America/Mexico_City','HH24:MI');
 perform pg_advisory_xact_lock(hashtext('attendance-'||actor.employee_number||day::text));
 select record_id,payload into id,saved from attendance_records where employee_number=actor.employee_number and record_date=day order by record_id limit 1 for update;
 if coalesce(saved->>phase,'')<>'' then return saved; end if;
 if phase='in' and public.work_branch(actor.employee_number,day)<>'Sucursal Centro' and clock>='08:45' then raise exception 'La entrada después de las 8:45 requiere autorización de dirección'; end if;
 if phase='out' and coalesce(saved->>'in','')='' then raise exception 'Registra primero tu entrada'; end if;
 ctx:=work_readiness_context();
 if (ctx->>'applicable')::boolean and not exists(select 1 from work_readiness_records where employee_number=actor.employee_number and record_date=day and payload->>'phase'=phase) then raise exception 'Completa y guarda el checklist antes de registrar la checada'; end if;
 -- Si está instalado el control de pendientes de salida, conserva su autorización.
 if phase='out' and to_regprocedure('public.register_attendance_exit()') is not null then
  execute 'select public.register_attendance_exit()' into saved; return saved;
 end if;
 saved:=coalesce(saved,jsonb_build_object('employeeId',actor.employee_number,'date',day,'branch',public.work_branch(actor.employee_number,day)))||jsonb_build_object(phase,clock);
 if phase='in' and arrival is not null then saved:=saved||jsonb_build_object('arrivalLocation',arrival);end if;
 insert into attendance_records(record_id,employee_number,branch,record_date,payload,updated_by) values(coalesce(id,actor.employee_number||'-'||day::text),actor.employee_number,public.work_branch(actor.employee_number,day),day,saved,auth.uid())
 on conflict(record_id) do update set payload=excluded.payload,updated_at=now(),updated_by=auth.uid();
 return saved;
end $$;

revoke all on function public.work_branch(text,date),public.matriz_orders_reconcile(date),public.require_work_readiness() from public,anon,authenticated;
revoke all on function public.work_uniform_color(text,date),public.matriz_orders_context(date),public.matriz_order_action(text,text,text,text),public.set_work_uniform(text,text),public.work_readiness_context(),public.save_work_readiness(text,jsonb,text,text),public.register_prepared_attendance(text,jsonb) from public,anon;
grant execute on function public.work_uniform_color(text,date),public.matriz_orders_context(date),public.matriz_order_action(text,text,text,text),public.set_work_uniform(text,text),public.work_readiness_context(),public.save_work_readiness(text,jsonb,text,text),public.register_prepared_attendance(text,jsonb) to authenticated;

-- Asignación confirmada por dirección; las demás personas mantienen el rol común.
insert into work_uniform_preferences(employee_number,variant)
select employee_number,case when employee_number in ('015','008','010','007') or lower(display_name) in ('zalma','salma') then 'Mujeres' else 'Hombres' end
from profiles where employee_number in ('015','008','010','007','006','011','005','009') or lower(display_name) in ('zalma','salma')
on conflict(employee_number) do nothing;
-- También conserva el rol de Zalma/Salma cuando su expediente aún no tenga acceso activo.
insert into work_uniform_preferences(employee_number,variant)
select item->>'id','Mujeres' from app_state s cross join lateral jsonb_array_elements(s.value) item
where s.key='xoxo.collaborators' and lower(trim(item->>'name')) in ('zalma','salma')
on conflict(employee_number) do nothing;

create or replace function public.work_preparation_metrics(from_day date,to_day date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor profiles; d date; orders jsonb; readiness jsonb;
begin
 actor:=current_profile(); if actor.employee_number is null then raise exception 'Sesión requerida'; end if;
 if from_day is null or to_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Selecciona hasta 63 días';end if;
 for d in select generate_series(greatest(from_day,(select activated_on from matriz_order_settings limit 1)),least(to_day,(now() at time zone 'America/Mexico_City')::date),'1 day')::date loop perform matriz_orders_reconcile(d);end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',record_id,'employeeId',employee_number,'date',record_date,'branch',branch,'status',payload->>'status','start','10:00','end','11:00','startedAt',payload->>'startedAt','completedAt',payload->>'completedAt','requiresEvidence',true,'evidenceComplete',length(coalesce(payload->>'note',''))>=10)),'[]') into orders
 from matriz_order_records where record_date between from_day and to_day and (employee_number=actor.employee_number or can_manage_branch(branch));
 select coalesce(jsonb_agg(jsonb_build_object('id',record_id,'employeeId',employee_number,'date',record_date,'branch',branch,'status',payload->>'status','phase',payload->>'phase','completedAt',payload->>'completedAt','hasPhoto',coalesce(payload->>'photo','')<>'','uniformOk',payload#>'{checks,uniform}',
 'toolsRequired',payload->'checks'?'cutter','toolsOk',coalesce((payload#>>'{checks,cutter}')::boolean,true) and coalesce((payload#>>'{checks,flexometro}')::boolean,true) and coalesce((payload#>>'{checks,guantes}')::boolean,true))),'[]') into readiness
 from work_readiness_records where record_date between from_day and to_day and (employee_number=actor.employee_number or can_manage_branch(branch));
 return jsonb_build_object('matriz_order_records',jsonb_build_object('available',true,'rows',orders),'work_readiness_records',jsonb_build_object('available',true,'rows',readiness));
end $$;

create or replace function public.work_preparation_evidence(from_day date,to_day date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor profiles; result jsonb;
begin
 actor:=current_profile();if actor.employee_number is null then raise exception 'Sesión requerida'; end if;
 if from_day is null or to_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Selecciona hasta 63 días';end if;
 select coalesce(jsonb_agg(item),'[]') into result from (
  select jsonb_build_object('id',record_id,'employeeId',employee_number,'date',record_date,'branch',branch,'kind','Proceso','title',payload->>'area'||' · '||(payload->>'title'),
   'description','Pedido programado de Matriz. Paso '||(payload->>'step')||': '||(payload->>'title'),'scheduled','10:00-11:00','status',payload->>'status','startedAt',payload->>'startedAt','completedAt',payload->>'completedAt',
   'recordProof',true,'requiresEvidence',true,'commentAccepted',true,'comment',coalesce(payload->>'note','')||case when coalesce(payload->>'reference','')<>'' then ' · Folio / enlace: '||(payload->>'reference') else '' end) item
   from matriz_order_records where record_date between from_day and to_day and (employee_number=actor.employee_number or can_manage_branch(branch))
  union all
  select jsonb_build_object('id',record_id,'employeeId',employee_number,'date',record_date,'branch',branch,'kind','Actividad','title',payload->>'title','description','Checklist de herramientas y uniforme. Playera: '||(payload->>'color')||'. Mañana: '||(payload->>'tomorrowColor')||'. Resultado: '||(payload->>'status'),
   'scheduled','Al registrar '||case when payload->>'phase'='in' then 'entrada' else 'salida' end,'status',case when payload->>'status'='Conforme' then 'Completada' else 'Incidencia' end,'completedAt',payload->>'completedAt',
   'recordProof',true,'requiresEvidence',false,'commentAccepted',true,'comment',coalesce(payload->>'note','')||' · '||(select string_agg(key||': '||case value when 'true'::jsonb then 'Sí' else 'No' end,', ') from jsonb_each(payload->'checks')),
   'single',case when coalesce(payload->>'photo','')<>'' then jsonb_build_object('dataUrl',payload->>'photo','capturedAt',payload->>'photoSubmittedAt') else null end) item
   from work_readiness_records where record_date between from_day and to_day and (employee_number=actor.employee_number or can_manage_branch(branch))
 ) records;
 return result;
end $$;
revoke all on function public.work_preparation_metrics(date,date),public.work_preparation_evidence(date,date) from public,anon;
grant execute on function public.work_preparation_metrics(date,date),public.work_preparation_evidence(date,date) to authenticated;
commit;
