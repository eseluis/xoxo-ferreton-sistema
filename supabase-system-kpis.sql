-- Lecturas de KPIs sin fotografías ni textos privados; respeta RLS y jerarquía.
begin;
create or replace function public.system_metric_payload(p jsonb)
returns jsonb language sql immutable set search_path=public as $$
 select coalesce((select jsonb_object_agg(key,value) from jsonb_each(case when jsonb_typeof(p)='object' then p else '{}'::jsonb end) where key=any(array[
 'status','in','out','category','qualityScore','personalSales','salesGoal','startedAt','completedAt','pausedAt','pausedMinutes','slaMinutes','start','end','scheduledStart','scheduledEnd',
 'itemType','itemId','requiresPhoto','affectsEvaluation','removedAt','approvalStatus','processId','dueDate','issueDate','amount','paidAmount',
 'type','reconciled','hasInvoice','matches','difference','erpSales','cardTotal','transferTotal','operationalExpenses','providerPayments',
 'openedAt','closedAt','resolvedAt','createdAt','date','month','score','total','average','finalScore']) and jsonb_typeof(value) not in ('array','object')),'{}'::jsonb)
 || jsonb_build_object('evidence',case when p->>'evidence' in ('none','photo','signature','ticket') then p->>'evidence' end,'evaluationAverage',(select avg((v#>>'{}')::numeric) from jsonb_array_elements(case when jsonb_typeof(p->'scores')='array' then p->'scores' else '[]' end) v where jsonb_typeof(v)='number'),'evidenceComplete',case when coalesce(p->>'requiresPhoto','false')='true' or p->>'evidence'='photo'
 then coalesce(p#>>'{beforeEvidenceCapture,dataUrl}','')<>'' and coalesce(p#>>'{afterEvidenceCapture,dataUrl}','')<>''
 else coalesce(p#>>'{evidenceCapture,dataUrl}','')<>'' or coalesce(p->>'evidence','')~'^https?://' end,
 'stepsTotal',jsonb_array_length(case when jsonb_typeof(p->'stepStates')='array' then p->'stepStates' else '[]' end),
 'stepsDone',(select count(*) from jsonb_array_elements(case when jsonb_typeof(p->'stepStates')='array' then p->'stepStates' else '[]' end) s where s->>'done'='true'),
 'checksTotal',(select count(*) from jsonb_array_elements(case when jsonb_typeof(p->'checks')='array' then p->'checks' else '[]' end) s where s->>'result'<>'No aplica'),
 'checksPassed',(select count(*) from jsonb_array_elements(case when jsonb_typeof(p->'checks')='array' then p->'checks' else '[]' end) s where s->>'result'='Cumple') )
$$;
revoke all on function public.system_metric_payload(jsonb) from public,anon;
grant execute on function public.system_metric_payload(jsonb) to authenticated;

-- SECURITY INVOKER: los módulos actuales y nuevos conservan sus permisos de filas.
create or replace function public.system_kpi_snapshot(from_day date,to_day date)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare actor public.profiles; t record; rows jsonb; sources jsonb:='{}'; is_manager boolean; extra text;
begin
 actor:=public.current_profile();
 if actor.employee_number is null then raise exception 'Sesión requerida'; end if;
 if from_day is null or to_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Selecciona hasta 63 días'; end if;
 is_manager:=public.can_manage_all() or actor.role in ('GERENTE_TIENDA','ADMIN_TIENDA');
 for t in select table_name from information_schema.columns where table_schema='public' and table_name like '%\_records' escape '\'
 group by table_name having count(*) filter(where column_name in ('record_id','employee_number','branch','record_date','payload'))=5 loop
  if not has_table_privilege(current_user,format('public.%I',t.table_name),'SELECT') then
   sources:=sources||jsonb_build_object(t.table_name,jsonb_build_object('available',false,'rows','[]'::jsonb)); continue;
  end if;
  extra:=case when t.table_name='internal_request_records' then ' and (payload->>''requestedById''=$4 or payload->>''recipientId''=$4 or (coalesce(payload->>''confidentiality'',''Normal'')<>''Confidencial'' and ($3 or ($5 and branch=$6))))' else ' and ($3 or employee_number=$4 or ($5 and branch=$6))' end;
  begin
   execute format('select coalesce(jsonb_agg(public.system_metric_payload(payload)||jsonb_build_object(''id'',record_id,''employeeId'',employee_number,''branch'',branch,''date'',record_date)),''[]''::jsonb) from public.%I where record_date between $1 and $2',t.table_name)||extra
    into rows using from_day,to_day,public.can_manage_all(),actor.employee_number,is_manager,actor.branch;
   sources:=sources||jsonb_build_object(t.table_name,jsonb_build_object('available',true,'rows',rows));
  exception when insufficient_privilege or undefined_function or datatype_mismatch or invalid_parameter_value or undefined_column then sources:=sources||jsonb_build_object(t.table_name,jsonb_build_object('available',false,'rows','[]'::jsonb)); end;
 end loop;
 -- Adaptadores de control de salida: conservan las políticas propias del módulo.
 for t in select unnest(array['attendance_exit_requests','attendance_exit_authorizations']) as table_name loop
  if to_regclass('public.'||t.table_name) is null then
   sources:=sources||jsonb_build_object(t.table_name,jsonb_build_object('available',false,'rows','[]'::jsonb));continue;
  end if;
  if not has_table_privilege(current_user,format('public.%I',t.table_name),'SELECT') then
   sources:=sources||jsonb_build_object(t.table_name,jsonb_build_object('available',false,'rows','[]'::jsonb));continue;
  end if;
  if t.table_name='attendance_exit_requests' then
   execute 'select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''employeeId'',employee_number,''date'',day,''status'',status,''createdAt'',requested_at,''completedAt'',responded_at)),''[]''::jsonb) from public.attendance_exit_requests where day between $1 and $2' into rows using from_day,to_day;
  else
   execute 'select coalesce(jsonb_agg(jsonb_build_object(''id'',employee_number||''-''||day::text,''employeeId'',employee_number,''date'',day,''status'',''Autorizada'',''createdAt'',authorized_at)),''[]''::jsonb) from public.attendance_exit_authorizations where day between $1 and $2' into rows using from_day,to_day;
  end if;
  sources:=sources||jsonb_build_object(t.table_name,jsonb_build_object('available',true,'rows',rows));
 end loop;
 return jsonb_build_object('sources',sources,'generatedAt',now());
end $$;
revoke all on function public.system_kpi_snapshot(date,date) from public,anon;
grant execute on function public.system_kpi_snapshot(date,date) to authenticated;

create or replace function public.centro_kpi_snapshot(from_day date,to_day date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor public.profiles;
begin
 actor:=public.current_profile();
 if actor.employee_number is null then raise exception 'Sesión requerida'; end if;
 if from_day is null or to_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Selecciona hasta 63 días'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.task_id||'-'||r.day::text,'date',r.day,'branch','Sucursal Centro','employeeId',r.owner_id,'status',r.status,
 'taskId',r.task_id,'start',t.definition->>'start','end',t.definition->>'end','requiresEvidence',coalesce((t.definition->>'evidence')::boolean,false) or coalesce((t.definition->>'inventory')::boolean,false) or exists(select 1 from jsonb_array_elements(t.definition->'fields') f where f->>'type'='photo' and f->>'required'='true'),
 'evidenceComplete',case when coalesce((t.definition->>'inventory')::boolean,false) then coalesce(trim(r.data->>'pendientes'),'')<>'' or coalesce(r.data->>'evidence','')~'^https?://' or coalesce(r.data->>'fotoInventario','')~'^data:image/'
 when t.definition->>'category'='Aseo' then coalesce(r.data->>'fotoAntes','')~'^data:image/' and coalesce(r.data->>'fotoDespues','')~'^data:image/' else coalesce(r.data->>'evidence','')~'^https?://' end,
 'startedAt',(select h->>'at' from jsonb_array_elements(r.history) h where h->>'action'='start' order by h->>'at' limit 1),
 'completedAt',(select h->>'at' from jsonb_array_elements(r.history) h where h->>'action'='submit' order by h->>'at' desc limit 1),
 'visitors',r.data->'visitantes','buyers',r.data->'compradores','sales',r.data->'ventas','tickets',r.data->'tickets'))
 from public.centro_operation_records r join public.centro_task_templates t using(task_id) where r.day between from_day and to_day and (r.owner_id=actor.employee_number or public.centro_is_supervisor())),'[]'::jsonb);
end $$;
revoke all on function public.centro_kpi_snapshot(date,date) from public,anon;
grant execute on function public.centro_kpi_snapshot(date,date) to authenticated;

create or replace function public.system_centro_evidence(from_day date,to_day date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor public.profiles;
begin
 actor:=public.current_profile();
 if actor.employee_number is null then raise exception 'Sesión requerida'; end if;
 if from_day is null or to_day is null or to_day<from_day or to_day-from_day>62 then raise exception 'Selecciona hasta 63 días'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.task_id,'employeeId',r.owner_id,'kind','Centro','title',t.definition->>'title',
 'description',t.definition->>'instructions','branch','Sucursal Centro','date',r.day,'scheduled',(t.definition->>'start')||'-'||(t.definition->>'end'),
 'status',r.status,'requiresPair',t.definition->>'category'='Aseo','requiresEvidence',true,'validationRequired',true,
 'comment',coalesce(r.data->>'pendientes',r.data->>'incidencias'),'commentAccepted',coalesce((t.definition->>'inventory')::boolean,false),
 'link',case when r.data->>'evidence'~'^https?://' then r.data->>'evidence' end,
 'startedAt',(select h->>'at' from jsonb_array_elements(r.history) h where h->>'action'='start' order by h->>'at' limit 1),
 'submittedAt',(select h->>'at' from jsonb_array_elements(r.history) h where h->>'action'='submit' order by h->>'at' desc limit 1),
 'evidenceComplete',case when coalesce((t.definition->>'inventory')::boolean,false) then coalesce(trim(r.data->>'pendientes'),'')<>'' or coalesce(r.data->>'evidence','')~'^https?://' or coalesce(r.data->>'fotoInventario','')~'^data:image/'
 when t.definition->>'category'='Aseo' then coalesce(r.data->>'fotoAntes','')~'^data:image/' and coalesce(r.data->>'fotoDespues','')~'^data:image/' else coalesce(r.data->>'evidence','')~'^https?://' end,
 'pictures',coalesce((select jsonb_agg(jsonb_build_object('label',case pair.key when 'fotoAntes' then 'Antes' when 'fotoDespues' then 'Después' else 'Evidencia de inventario' end,'dataUrl',pair.value)) from jsonb_each_text(r.data) pair where pair.key in ('fotoAntes','fotoDespues','fotoInventario') and pair.value~'^data:image/(jpeg|png|webp);base64,'),'[]'::jsonb),
 'links',coalesce((select jsonb_agg(jsonb_build_object('label',pair.key,'url',pair.value)) from jsonb_each_text(r.data) pair where pair.key<>'evidence' and pair.value~'^https?://'),'[]'::jsonb)))
 from public.centro_operation_records r join public.centro_task_templates t using(task_id) where r.day between from_day and to_day and
 (r.owner_id=actor.employee_number or public.centro_is_supervisor()) and (t.definition->>'inventory'='true' or t.definition->>'evidence'='true' or t.definition->>'category'='Aseo' or r.data::text~'https?://')),'[]'::jsonb);
end $$;
revoke all on function public.system_centro_evidence(date,date) from public,anon;
grant execute on function public.system_centro_evidence(date,date) to authenticated;
notify pgrst,'reload schema';
commit;
