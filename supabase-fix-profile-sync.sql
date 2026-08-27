-- Mantiene el catálogo de colaboradores y los permisos de acceso sincronizados.
create or replace function public.sync_profiles_from_collaborators()
returns trigger language plpgsql security definer set search_path=public as $$
declare item jsonb;
begin
  if new.key <> 'xoxo.collaborators' then return new; end if;
  for item in select value from jsonb_array_elements(new.value) loop
    update public.profiles
       set display_name = coalesce(item->>'name', display_name),
           role = coalesce(item->>'role', role),
           branch = coalesce(item->>'branch', branch),
           updated_at = now()
     where employee_number = item->>'id';
  end loop;
  return new;
end $$;

drop trigger if exists collaborators_profile_sync on public.app_state;
create trigger collaborators_profile_sync
after insert or update of value on public.app_state
for each row execute function public.sync_profiles_from_collaborators();

-- Corrige de inmediato los perfiles existentes con el catálogo vigente.
update public.profiles p
   set display_name = item->>'name', role = item->>'role', branch = item->>'branch', updated_at = now()
  from public.app_state s, lateral jsonb_array_elements(s.value) item
 where s.key = 'xoxo.collaborators' and p.employee_number = item->>'id';
