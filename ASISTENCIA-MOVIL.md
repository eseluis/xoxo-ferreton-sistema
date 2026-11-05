# Confirmación y actualización de asistencia

La entrada de Rubén del 5 de noviembre de 2026 está guardada a las 08:32, con creación y última actualización en servidor a las 08:32:30. El intento móvil fue reportado entre tres y cinco minutos antes. El registro existente no identifica dispositivo ni conserva evidencia de aquel primer intento; no se atribuye una causa de red sin esa evidencia ni se cambia retroactivamente su hora.

Había dos puntos débiles: el estado de asistencia de otras sesiones sólo se consultaba con el lote general cada cinco minutos, y la captura no mostraba una confirmación persistente ni un bloqueo de doble pulsación mientras esperaba al servidor. La versión anterior al RPC también podía mostrar una entrada local mientras su envío seguía pendiente.

La asistencia de hoy se consulta directamente al servidor cada 15 segundos, al volver a la pestaña, recuperar conexión o solicitar una comprobación manual. No utiliza la cola local como prueba de recepción, no depende de las descargas de fotografías ni de la pausa por ediciones de otros módulos. Una falla conserva la última consulta conocida y muestra el error. La consulta lenta ya no sustituye esta fuente con un estado local pendiente.

Entrada y salida muestran el estado de envío y sólo se presentan como confirmadas cuando el RPC devuelve el registro correspondiente o una lectura directa verifica que llegó. Si el móvil pierde la respuesta después de que el servidor guardó, se verifica el registro sin enviarlo otra vez. Se conserva la hora del primer registro. Una lectura iniciada antes de la checada no puede reemplazar su resultado, y los resultados de una sesión cerrada se descartan.

Aplicar `supabase-preserve-attendance-punches.sql` para que una cola de una versión antigua tampoco pueda borrar o reescribir las horas confirmadas. El trigger conserva los campos ya recibidos y permite completar los vacíos. No cambia RLS, no borra asistencias y no introduce horas de entrada de prueba en producción.

Validación: `npm run test:attendance`, `npm run test:centro-cleaning`, `npm run test:opening` y `npm run check`. Las pruebas cubren respuesta móvil perdida, falta real de recepción, reconexión, lecturas tardías, idempotencia del RPC y protección de horas existentes.
