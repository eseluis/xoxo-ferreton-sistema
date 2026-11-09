begin;
create table if not exists cleaning_recovery_deliveries(employee_number text not null,item_key text not null,original_day date not null,original_item jsonb not null,payload jsonb not null default '{}',status text not null default 'En curso',reviewer text,note text,updated_at timestamptz not null default now(),primary key(employee_number,item_key));
alter table cleaning_recovery_deliveries enable row level security;
revoke all on cleaning_recovery_deliveries from anon,authenticated;
create or replace function cleaning_recovery_queue() returns jsonb language plpgsql security definer set search_path=public as $$
declare actor text:=(current_profile()).employee_number;p record;i jsonb;r cleaning_recovery_deliveries;rows jsonb:='[]';today date:=(now() at time zone 'America/Mexico_City')::date;first_day date;manager boolean;proof jsonb;slot jsonb;
begin
 if actor is null then raise exception 'Sesión requerida';end if;
 manager:=actor in('001','002','003','009');select activated_on into first_day from cleaning_deadline_policy where id;
 for p in select employee_number,display_name from profiles where active and (manager or employee_number=actor) loop
  for i in select value from jsonb_array_elements(staff_week_items(p.employee_number,first_day,today,now() at time zone 'America/Mexico_City')) where value->>'cleaning'='true' and value->>'due'='true' and (value->>'completed'<>'true' or value->>'evidenceComplete'<>'true' or value->>'autoPoints'='1') loop
   select * into r from cleaning_recovery_deliveries where employee_number=p.employee_number and item_key=i->>'key';
   if r.item_key is null and i->>'completed'='true' and i->>'evidenceComplete'='true' then
    proof:=null;
    if i->>'source'='Centro' then select data into proof from centro_operation_records where day=(i->>'date')::date and owner_id=p.employee_number and task_id=substring(i->>'key' from 19);
    elsif i->>'source'='Agenda' then
     select value into slot from operation_day_plans d cross join lateral jsonb_array_elements(d.slots) where d.employee_number=p.employee_number and d.day=(i->>'date')::date and value->>'key'=substring(i->>'key' from 17);
     select a.payload into proof from activity_run_records a where a.employee_number=p.employee_number and a.record_date=(i->>'date')::date and ((a.payload->>'itemType')||'-'||(a.payload->>'itemId')=slot->>'key' or coalesce(slot->'aliases','[]') ? ((a.payload->>'itemType')||'-'||(a.payload->>'itemId'))) order by a.payload->>'completedAt' desc limit 1;
    elsif i->>'source'='Actividad' then select payload into proof from activity_run_records where employee_number=p.employee_number and record_id=substring(i->>'key' from 5);end if;
    if proof->>'cleaningFreshRecovery'='true' then
     insert into cleaning_recovery_deliveries(employee_number,item_key,original_day,original_item,payload,status) values(p.employee_number,i->>'key',(i->>'date')::date,i,jsonb_build_object('startedAt',proof->'cleaningRecoveryStartedAt','completedAt',coalesce(proof->'completedAt',proof->'cleaningCompletedAt'),'before',coalesce(proof->'beforeEvidenceCapture',jsonb_build_object('dataUrl',proof->>'fotoAntes')),'after',coalesce(proof->'afterEvidenceCapture',jsonb_build_object('dataUrl',proof->>'fotoDespues'))),'Por validar') on conflict do nothing;
     select * into r from cleaning_recovery_deliveries where employee_number=p.employee_number and item_key=i->>'key';
    end if;
   end if;
   rows:=rows||jsonb_build_array(i||jsonb_build_object('employee',p.employee_number,'name',p.display_name,'own',p.employee_number=actor,'delivery',case when r.item_key is null then null else to_jsonb(r) end,'exitTime',cleaning_exit_time(p.employee_number,today)));
  end loop;
 end loop;
 return jsonb_build_object('manager',manager,'actor',actor,'items',rows);
