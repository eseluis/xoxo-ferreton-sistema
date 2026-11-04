# Evidencias y KPIs automáticos

Aplicar `supabase-system-kpis.sql` después de las migraciones de Centro, calendario y separación de tiendas. No cambia actividades ni sus evidencias. Publicar el frontend junto con la migración.

Las evidencias muestran descripción, sucursal guardada, entrega y criterios de tiempo y forma. Se descuentan pausas del SLA. Una entrega sin fecha/inicio/horario suficiente queda no evaluable; una evidencia pendiente de validación no cuenta como validada. El inventario admite enlace Alegra POS o comentario, incluido Sin incidencias. La apertura compartida Panel/Procesos se toma una sola vez. No se deduce calidad visual de fotografías.

Los indicadores automáticos consultan el estado actual de los registros del periodo; no reconstruyen estados históricos pasados ni sustituyen metas manuales. Las ventas vienen de cortes ERP, no de depósitos ni de sumar ventas de Centro otra vez. Las diferencias de caja se suman en valor absoluto. Los campos sin información no se convierten en éxito.

`system_kpi_snapshot` usa permisos RLS del usuario y limita adicionalmente la consulta a registros propios o de su jerarquía/sucursal. Detecta tablas compatibles terminadas en `_records` con record_id, employee_number, branch, record_date y payload. Un módulo nuevo aparece en cobertura con volumen/estados; una regla particular se define en `src/systemKpis.ts`. Los controles de salida tienen adaptadores opcionales que respetan sus políticas originales. Los registros sin sucursal histórica no se atribuyen a otra sucursal.

Centro usa consultas específicas que sólo entregan registros propios a jefes y auxiliares; gerencia de Centro y dirección conservan supervisión. Los KPIs descargan metadatos, no fotos ni descripciones privadas. Las fotos sólo se consultan al abrir Evidencias.

Pruebas: `npm run test:system-kpis`, `npm run test:centro`, `npm run test:opening`, `npm run test:calendar` y `npm run check`.
