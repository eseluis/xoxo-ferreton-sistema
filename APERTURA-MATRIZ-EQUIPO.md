# Apertura de Matriz en equipo

- Julio: puertas de entrada 07:45–08:00 y autorización expresa de cortinas y portón 07:45–08:00.
- Sabina: encender todos los equipos y abrir ERP Visorus 08:00–08:05.
- Jan: cortinas y portón 08:00–08:10, sólo después de la autorización.

Cada persona confirma su paso con sesión propia y hora del servidor. Se permite terminar tarde, registrando fuera de horario; no se permite adelantarlo. La gerencia confirma después la apertura al público con personal, seguridad y caja validados. Panel y Procesos usan el mismo registro.

Configuración → Responsables de apertura de Matriz permite a gerencia de Matriz y dirección cambiar los cuatro encargados entre colaboradores activos de Matriz. Los pendientes se reasignan con historial; los completados conservan su autor. Versiones y bloqueos protegen cambios simultáneos. Centro conserva su proceso anterior.

Aplicar supabase-matriz-opening-team.sql antes de publicar el cliente. La migración es repetible. Si la jornada ya tenía una apertura oficial antes de activar el rol, conserva esa apertura y empieza el equipo en la siguiente jornada. Cada nueva jornada inicia cuatro pasos pendientes, incluida la autorización.

Los registros alimentan automáticamente KPIs y evidencias con actividad, sucursal, horario y cumplimiento. No requieren fotografía adicional. La consulta directa y las evidencias respetan responsable/gerencia; el progreso compartido de apertura se muestra al equipo de Matriz por tratarse de una actividad conjunta.

Validación: npm run check, npm run test:opening, npm run test:opening-team, npm run test:system-kpis.
