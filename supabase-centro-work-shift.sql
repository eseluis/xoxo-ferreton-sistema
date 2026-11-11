-- Turno propio de Centro: conserva los turnos A y B de Matriz y las checadas reales.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from profiles where employee_number='003' and active),true);
update app_state set value=coalesce((select jsonb_agg(sh) from jsonb_array_elements(value)sh where sh->>'key'<>'Centro'),'[]'::jsonb)||jsonb_build_array(coalesce((select sh from jsonb_array_elements(value)sh where sh->>'key'='A' limit 1),'{}'::jsonb)||jsonb_build_object('key','Centro','name','Sucursal Centro','start','08:45','end','18:00','rotation','Horario de Sucursal Centro')),updated_at=now() where key='xoxo.shiftConfigs';
update app_state set value=(select jsonb_agg(case when c->>'branch'='Sucursal Centro' then jsonb_set(c,'{shift}','"Centro"'::jsonb) else c end) from jsonb_array_elements(value)c),updated_at=now() where key='xoxo.collaborators';
notify pgrst,'reload schema';
commit;
select centro_roster((now() at time zone 'America/Mexico_City')::date) as equipo_centro;
