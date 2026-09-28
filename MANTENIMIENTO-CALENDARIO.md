# Plan, calendario y mantenimiento operativo

## Cambios

- Nueva pantalla **Plan y calendario**, accesible al colaborador para sus propios registros y a dirección/gerencia según permisos del servidor.
- Calendario mensual con detalle por hora. Verde: obligaciones registradas terminadas con evidencia/validación. Amarillo: pendientes dentro de horario, retrasos terminados o revisión pendiente. Rojo: obligaciones vencidas, correcciones o falta de evidencia. Gris: futuro, sin datos o historial parcial. El día actual es provisional. No mide rentabilidad ni genera descuentos.
- Se guarda una fotografía de la agenda (estructura, no imágenes) al iniciar la jornada con asistencia registrada. No se reconstruyen obligaciones antiguas usando el horario actual. Las tareas adicionales se leen con su fecha original; los apoyos sin evaluación no afectan el color. Los días sin sesión/plan guardado permanecen sin calificación completa.
- La programación futura es una previsión con la configuración vigente. Las asignaciones dinámicas de Centro se confirman según presencia; las obligaciones transferidas dejan de contarse al responsable anterior.
- Hitos de cinco meses y primeros 15 días visibles. Inicio predeterminado: 1 de octubre de 2026; modificable por dirección. Los hitos se convierten en tareas mediante el módulo existente, con responsable y horario; no se asignan automáticamente a todos los colaboradores.
- Aseo diario y sus referencias explícitas en el horario comparten una sola captura. Se conservan registros/evidencias de identificadores anteriores. Las actividades mixtas de orden/exhibición siguen separadas salvo la referencia explícita al aseo diario de Celina. No se borran tareas ni procesos históricos.
- Se muestran todas las asignaciones de aseo de la persona, no solo la primera. Fotos antes/después obligatorias; Centro incorpora selección de imágenes y validación de supervisor. El proceso antiguo `apertura-centro`, que repetía la jornada, ya no permite nuevas instancias desde el catálogo; las existentes se conservan.
- El marcador de aseo descuenta pausas del tiempo activo. El panel Ahora/Después y Registro diario usan la misma agenda.
- KPI diarios/semanales/mensuales tienen periodos independientes. Las capturas anteriores se conservan como periodos no confirmados; no se inventa su historia. Meta cero evaluada explícitamente y captura del resultado requerida. El guardado de KPI envía solo registros modificados.
- Transferencias entre bancos excluidas del gasto presupuestal. Datos comerciales ausentes y ratios sin denominador se muestran como sin captura/no calculables.

## Activación (antes de publicar el frontend)

1. Obtener el respaldo operativo habitual de Supabase.
2. Aplicar **supabase-centro-operation.sql** actualizado sobre el proyecto existente. Es la migración aditiva/reaplicable de Centro, ahora con ambas fotos en el catálogo de aseo.
3. Aplicar **supabase-operation-calendar.sql**. Crea `operation_day_plans`, `operation_project_config` y la función de consulta de Centro. Los planes diarios son inmutables, solo se insertan para el propio colaborador y el día actual. No reejecutar la migración base `supabase-stage2-modules.sql`.
4. Confirmar que `sync_module_records` está instalada (migración de sincronización existente); el cliente no utiliza reemplazo de listas para KPI.
5. Publicar la aplicación y recargar sesiones. Probar llegada, captura única de aseo, fotos, finalización/validación y calendario con una cuenta operativa y una supervisora.

La actualización local no aplica SQL ni publica automáticamente. Sin la migración del calendario, la interfaz muestra el error y no presenta el historial como confirmado.

## Verificación

- `npm run check`
- `npm run test:centro`
- `npm run test:calendar`
- `node tests/work-focus.cjs`
- `node tests/task-schedule.cjs`
- `node tests/cloud-sync.cjs`
- `node tests/cleaning-scoreboard.cjs`

`tests/calendar.html` es una demostración local con datos ficticios en memoria y no escribe en producción. No se incluye en la compilación publicada.

## Límites explícitos

El color corresponde a actividades/tareas de la agenda, no a todos los indicadores económicos ni a cada proceso independiente de la empresa. Un plan guardado conserva la rutina inicial de ese día; cambios posteriores a la configuración no reescriben ese histórico. Las tareas adicionales y transferencias de Centro sí se leen con su estado actual. Para corregir formalmente un plan congelado se requiere una futura revisión versionada, no editarlo silenciosamente.

El registro de aseo en Centro conserva su propia revisión y evidencias; el marcador tradicional de puntos mantiene como fuente los registros tradicionales de aseo. No se suman automáticamente puntos de Centro a ese marcador.
