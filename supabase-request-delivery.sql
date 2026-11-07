-- Confirmación real de solicitudes; resúmenes sólo para 001/002/003.
begin;
create or replace function request_director() returns boolean language sql stable security definer set search_path=public as $$select coalesce((current_profile()).employee_number in('001','002','003'),false)$$;
revoke all on function request_director() from public,anon;grant execute on function request_director() to authenticated;
create or replace function route_internal_summary() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.payload->>'type'='Reporte' then
  if coalesce(new.payload->>'recipientId','') not in('001','002','003') then new.payload:=new.payload||jsonb_build_object('originalRecipientId',coalesce(new.payload->>'originalRecipientId',new.payload->>'recipientId'),'recipientId','003','routingUpdatedAt',now());end if;
  new.payload:=new.payload||jsonb_build_object('recipientIds',jsonb_build_array('001','002','003'));
 end if;return new;
end $$;
revoke all on function route_internal_summary() from public,anon,authenticated;
drop trigger if exists internal_summary_routing on internal_request_records;create trigger internal_summary_routing before insert or update on internal_request_records for each row execute function route_internal_summary();
-- Se conserva el contenido y la respuesta de los registros existentes; sólo se agrega recepción/ruta.
update internal_request_records set payload=payload||jsonb_build_object('receivedAt',coalesce(payload->>'receivedAt',created_at::text),'receiptSource',coalesce(payload->>'receiptSource','Registro existente')) where coalesce(payload->>'receivedAt','')='' or payload->>'type'='Reporte' and (payload->'recipientIds' is distinct from '["001","002","003"]'::jsonb or payload->>'recipientId' not in('001','002','003'));
drop policy if exists internal_summary_read_boundary on internal_request_records;
create policy internal_summary_read_boundary on internal_request_records as restrictive for select to authenticated using(payload->>'type'<>'Reporte' or payload->>'requestedById'=(current_profile()).employee_number or request_director());
drop policy if exists internal_summary_update_boundary on internal_request_records;
create policy internal_summary_update_boundary on internal_request_records as restrictive for update to authenticated using(payload->>'type'<>'Reporte' or request_director()) with check(payload->>'type'<>'Reporte' or request_director());
drop policy if exists internal_summary_insert_boundary on internal_request_records;
create policy internal_summary_insert_boundary on internal_request_records as restrictive for insert to authenticated with check(payload->>'type'<>'Reporte' or payload->>'recipientId' in('001','002','003'));
drop policy if exists internal_summary_director_select on internal_request_records;
create policy internal_summary_director_select on internal_request_records for select to authenticated using(payload->>'type'='Reporte' and request_director());
drop policy if exists internal_summary_director_update on internal_request_records;
create policy internal_summary_director_update on internal_request_records for update to authenticated using(payload->>'type'='Reporte' and request_director()) with check(payload->>'type'='Reporte' and request_director() and employee_number=payload->>'requestedById' and updated_by=auth.uid());
drop policy if exists store_boundary on internal_request_records;
create policy store_boundary on internal_request_records as restrictive for all to authenticated using(can_manage_all() or branch=(current_profile()).branch or (current_profile()).employee_number in(payload->>'requestedById',payload->>'recipientId') or payload->>'type'='Reporte' and request_director()) with check(can_manage_all() or branch=(current_profile()).branch or (current_profile()).employee_number in(payload->>'requestedById',payload->>'recipientId') or payload->>'type'='Reporte' and request_director());
create or replace function sync_internal_request_records(records jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor profiles:=current_profile();item jsonb;saved internal_request_records;doc jsonb;result jsonb:='[]';owner text;receiver text;location text;is_summary boolean;can_read boolean;can_answer boolean;stamp timestamptz:=now();day date:=(now() at time zone 'America/Mexico_City')::date;
begin
 if actor.employee_number is null or auth.uid() is null then raise exception 'Sesión requerida';end if;
 if records is null or jsonb_typeof(records)<>'array' or jsonb_array_length(records)>500 or octet_length(records::text)>3000000 then raise exception 'Lista de solicitudes inválida';end if;
 for item in select value from jsonb_array_elements(records) loop
  if coalesce(item->>'id','')='' or length(item->>'id')>150 then raise exception 'Identificador de solicitud requerido';end if;
  perform pg_advisory_xact_lock(hashtext('internal-request-'||(item->>'id')));
  select * into saved from internal_request_records where record_id=item->>'id' for update;
  if found then
   is_summary:=saved.payload->>'type'='Reporte';
   can_read:=saved.payload->>'requestedById'=actor.employee_number or (is_summary and request_director()) or (not is_summary and (saved.payload->>'recipientId'=actor.employee_number or coalesce(saved.payload->>'confidentiality','Normal')<>'Confidencial' and can_manage_branch(saved.branch)));
   if not can_read then raise exception 'Sin permiso para esta solicitud';end if;
   -- El remitente puede reintentar: nunca vuelve a insertar ni pisa una respuesta ya recibida.
   if saved.payload->>'requestedById'=actor.employee_number and saved.payload->>'recipientId'<>actor.employee_number then result:=result||jsonb_build_array(saved.payload);continue;end if;
   if (saved.payload-array['branch','receivedAt','receiptSource','recipientIds','originalRecipientId','routingUpdatedAt'])=(item-array['branch','receivedAt','receiptSource','recipientIds','originalRecipientId','routingUpdatedAt']) then result:=result||jsonb_build_array(saved.payload);continue;end if;
   can_answer:=case when is_summary then request_director() else saved.payload->>'recipientId'=actor.employee_number or coalesce(saved.payload->>'confidentiality','Normal')<>'Confidencial' and can_manage_branch(saved.branch) end;
   if not can_answer then raise exception 'Sólo el destinatario autorizado puede responder';end if;
   if item->>'status' not in('Abierta','En revision','Atendida','Cerrada') or length(coalesce(item->>'response',''))>10000 then raise exception 'Respuesta o estado inválido';end if;
   doc:=saved.payload||jsonb_build_object('status',item->>'status','response',coalesce(item->>'response',''),'respondedById',actor.employee_number,'respondedAt',stamp);
   update internal_request_records set payload=doc,updated_at=stamp,updated_by=auth.uid() where record_id=saved.record_id returning * into saved;result:=result||jsonb_build_array(saved.payload);continue;
  end if;
  owner:=item->>'requestedById';receiver:=item->>'recipientId';is_summary:=item->>'type'='Reporte';
  if owner is distinct from actor.employee_number and not(owner='sistema' and can_manage_all()) then raise exception 'Sólo puedes enviar solicitudes con tu propio usuario';end if;
  if coalesce(item->>'type','') not in('Solicitud','Queja','Peticion','Reporte') or length(trim(coalesce(item->>'title','')))=0 or length(item->>'title')>300 or length(trim(coalesce(item->>'message','')))=0 or length(item->>'message')>10000 then raise exception 'Completa el tipo, asunto y mensaje';end if;
  if is_summary and coalesce(receiver,'') not in('001','002','003') then receiver:='003';end if;
  if not exists(select 1 from profiles where active and employee_number=receiver) then raise exception 'El destinatario no tiene un acceso activo. Selecciona a Dirección';end if;
  if coalesce(item->>'priority','') not in('Baja','Media','Alta','Critica') or coalesce(item->>'confidentiality','') not in('Normal','Confidencial') then raise exception 'Prioridad o confidencialidad inválida';end if;
  location:=work_branch(case when owner='sistema' then actor.employee_number else owner end,day);
  doc:=jsonb_build_object('id',item->>'id','type',item->>'type','title',trim(item->>'title'),'message',trim(item->>'message'),'requestedById',owner,'recipientId',receiver,'date',coalesce(nullif(item->>'date',''),day::text),'priority',item->>'priority','status','Abierta','confidentiality',item->>'confidentiality','response','','branch',location,'receivedAt',stamp,'receiptSource','Confirmado por servidor');
  if is_summary then doc:=doc||jsonb_build_object('recipientIds',jsonb_build_array('001','002','003'));end if;
  insert into internal_request_records(record_id,employee_number,branch,record_date,payload,updated_by) values(item->>'id',owner,location,(doc->>'date')::date,doc,auth.uid()) returning * into saved;result:=result||jsonb_build_array(saved.payload);
 end loop;return result;
end $$;
revoke all on function sync_internal_request_records(jsonb) from public,anon;grant execute on function sync_internal_request_records(jsonb) to authenticated;
notify pgrst,'reload schema';commit;
