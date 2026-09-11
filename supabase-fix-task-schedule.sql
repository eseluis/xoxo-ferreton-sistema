begin;
-- Only assigned tasks reserve an extra slot. Default routines are not consulted.
create or replace function public.validate_assigned_task_schedule()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.payload->>'removedAt' is not null or new.payload->>'completedAt' is not null
    or new.payload->>'status'='Completada' then return new; end if;
  if tg_op='UPDATE' then
    if old.payload->>'completedAt' is null and old.payload->>'status' is distinct from 'Completada'
      and (old.payload->>'employeeId',old.payload->>'date',old.payload->>'start',old.payload->>'end')
        is not distinct from (new.payload->>'employeeId',new.payload->>'date',new.payload->>'start',new.payload->>'end')
    then return new; end if;
  end if;
  if coalesce(new.payload->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(new.payload->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or (new.payload->>'end') <= (new.payload->>'start') then
    raise exception 'Indica un horario válido: la hora final debe ser posterior a la inicial.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('xoxo.assigned-task-schedule',0));
  if exists (
    select 1 from public.daily_task_records other
    where other.record_id<>new.record_id
      and other.payload->>'employeeId'=new.payload->>'employeeId'
      and other.payload->>'date'=new.payload->>'date'
      and other.payload->>'removedAt' is null and other.payload->>'completedAt' is null
      and other.payload->>'status' is distinct from 'Completada'
      and new.payload->>'start' < other.payload->>'end'
      and new.payload->>'end' > other.payload->>'start'
  ) then
    raise exception 'El colaborador ya tiene una tarea asignada en ese horario. Solo se permite una tarea adicional; cambia el horario o retira la anterior.';
  end if;
  return new;
end $$;
revoke all on function public.validate_assigned_task_schedule() from public;
drop trigger if exists validate_assigned_task_schedule on public.daily_task_records;
create trigger validate_assigned_task_schedule before insert or update on public.daily_task_records
for each row execute function public.validate_assigned_task_schedule();
commit;
