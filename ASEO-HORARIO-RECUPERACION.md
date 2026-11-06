# Aseo con horario y recuperación a la salida

La regla aplica desde la activación a los aseos pendientes de Matriz y Centro. Usa la hora de Ciudad de México del servidor. No se inventa una autorización ni una checada.

Antes de la hora configurada no se inicia. Al vencer el fin configurado, un aseo pendiente queda detenido, conserve o no un inicio. Ningún inicio, reanudación, foto nueva o entrega puede guardarse durante el bloqueo. Desde la mayor entre hora de salida asignada y fin del aseo, se habilita automáticamente el botón de recuperación; el colaborador debe pulsarlo, no se simula trabajo en cuanto llega la hora.

La salida se resuelve primero con la asignación individual de sucursal/turno del día, después con el turno del colaborador en Configuración. No se codifican 17:30 ni 19:00 como constantes. Hace falta entrada registrada, regreso de comida cuando corresponda y no tener ya una salida real. Se registra la salida real al terminar el trabajo. La recuperación conserva el vencimiento original, las fotos ya guardadas, la hora de recuperación y la entrega real. El tiempo de espera entre vencimiento y recuperación se descuenta del cronómetro activo. No se alteran nómina ni checadas desde este flujo.

Los pasos iniciados se pausan efectivamente al límite, aunque el primer refresco llegue después; el cliente muestra el bloqueo al alcanzar el límite con referencia del reloj del servidor y confirma en cada operación. Sin conexión no se presume guardado. La base bloquea APIs antiguas y escrituras directas del aseo. Las prioridades Cliente y Seguridad pueden detenerlo, pero no adelantan su recuperación. El historial controlado no puede borrarse desde el cliente. Un aseo de fecha anterior conserva su incumplimiento; requiere nueva asignación para regularizarse.

Matriz usa el mismo activity_run_records y las claves/alias de la agenda; Centro conserva centro_operation_records, validación del superior y las pantallas de Operación Centro/Registro diario. Centro fija al responsable del aseo vencido para que no desaparezca al terminar el turno. Las actividades de otras categorías conservan sus procesos.

Una recuperación terminada no gana puntualidad: vale como máximo 1 punto automático de aseo y conserva el incumplimiento del horario en KPIs/evidencias. Sigue necesitando fotos y validación para el mínimo semanal del 80%. Los cierres anteriores se conservan.

Aplicar supabase-cleaning-deadline.sql después de supabase-weekly-permissions.sql y módulos de Centro/calendario, antes de publicar. Conserva versiones privadas de los tres RPCs originales de Centro, revoca su acceso a clientes y adapta sólo aseo. Migración repetible, sin eliminar registros.

Pruebas: npm run test:cleaning-deadline, npm run test:permissions, npm run test:system-kpis, npm run check. Pruebas de horarios 08:10–08:30, salida A/B y cambio individual, pausas exactas, fotos conservadas, bloqueo de API, no duplicado, recuperación tardía y Centro fuera de turno.
