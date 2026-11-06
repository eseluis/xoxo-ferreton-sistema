# Configuración de Invewin · Matriz

Actividad para jefes de área con sucursal efectiva Matriz: 11:00–12:30, desde la activación hasta el 1 de diciembre de 2026 inclusive. La totalidad de códigos debe estar dada de alta antes del 2 de diciembre. Cada jefe tiene meta mínima de 50 códigos diferentes en cada jornada laborable; se excluye su descanso configurado. Los cambios de sucursal se resuelven con work_branch.

Panel y Registro diario muestran el mismo proceso; calendario y configuración usan matriz-invewin-configuracion. Su vigencia no genera obligaciones después del 1 de diciembre. Mientras aplica, el bloque general de operación comienza a las 12:30; después vuelve a las 11:00.

Primero se trabaja y verifica el alta en Invewin. Este sistema no tiene conexión directa con su base ni ejecuta altas en el ERP. El registro de control conserva código, descripción, precio y cantidad de venta de cada producto, zona, referencia de comprobación y confirmación del jefe. Se puede pegar de Excel con cuatro columnas (tabuladores o punto y coma), sin encabezado; admite coma decimal y conserva ceros iniciales del código.

Sólo se abre una zona (anaquel o muestrario) a la vez. Se puede guardar avance parcial; para pasar a otra se confirma que la zona está completa. No se entrega el día sin 50 códigos distintos, todas las zonas cerradas y referencia verificable de Invewin. No se vuelven a contar códigos validados en otra entrega. El servidor vuelve a comprobar duplicados al validar, con bloqueo de concurrencia. Antes de las 11:00 no se inicia; después de las 12:30 se permite terminar con retraso registrado.

El superior coteja productos, datos y referencia antes de validar. La autovalidación y el marcado genérico de completada están bloqueados. Cada guardado tiene versión y auditoría. El avance validado alimenta el criterio semanal del 80% una sola vez mediante la ejecución canónica de agenda. Evidencias muestra actividad, sucursal, horario, códigos y referencia. KPIs muestra entregas validadas, códigos validados y puntualidad. El cierre anterior por descanso permanece inmutable.

El jefe puede declarar que terminó todos los productos de su área; el superior lo valida. El total de códigos validados no se presenta como porcentaje del catálogo completo sin una base maestra que determine ese total.

Instalación: aplicar supabase-invewin-matriz.sql después de calendario, permisos semanales y aseo; publicar cliente. La migración es repetible, conserva datos previos y añade el plan de hoy sin reemplazar las otras obligaciones. Historial por fecha en el módulo, incluso después de terminar la vigencia.

Pruebas: npm run test:invewin; npm run test:permissions; npm run test:system-kpis; npm run check.
