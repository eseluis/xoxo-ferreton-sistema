# Operación diaria · Sucursal Centro

La pantalla **Operación Centro** aparece a quienes están asignados a Centro hoy y a dirección/003. Al registrar llegada se abre automáticamente. El resto del panel conserva tareas adicionales y el control autorizado de apertura/cierre.

## Uso

- Dirección/003: entrar a Operación Centro → Asignar sucursal y horario por día. Permite programar asignaciones futuras. Sin excepción diaria, se usa la sucursal y el turno del colaborador.
- Colaborador: registrar llegada; consultar Ahora, Después y la agenda. Iniciar, guardar avance, pausar por cliente/seguridad, retomar y enviar a validación. Las pausas por prioridad en tareas tradicionales descuentan el tiempo del cronómetro y pueden retomarse sin aprobación de incidencia.
- La rutina incluye 17 bloques, inventario de 50 códigos distintos, alternancia de aseo, propuestas de tráfico, proyecto de exhibición, seguimiento, experiencia, demostración, contenido, 3 propuestas para mañana y cierre.
- Con una persona, prospección digital/interior. El servidor bloquea dos salidas simultáneas. Al registrar una salida, comida o cambio de asignación, pausa actividades de personas no disponibles y convierte prospección sin cobertura a interior. El colaborador recibe la indicación de regresar; el software no detecta movimientos físicos sin registro.
- Dirección/003: consultar toda la operación, fecha histórica, evidencias y trazabilidad. Validar o devolver con motivo. Nadie valida su propia actividad. El gerente de tienda mantiene los permisos administrativos que ya tenía en el panel.
- Las tareas inconclusas conservan el avance al reasignarlas; los días anteriores no se sobrescriben. El reporte muestra seguimiento de los últimos 7 días y conserva proyectos terminados para excluirlos de la lista de mejoras pendientes.
- Evidencia mediante enlace a fotografía/video. El módulo no carga archivos en un servicio externo. Inventario registra corrección/seguimiento y evidencia por producto con diferencias.
- Centro obtiene reconocimiento de apertura entre 8:50 y 9:10; Matriz conserva su ventana anterior. Requiere venta/ERP, checklist y puertas abiertos. Los registros de apertura alimentan la alerta de 3 incumplimientos semanales; no hay descuentos económicos automáticos.

## Arquitectura y datos

- `src/centroOperation.ts`: catálogo de actividades, asignación por puesto/carga/horario, validaciones y métricas. Cada obligación tiene un ID estable independiente de los nombres.
- `src/centroStore.ts`: llamadas autenticadas a Supabase; los errores de guardado se muestran y no simulan éxito local.
- `src/CentroOperationView.tsx`: agenda, captura, revisión, consulta y reporte imprimible. Actualiza presencia y resultados cada 15 segundos mientras la pantalla está visible.
- `supabase-centro-operation.sql`: tablas nuevas, funciones autenticadas, control de concurrencia por versión, historial y reconciliación por cambios de asistencia/asignación. No borra datos existentes. Se puede reaplicar.
- Asignaciones diarias siguen en `xoxo.workLocations` con `start` y `end` opcionales. Los registros operativos se guardan individualmente, no como una lista global reemplazable.
- Las asignaciones sugeridas se recalculan en la interfaz; el servidor permite tomar obligaciones operativas a personal de Centro presente y con horario compatible, conserva exclusividad del responsable presente y registra las transferencias. Los procesos administrativos conservan sus autorizaciones existentes.
- No hay integración automática con Visorus para leer ventas, visitantes o existencias: se capturan en el módulo y la apertura usa la confirmación existente del panel.

## Activación y pruebas

Aplicar `supabase-centro-operation.sql` en el proyecto Supabase existente antes de publicar la aplicación. Requiere las tablas `profiles`, `app_state` y `attendance_records` instaladas. La migración restringe la escritura de asignaciones, turnos y directorio a dirección/003 y al administrador 005 ya autorizado.

Si cambia el catálogo: `node scripts/centro-templates.cjs` actualiza las definiciones incluidas en SQL; volver a aplicar la migración antes de publicar.

Verificaciones: `npm run check`, `npm run test:centro`, `node tests/work-focus.cjs`, `node tests/task-schedule.cjs`, `node tests/cloud-sync.cjs`, `node tests/cleaning-scoreboard.cjs`.

`tests/centro.html`, servido únicamente por Vite de desarrollo, permite revisar la interfaz con datos ficticios, cambiar a supervisor y simular personal reducido sin escribir en producción. No se incluye en el build.
