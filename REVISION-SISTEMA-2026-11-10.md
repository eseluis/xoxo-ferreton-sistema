Revisión del sistema — 10 de noviembre de 2026

Versión de aplicación comprobada: 3ebf163, publicada en xoxo-ferreton-sistema-w1dm.vercel.app.
Se ejecutaron 39 archivos de pruebas. Dos fallos iniciales eran del entorno: el cargador de pruebas no resolvía transactionRetry y la prueba de aseo mezclaba el reloj real con la fecha simulada. Ambas pruebas pasaron tras corregir el entorno. Las pruebas de permisos/ciclos e Invewin también pasaron con las migraciones aplicadas dos veces.

En producción se verificó navegación de asistencia, calendario, tareas, evidencias, caja, reportes internos, procesos, finanzas e indicadores, sin registrar checadas, aprobar entregas ni subir evidencias ficticias. La revisión no equivale a comprobar manualmente cada combinación de permisos y escritura.

Rubén (011): a las 09:33 el servidor confirmó horario 09:30–19:00, entrada registrada y presencia activa en Centro. La consulta con su identidad devolvió diez actividades propias: inventario-1, trafico-1, exhibicion, seguimiento, experiencia, preparacion, demostracion, contenido, manana y cierre. La comprobación se ejecutó dentro de una transacción con ROLLBACK. No se alteraron sus horarios, evidencias ni estados de cumplimiento.

Corrección de bloqueos aplicada en producción:
Los registros de PostgreSQL mostraron matriz_opening_context e invewin_context tomando en orden inverso los bloqueos staff-cycle-008 (3169663554) y staff-cycle-009 (3718501536). supabase-fix-cycle-lock-order.sql adquiere un conjunto uniforme y ordenado antes de cerrar ciclos individuales. Conserva las reglas y el historial de cumplimiento; puede hacer que operaciones concurrentes esperen brevemente su turno. El contador histórico no se reinicia.

Corrección de sincronización aplicada en producción:
Un pendiente antiguo de activityRuns intentaba actualizar sólo status/escalated de Invewin. INSERT ... ON CONFLICT ejecutaba el guard de inserción antes de llegar al guard de actualización. supabase-fix-invewin-upsert.sql permite alcanzar la actualización si ya existe la fila protegida; el guard de UPDATE sigue rechazando cambios de entrega, códigos y evidencias. Las pruebas demuestran recuperación de la escalación y rechazo de una entrega falsa o un registro nuevo. La sesión del panel se recuperó automáticamente: cero pendientes locales y cero avisos de error.

Las migraciones SQL se aplicaron y verificaron mediante el SQL Editor de Supabase. No requieren modificar las funciones de autenticación ni ampliar permisos.
