# Entrega diaria de área

Aplicar `supabase-area-handover.sql` después de las migraciones de permisos semanales, horario de aseo y agenda diaria. Publicar el frontend del mismo cambio.

Los perfiles activos JEFE_AREA reciben una tarea por jornada en su sucursal efectiva. Se programa en los últimos cinco minutos de la salida configurada para la fecha (asignación individual, excepción semanal o turno). No se genera en descanso salvo entrada registrada. La conciliación se ejecuta al capturar planes y al consultar el recordatorio; no requiere insertar tareas manualmente cada día.

El identificador es estable por fecha y colaborador. Un cambio de turno ajusta únicamente tareas sin iniciar; se conservan entregas y evidencias anteriores. El inicio se habilita a la hora programada. El servidor exige fotos del antes y resultado final de esa jornada y deja la entrega pendiente de validación del superior. La tarea participa en el seguimiento y KPIs existentes. No agrega bloqueo al registro de salida.
