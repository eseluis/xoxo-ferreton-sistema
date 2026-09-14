-- Ejecutar en Supabase SQL Editor antes de usar Piloto Dexter en producción.
-- La política restrictiva se suma a las políticas generales de app_state.
drop policy if exists app_state_dexter_003_only on public.app_state;
create policy app_state_dexter_003_only on public.app_state
as restrictive for all to authenticated
using (
  key <> 'xoxo.dexterPilot'
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.active and p.employee_number = '003'
  )
)
with check (
  key <> 'xoxo.dexterPilot'
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.active and p.employee_number = '003'
  )
);
