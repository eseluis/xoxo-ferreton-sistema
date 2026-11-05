-- Una sesión móvil antigua no debe sustituir checadas ya recibidas por el servidor.
-- No cambia registros previos ni permisos. Las nuevas checadas completan campos vacíos.
begin;
create or replace function public.preserve_attendance_punches()
returns trigger language plpgsql set search_path=public as $$
declare phase text;
begin
 foreach phase in array array['in','lunchOut','lunchIn','out'] loop
  if coalesce(trim(old.payload->>phase),'')<>'' then
   new.payload:=jsonb_set(new.payload,array[phase],old.payload->phase,true);
  end if;
 end loop;
 if coalesce(trim(old.payload->>'in'),'')<>'' and old.payload ? 'arrivalLocation' then
  new.payload:=jsonb_set(new.payload,'{arrivalLocation}',old.payload->'arrivalLocation',true);
 end if;
 return new;
end $$;
revoke all on function public.preserve_attendance_punches() from public,anon,authenticated;
drop trigger if exists attendance_preserve_confirmed_punches on public.attendance_records;
create trigger attendance_preserve_confirmed_punches before update on public.attendance_records
for each row execute function public.preserve_attendance_punches();
commit;
