begin;
-- Preserve withdrawn records and their evidence instead of deleting them.
create or replace function public.archive_daily_task(task_id text, removal_note text)
returns void language plpgsql security invoker set search_path=public as $$
declare item jsonb; actor text;
begin
  actor := (public.current_profile()).employee_number;
  select payload into item from public.daily_task_records where record_id=task_id for update;
  if item is null then raise exception 'Tarea no encontrada o sin acceso'; end if;
  if not (coalesce(public.can_manage_all(),false) or coalesce(item->>'assignedById'=actor,false)) then
    raise exception 'No tienes permiso para quitar esta tarea';
  end if;
  if item->>'removedAt' is not null then return; end if;
  update public.daily_task_records set payload=item || jsonb_build_object(
    'removedAt',now(),'removedById',actor,'removalNote',coalesce(removal_note,'')),
    updated_at=now(),updated_by=auth.uid() where record_id=task_id;
end $$;
revoke all on function public.archive_daily_task(text,text) from public;
grant execute on function public.archive_daily_task(text,text) to authenticated;

-- A stale browser must not restore a withdrawn task when saving another item.
create or replace function public.protect_withdrawn_task()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.payload->>'removedAt' is not null then return old; end if;
  return new;
end $$;
drop trigger if exists protect_withdrawn_task on public.daily_task_records;
create trigger protect_withdrawn_task before update on public.daily_task_records
for each row execute function public.protect_withdrawn_task();
commit;