end $$;
create or replace function cleaning_recovery_action(person text,item_key text,action text,photo text default null,review_note text default '') returns void language plpgsql security definer set search_path=public as $$
declare actor text:=(current_profile()).employee_number;today date:=(now() at time zone 'America/Mexico_City')::date;i jsonb;r cleaning_recovery_deliveries;stamp timestamptz:=now();exit_time text;
begin
 if actor is null then raise exception 'Sesión requerida';end if;
 perform pg_advisory_xact_lock(hashtext('cleaning-redo:'||person||':'||item_key));
 select value into i from jsonb_array_elements(cleaning_recovery_queue()->'items') where value->>'employee'=person and value->>'key'=item_key;
 if i is null then raise exception 'Aseo pendiente no disponible para esta sesión';end if;
 select * into r from cleaning_recovery_deliveries where employee_number=person and cleaning_recovery_deliveries.item_key=cleaning_recovery_action.item_key for update;
 if action in('approve','reject') then
  if actor=person or not(actor='009' or (person='009' and actor in('001','002','003'))) then raise exception 'Julio valida los aseos de recuperación; su propio aseo lo valida un superior';end if;
  if r.status is distinct from 'Por validar' then raise exception 'Primero debe entregarse la recuperación con ambas fotos';end if;
  if length(trim(review_note))<5 then raise exception 'Escribe la observación de revisión';end if;
  update cleaning_recovery_deliveries set status=case action when 'approve' then 'Validada' else 'Devuelta' end,reviewer=actor,note=trim(review_note),updated_at=stamp where employee_number=person and cleaning_recovery_deliveries.item_key=cleaning_recovery_action.item_key;return;
 end if;
 if actor<>person then raise exception 'Sólo el colaborador asignado puede repetir el aseo';end if;
 exit_time:=cleaning_exit_time(actor,today);
 if exit_time is null or (now() at time zone 'America/Mexico_City')::time<exit_time::time then raise exception 'El aseo vencido se vuelve a abrir al terminar tu turno, a las %',exit_time;end if;
 if r.status in('Por validar','Validada') then raise exception 'La recuperación ya fue entregada; espera revisión de Julio';end if;
 if action='start' then
  if r.status='En curso' then return;end if;
  insert into cleaning_recovery_deliveries(employee_number,item_key,original_day,original_item,payload) values(person,item_key,(i->>'date')::date,i,jsonb_build_object('startedAt',stamp,'attempts',coalesce(r.payload->'attempts','[]')||case when r.item_key is null then '[]'::jsonb else jsonb_build_array(r.payload-'attempts') end)) on conflict on constraint cleaning_recovery_deliveries_pkey do update set payload=excluded.payload,status='En curso',reviewer=null,note=null,updated_at=stamp;return;
 end if;
 if r.status is distinct from 'En curso' then raise exception 'Primero inicia nuevamente el aseo y captura fotos nuevas';end if;
 if action in('before','after') then
  if photo is null or photo!~'^data:image/(jpeg|png|webp);base64,' or octet_length(photo)>250000 then raise exception 'Fotografía inválida o demasiado grande';end if;
  if action='after' and coalesce(r.payload#>>'{before,dataUrl}','')='' then raise exception 'Toma primero la foto de antes de realizar el aseo';end if;
  r.payload:=r.payload||jsonb_build_object(action,jsonb_build_object('dataUrl',photo,'capturedAt',stamp));
 elsif action='submit' then
  if coalesce(r.payload#>>'{before,dataUrl}','')='' or coalesce(r.payload#>>'{after,dataUrl}','')='' then raise exception 'Faltan ambas fotos nuevas: antes y después del aseo';end if;
  r.payload:=r.payload||jsonb_build_object('completedAt',stamp);r.status:='Por validar';
 else raise exception 'Acción inválida';end if;
 update cleaning_recovery_deliveries set payload=r.payload,status=r.status,updated_at=stamp where employee_number=person and cleaning_recovery_deliveries.item_key=cleaning_recovery_action.item_key;
end $$;
revoke all on function cleaning_recovery_queue(),cleaning_recovery_action(text,text,text,text,text) from public,anon;
grant execute on function cleaning_recovery_queue(),cleaning_recovery_action(text,text,text,text,text) to authenticated;
notify pgrst,'reload schema';commit;

