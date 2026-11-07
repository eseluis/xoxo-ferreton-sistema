# Reportes semanales y agendas

- Cada colaborador entrega su reporte en la última jornada antes de descansar. El servidor bloquea cualquier nueva salida del día si falta un reporte exigible desde la activación, también si se intenta desde otra sesión, un cliente antiguo o un registro directo. Los reportes vencidos no desaparecen al iniciar otra semana. No se altera ninguna salida ya confirmada.
- Entrega propia con resumen, pendientes (o sin incidencias), y al menos una evidencia descrita: imagen, enlace http(s), o copia de evidencias guardadas de sus actividades. El servidor toma el cumplimiento y las aperturas por fecha y sucursal de trabajo. Una apertura ausente se muestra sin registro. Se conserva el documento y las evidencias; una revisión del superior agrega auditoría y no cambia la entrega original. No se necesita aprobación ni un porcentaje mínimo para desbloquear este requisito de salida.
- Descansos conocidos se conservan. Los demás activos descansan domingo. Zalma sólo viernes/sábado/domingo: entrega domingo y descansa lunes a jueves. Los cambios autorizados de descanso tienen prioridad en el cómputo.
- Agendas operativas con vigencia desde 2026-11-07: exhibición general 09:30–10:00 y 16:00–17:00; Sabina/Jan mañana 09:00–09:30; Celina mañana 10:30–11:00. Citlali redes 10:00–11:00, publicaciones en primera media hora y planeación del siguiente día dentro del bloque. Audiovisual martes/miércoles/viernes 17:00–18:00; salida 19:00 esos días salvo asignación diaria explícita. Pedido de plomería miércoles 09:00–09:30, con control real del servidor y pasos previos; demás pedidos mantienen horario.
- Se reservan los bloques específicos frente a los bloques genéricos. Invewin sigue 11:00–12:30 hasta el 1 de diciembre. Los aseos conservan sus horas por instrucción expresa; los cruces se muestran para coordinar cobertura. No se marca trabajo como realizado por estar programado. Las agendas históricas guardadas se conservan.
- Atención inmediata al cliente en todo momento, antes de canalizar a caja. Mostradores limpios y libres salvo promociones/muestrarios. Sabina responde redes durante su turno y documenta pendientes al cierre. Incumplimientos quedan visibles para revisión humana; no hay sanciones automáticas.
- Reporte accesible en Panel y Registro diario; evidencias en su reporte y galería. KPIs incluyen reportes esperados, entregados, pendientes y con retraso sin exponer texto ni fotos al indicador.

## Suplencia de apertura de Matriz

Administradores, 001/002/003 y Julio (009) pueden ejecutar los cuatro pasos y reasignar encargados pendientes desde el proceso de apertura. Se conserva al encargado original y se acredita al ejecutor real, con hora del servidor. Cortinas/portón requieren autorización previa; se respetan horarios y verificaciones de caja/personal/seguridad. No se amplía acceso a movimientos de caja ni al cierre. Lo completado no se reasigna. El flujo de Centro conserva sus responsables y permisos.

## Instalación y verificación

Después de las migraciones existentes: `supabase-weekly-reports.sql`, `supabase-daily-agenda-policy.sql`, `supabase-opening-coverage.sql`. Para ejecutarlas desde SQL Editor con el guard de configuración, establecer dentro de la transacción la identidad del usuario autorizado de Dirección antes de las actualizaciones de app_state; no se incluyen credenciales en los archivos. Son idempotentes. No se borra información operacional.

`npm run check`, `npm run test:daily-operations`, `npm run test:permissions`, `npm run test:opening`, `npm run test:system-kpis`, `npm run test:invewin`. Las pruebas usan PGlite y datos ficticios, nunca checadas, reportes ni aperturas reales en producción.
