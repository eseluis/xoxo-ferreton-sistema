-- UPSERT runs BEFORE INSERT even when it will update an existing record.
-- The subsequent UPDATE trigger still validates every protected payload field.
begin;
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.invewin_run_guard()'::regprocedure);
 if position('Existing protected row' in definition)=0 then
  if position(' if current_setting(''xoxo.invewin_write'',true)' in definition)=0 then
   raise exception 'Unexpected Invewin guard; migration cancelled';
  end if;
  definition:=replace(definition,
   ' if current_setting(''xoxo.invewin_write'',true)',
   ' -- Existing protected row: let ON CONFLICT reach its guarded UPDATE.
 if TG_OP=''INSERT'' and exists(select 1 from public.activity_run_records where record_id=new.record_id and payload->>''itemId''=''matriz-invewin-configuracion'') then return new;end if;
 if current_setting(''xoxo.invewin_write'',true)');
  execute definition;
 end if;
end $migration$;
notify pgrst,'reload schema';
commit;
