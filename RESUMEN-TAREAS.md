# Resumen de tareas y vencimientos

El panel inicial muestra todas las tareas visibles para el usuario, incluidas fechas anteriores, ordenando primero las vencidas. Se puede filtrar por colaborador, fechas, título o instrucciones, estado, tareas programadas para hoy o asignadas hoy.

Las tarjetas resumen muestran total, sin terminar, vencidas, pendientes, en proceso, completadas, pausadas e incidencias. Cada tarjeta filtra el detalle. Los conteos respetan el periodo, búsqueda y colaborador seleccionados; el filtro de estado afecta el detalle. Las vencidas se cuentan también en su estado actual. La evidencia obligatoria incompleta se muestra por separado y en cada fila.

Una tarea sin terminar vence cuando alcanza la hora final de su fecha programada, aunque no se haya iniciado. También vence si excede su SLA durante la ejecución. Se usa la hora de America/Mexico_City. El tiempo pausado se descuenta del SLA; una pausa o incidencia no elimina el vencimiento del horario programado. Las completadas no aparecen como vencidas. Los indicadores se actualizan cada 15 segundos.

La pantalla Tareas incluye el mismo resumen y los filtros Vencidas y Sin terminar, con el motivo de vencimiento en cada tarjeta. Se conservan los permisos existentes para ver y modificar tareas.

Esta actualización de resumen no necesita migraciones de base de datos. Los controles de salida y solicitudes requieren las migraciones separadas documentadas en CONTROL-SALIDA.md y no deben publicarse antes de activarlas.

Verificación: `node tests/task-overview.cjs`, `npm run check` y la página local `/tests/assignments.html` con datos en memoria.
