# Separación de Matriz y Sucursal Centro

Migración aplicada y función de accesos publicada en Supabase el 15 de octubre de 2026. Frontend incluido en esta publicación. Verificación en producción: Daniel tiene acceso a Centro, sin acceso global ni caja de Matriz; salarios ajenos ocultos y generalidades de ambas tiendas disponibles. Dirección conserva acceso global.

- Dirección, apoderada y administración general: ambas tiendas y reportes consolidados o por tienda.
- Gerencia de tienda (incluido Daniel): administración de su sucursal, reportes, caja, finanzas, equipo, accesos, calendario, evaluaciones y operación. Centro incluye validaciones, horarios individuales, aseo y piloto Dexter.
- Colaboradores: sus módulos autorizados y la ubicación asignada. Los traslados entre tiendas siguen a cargo de dirección.
- Generalidades compartidas: organigrama y directorio sin salarios ajenos; estado de apertura/cierre y nombres/puestos del personal presente en ambas tiendas. No incluye ventas, caja, evaluaciones ni evidencias de la otra tienda.
- Apertura Centro: 08:45–09:00, hora de Ciudad de México. Matriz conserva 08:00–08:15. Caja Centro debe estar lista antes de las 09:00.
- Las definiciones globales de turnos y el inicio del proyecto corporativo siguen reservadas a dirección; Daniel puede asignar los horarios diarios de su equipo de Centro.

## Activación

1. Conservar las migraciones actuales y ejecutar `supabase-branch-isolation.sql` al final en Supabase. Incluye los nuevos RPC, restricciones de filas, supervisión de Centro y las plantillas actualizadas de apertura. Es reaplicable y no elimina datos operativos.
2. Publicar la función `supabase/functions/manage-employee-access/index.ts` actualizada. La función anterior concede permisos de acceso por número de empleado y debe reemplazarse junto con la migración.
3. Compilar y publicar el frontend. Renovar las sesiones de Daniel y una cuenta directiva.
4. Comprobar con cuentas reales: Daniel puede operar Centro y no leer/modificar datos de Matriz; dirección ve ambas y sus consolidados; ambas cuentas ven el estado general compartido.

No publicar solo el frontend: la separación también requiere la migración y la función de accesos. Las migraciones anteriores que redefinen permisos deben ejecutarse antes de esta.

## Verificación local

`node tests/branch-isolation.cjs`: ejecución real de SQL en PostgreSQL (PGlite), reaplicación, lectura y escritura con rol autenticado, bloqueo de caja de Matriz para Daniel, acceso de dirección, ocultación de salarios ajenos, edición del equipo y bloqueo de escalación de puesto.

Además: compilación de producción, sincronización, solicitudes/confidencialidad, marcador de aseo, operación Centro y calendario.
