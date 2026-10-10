Corrección de guardado de apertura y caja — 10 de octubre de 2026

La apertura se guardaba reemplazando toda la lista de app_state. Dos sesiones
podían sobrescribir campos o días guardados por otra. Caja también reenviaba
registros no modificados. Esto constituye un riesgo reproducible; no demuestra
por sí solo qué sucedió en la sesión de Daniel del 9 de octubre.

La nueva versión envía sólo los campos de la acción de apertura. La función
patch_store_opening_checks bloquea la fila y combina los cambios, conservando
los demás campos y días. Guarda explícitamente los borrados como null y conserva
los cambios pendientes para reintento tras recargar. Caja envía sólo filas
modificadas. Los pendientes se reintentan cada 30 segundos con sesión activa.

Activación requerida:
1. Ejecutar supabase-fix-opening-sync.sql en el SQL Editor del proyecto Supabase.
2. Publicar la aplicación con estos cambios y recargar las sesiones abiertas.
   La migración bloquea los reemplazos de apertura de versiones anteriores.
3. Verificar con gerente y cajero en dos sesiones: autorización de gerente,
   caja/ERP, proceso completo y puertas abiertas. Recargar ambas y comprobar
   todos los pasos y el historial del día anterior.

Si falta la migración, la aplicación mantiene la apertura pendiente y muestra
el error; no usa el reemplazo de la lista como alternativa.

Validación local: npm run check, node tests/cloud-sync.cjs y
node tests/opening-database.cjs. La prueba SQL aplica la migración dos veces,
combina acciones de sesiones, conserva el historial, permite borrados explícitos
y rechaza sucursales e identificadores inválidos.

No se reconstruyeron registros históricos ni se modificó producción.
