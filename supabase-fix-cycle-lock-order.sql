-- Apertura and Invewin touch several employees in different orders.
-- Acquire the same ordered set before taking any individual cycle lock.
begin;
create or replace function public.staff_lock_cycle_set(target_person text)
returns void language plpgsql security definer set search_path=public as $$
declare lock_key integer;
begin
 for lock_key in
  select distinct hashtext('staff-cycle-'||employee_number) from (
   select employee_number from profiles
   union select employee_number from staff_rest_settings
   union select target_person
  ) people where employee_number is not null order by 1
 loop
  perform pg_advisory_xact_lock(lock_key);
 end loop;
end $$;
revoke all on function public.staff_lock_cycle_set(text) from public,anon,authenticated;
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.staff_close_cycles(text)'::regprocedure);
 if position('staff_lock_cycle_set(person)' in definition)=0 then
  if position('perform pg_advisory_xact_lock(hashtext(''staff-cycle-''||person));' in definition)=0 then
   raise exception 'Unexpected staff_close_cycles definition; migration cancelled';
  end if;
  definition:=replace(definition,
   'perform pg_advisory_xact_lock(hashtext(''staff-cycle-''||person));',
   'perform public.staff_lock_cycle_set(person);');
  execute definition;
 end if;
end $migration$;
notify pgrst,'reload schema';
commit;
