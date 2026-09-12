# Evidencias, asignaciones e historial

## Activación

1. En el proyecto Supabase existente, confirmar que las migraciones base `supabase-stage2-modules.sql` y `supabase-fix-shared-sync.sql` ya están aplicadas. No volver a ejecutar la migración base sobre políticas nuevas.
2. Ejecutar `supabase-fix-assignments.sql` en el editor SQL. Conserva los registros; cambia los permisos de tareas y solicitudes y crea la función de guardado de asignaciones.
3. Publicar la aplicación actualizada después de aplicar la migración. No publicar primero: el cliente requiere `sync_assignment_records` y mostrará un aviso si falta.
4. Recargar las sesiones abiertas. Comprobar que cada colaborador tiene un perfil activo y que su número coincide con el directorio.

## Comprobación con dos cuentas

- Un superior asigna una tarea a un colaborador, con fecha y horario sin conflictos. Esperar la sincronización y comprobar la recepción en la cuenta del destinatario.
- El destinatario actualiza el avance; el superior debe ver el cambio. Si exige fotos, no debe poder completarse desde seguimiento sin ambas evidencias.
- Enviar una solicitud a otra cuenta. El destinatario debe verla, responderla y cambiar el estado; el remitente debe ver la respuesta.
- Comprobar que una solicitud confidencial solo es visible para remitente y destinatario, incluso frente a otros administradores.
- Filtrar tareas por rango de fechas, colaborador y estado. En solicitudes, el filtro de colaborador incluye remitente o destinatario.
- Abrir una evidencia, ampliar, ajustar y cerrar con Escape. Revisar evidencias de otro día en su galería.

## Verificación local

`npm run check` valida tipos y genera la compilación. Con `npm run dev`, `/tests/assignments.html` presenta datos de prueba en memoria para probar zoom y filtros sin autenticarse ni escribir en la nube. Esta página no forma parte de la compilación de producción.

Migración aplicada en Supabase el 10 de septiembre de 2026. Se verificaron permisos usando los perfiles 003 y 008 bajo el rol authenticated: asignación, recepción, finalización y lectura por el superior. La prueba se ejecutó en una transacción revertida, sin conservar registros ficticios.

El historial muestra los registros guardados y su estado actual; no reconstruye registros previamente eliminados ni es una bitácora de todas las modificaciones. Los cambios concurrentes sobre un mismo registro siguen requiriendo coordinación: este ajuste evita reenviar registros sin cambios, no implementa resolución de conflictos campo por campo.

## Corrección de actividades (10 de septiembre de 2026)

- Actividades y procesos guardan únicamente registros modificados, igual que tareas y solicitudes. La lista de cambios se captura antes de esperar la red y se conserva con el pendiente para sobrevivir a una recarga.
- Después de reenviar un pendiente se consulta el servidor para recibir también las asignaciones nuevas.
- Si falta la función de sincronización, actividades y procesos conservan el pendiente; no recurren a la función antigua que elimina y reemplaza registros.
- Las sesiones visibles consultan cada 15 segundos la última fecha de modificación de tareas, actividades, solicitudes y procesos. Solo descargan los registros y fotografías cuando detectan cambios; se mantiene la consulta general de respaldo cada cinco minutos.
- La carga inicial no reemplaza modificaciones realizadas mientras esperaba una respuesta.

Validación: `node tests/cloud-sync.cjs` reproduce el guardado desde dos sesiones, la recuperación de pendientes después de recargar y la ausencia de la función de sincronización. `npm run check` comprueba tipos y compilación.

La función sync_assignment_records y las políticas de asignaciones se aplicaron en producción. Se conservaron los conteos de 1 tarea, 52 solicitudes y 156 registros de actividad. El código se publica desde main mediante la integración existente con Vercel. La edición simultánea del mismo registro todavía no tiene resolución de conflictos por campo; las sesiones con versiones anteriores deben recargarse.

## Una tarea adicional por horario (11 de septiembre de 2026)

Las tareas asignadas pueden coincidir con las rutinas predeterminadas. Para todos los puestos se permite solo una tarea asignada pendiente por colaborador y horario; también se rechazan cruces parciales. Las tareas completadas o retiradas liberan el horario; las pausadas conservan su espacio. Una tarea puede comenzar exactamente cuando termina la anterior.

La validación se aplica al crear, asignar desde el panel, cambiar colaborador u horario y reabrir tareas. La migración `supabase-fix-task-schedule.sql` ya se aplicó en Supabase. Una prueba transaccional con el perfil 003 verificó alta, rechazo de cruces, horarios consecutivos, edición y liberación al retirar, sin conservar registros de prueba. `node tests/task-schedule.cjs` cubre los mismos límites del cliente.

## Marcador de aseo (12 de septiembre de 2026)

Nueva pantalla "Marcador de aseo", con acceso exclusivo a 001, 002, 003 y Julio (009); ningún otro puesto la ve, incluido Daniel (005) que sí tiene otros accesos ampliados en el sistema. Los 4 ven el marcador completo y los 4 pueden capturar calificación de calidad (a Julio se le habilitó explícitamente, no solo lectura).

Cada calificación registrada notifica automáticamente a 001, 002 y 003 (sin autonotificar a quien la capturó) mediante el módulo de Solicitudes existente, con el nombre real de quien calificó, a quién, el periodo y el puntaje.

- Puntos automáticos por cada bloque de aseo del calendario ya evidenciado con foto (antes/después, obligatoria para poder marcarlo completado): 2 puntos si se completó a tiempo, 1 si se completó con retraso, 0 si no se completó. Se calculan en vivo a partir de las actividades de aseo ya registradas; no requieren captura adicional.
- Cada superior agrega, aproximadamente cada 3 días, una calificación de calidad (10/8/6/4) por colaborador y por el periodo de fechas que elija, con una nota opcional. El marcador señala a quién le toca calificación (3 días o más desde la última, o nunca calificado).
- El total por colaborador es acumulado permanente (puntos automáticos de todo el historial + suma de todas las calificaciones de calidad); la sección "Detalle del periodo" muestra el desglose de a tiempo/con retraso/sin completar solo para el rango de fechas elegido.
- Quiénes aparecen en el marcador se calcula del calendario de actividades vigente (cualquier bloque cuya área contenga "Aseo"), no de una lista fija: si cambia el calendario de aseo, el marcador se ajusta solo.

Activación: ejecutar `supabase-fix-cleaning-evaluations.sql` en el editor SQL de Supabase (crea la tabla `cleaning_evaluation_records`, sus políticas y actualiza `sync_module_records`/`replace_module_records` para reconocer el nuevo módulo) y publicar la aplicación actualizada después. No publicar primero: el cliente requiere el módulo `cleaningEvaluations` reconocido por esas funciones.

Validación local: `node tests/cleaning-scoreboard.cjs` cubre los puntos automáticos (a tiempo/con retraso/sin completar), la suma por periodo, la acumulación de calidad y la aritmética de fechas. `npm run check` comprueba tipos y compilación. Falta la verificación en Supabase con varias cuentas (001/002/003 y Julio calificando, confirmar que las notificaciones llegan a los otros 3, y que 005 no ve la pantalla) una vez aplicada la migración.
