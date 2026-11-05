-- Muestreo semanal de uniforme y herramientas: una imagen, entrada o salida al azar.
begin;
alter table public.work_photo_weeks add column if not exists selected_phase text not null default (case when random()<0.5 then 'in' else 'out' end) check(selected_phase in ('in','out'));
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

revoke all on function public.work_readiness_context() from public,anon;
grant execute on function public.work_readiness_context() to authenticated;
commit;
