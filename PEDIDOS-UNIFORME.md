# Pedidos de Matriz y preparación de jornada

Activación: ejecutar `supabase-matriz-orders-uniform.sql` antes de publicar esta versión. La migración es aditiva y se puede ejecutar otra vez; no modifica asistencias anteriores. Los pedidos se generan desde la fecha de activación, sin inventar incumplimientos de fechas anteriores.

Lunes: Celina, electrodomésticos. Martes: Sabina, electricidad. Miércoles: Citlali, plomería. Jueves: Anubis, herramientas. Viernes: Julio, tornillería. Sábado: seguimiento de las cinco áreas. Horario: 10:00–11:00, Ciudad de México. Panel y Procesos comparten las mismas filas por día/área/paso; no se crea una instancia duplicada. Después de las 11:00 se permite subsanar la obligación, registrando el retraso.

El auxiliar activo en Matriz (entrada registrada, sin salida ni comida abierta), de la misma área o a cargo del responsable, realiza la detección. En ausencia de apoyo, el responsable absorbe ese paso. El cambio de disponibilidad preserva el inicio y el avance; los pasos terminados conservan la firma de quien los entregó. El jefe revisa y prepara el pedido; gerencia valida y gerencia general autoriza. Los pasos se desbloquean en secuencia y sólo puede firmarlos su responsable. Si no hay faltantes, se entrega el resultado y se registra `Sin pedido` como referencia. El sábado cada responsable documenta seguimiento y compromisos de sus pedidos de la semana.

Los jefes y auxiliares consultan únicamente sus pasos, resultados y evidencias. La información de autorizaciones superiores no se entrega en su contexto. Gerencia de la sucursal y dirección conservan la supervisión de acuerdo con sus permisos existentes. Un responsable trasladado fuera de Matriz no puede ejecutar el pedido; se muestra a gerencia la falta de cobertura.

Uniforme de hombres de lunes a domingo: negro, azul, rojo, verde, negro, azul, rojo. Mujeres: negro, azul, rojo, negro, azul, rojo, negro. Asignaciones confirmadas: Citlali, Sabina, Celina, Anubis y Zalma, mujeres; Jan, Rubén, Daniel y Julio, hombres. Las personas sin asignación utilizan provisionalmente colores comunes (sin verde), y gerencia puede asignar su rol desde el panel. Las preferencias no determinan ni modifican puestos, sueldos o permisos.

En cada entrada y salida se exige guardar el checklist de playera y, para jefes y auxiliares, cutter, flexómetro y guantes. Es posible declarar un faltante: se exige explicar la incidencia y se registra sin obligar a afirmar falsamente que se porta todo. El formulario de salida muestra la playera de mañana. Una revisión asociada a una checada registrada ya no es editable. Los registros de asistencia autorizados por dirección para otra persona conservan su mecanismo previo de excepción.

El servidor elige una fecha aleatoria de lunes a sábado por persona y semana. Se solicita una sola foto semanal, al azar en entrada o salida, mostrando uniforme y herramientas. Al contar con al menos una evidencia de la semana, dejan de pedirse fotos de uniforme hasta la semana siguiente. Si la persona no se presenta el día elegido, el requisito se traslada a su siguiente jornada dentro de esa semana. El momento elegido (entrada o salida) y la fecha permanecen guardados. Si se eligió entrada y ésta ya fue registrada, la muestra se solicita en la salida. La elección permanece guardada y no se cambia al recargar. No se envía al cliente la fecha futura seleccionada. No se puede exigir una foto de una semana sin ninguna jornada registrada.

Evidencias incluye descripción, sucursal, resultado y horario del pedido. Los checklists muestran su hora real; sin un horario laboral confirmado no se presume puntualidad. KPIs incorpora pasos programados, terminados, fuera de horario, conformidad declarada de herramientas/uniforme y fotos recibidas. Los KPIs reciben metadatos sin fotografías, notas privadas ni folios. No se deduce automáticamente la calidad visual de las fotos.

Verificación: `npm run check`, `npm run test:work-preparation`, `npm run test:system-kpis`, `npm run test:opening`, `npm run test:calendar`, `npm run test:centro`.

El aseo de Sucursal Centro puede iniciarse, pausarse y entregarse desde Registro diario. Se utiliza la misma actividad y versión del servidor que en Operación Centro, con las fotos de antes y después y los permisos de presencia y jerarquía vigentes. Los traslados a Centro ocultan el rol anterior de aseo de Matriz.

Para actualizar una instalación existente: ejecutar `supabase-weekly-uniform-photo.sql`. Las fotos recibidas y las checadas previas se conservan.
