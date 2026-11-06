import { evidenceAssessment, type EvidenceFacts } from "./evidenceMetrics";
export type MetricRow = Record<string, any>;
export type MetricSource = { available: boolean; rows: MetricRow[]; error?: string };
export type MetricSources = Record<string, MetricSource>;
export type SystemMetric = { id: string; name: string; value: number|null; unit: string; source: string; detail: string; destination: string; problem?: boolean };
export const sourceInfo: Record<string,{name:string;destination:string;done?:string[];completionName?:string}> = {
 staff_permission_records:{name:"Permisos y descansos",destination:"solicitudes",completionName:"Solicitudes con decisión",done:["Autorizada","Rechazada"]},
 staff_cycle_records:{name:"Cierres por descanso",destination:"solicitudes"},
 attendance_exit_requests:{name:"Solicitudes de salida visibles",destination:"asistencia",completionName:"Solicitudes de salida respondidas",done:["Autorizada","Rechazada","Cerrada"]},
 attendance_exit_authorizations:{name:"Salidas excepcionales autorizadas",destination:"asistencia"},
 matriz_opening_step_records:{name:"Equipo de apertura Matriz",destination:"procesos",done:["Completada"]},
 matriz_order_records:{name:"Pasos de pedidos Matriz",destination:"panel",done:["Completada"]},
 work_readiness_records:{name:"Herramientas y uniforme",destination:"asistencia"},
 attendance_records:{name:"Asistencia registrada",destination:"asistencia"},
 daily_task_records:{name:"Tareas",destination:"tareas",done:["Completada"]},
 activity_run_records:{name:"Actividades y aseo",destination:"asistencia",done:["Completada","Completada con retraso"]},
 planned_activity_records:{name:"Agenda guardada",destination:"calendario",done:["Completada","Completada con retraso"]},
 process_instance_records:{name:"Procesos",destination:"procesos",done:["Completado"]},
 centro_records:{name:"Operación Centro",destination:"operacion-centro",done:["Validada"]},
 opening_records:{name:"Apertura compartida Panel / Procesos",destination:"procesos"},
 cash_cut_records:{name:"Cortes de caja",destination:"caja",done:["Aprobado"]},
 cash_session_records:{name:"Sesiones de caja",destination:"caja",done:["Cerrada","Aprobada"]},
 payable_records:{name:"Cuentas por pagar",destination:"finanzas",done:["Pagada"]},
 bank_transaction_records:{name:"Movimientos bancarios",destination:"bancos"},
 warranty_records:{name:"Garantías",destination:"garantias",completionName:"Garantías resueltas",done:["Resuelta"]},
 internal_request_records:{name:"Solicitudes visibles",destination:"solicitudes",done:["Atendida","Cerrada"]},
 process_audit_records:{name:"Auditorías",destination:"auditorias",done:["Cerrada"]},
 branch_opening_records:{name:"Expansión",destination:"expansion",done:["Abierta"]},
 evaluation_records:{name:"Evaluaciones",destination:"evaluacion"},
 cleaning_evaluation_records:{name:"Validaciones de aseo",destination:"marcador-aseo"},
 cash_incident_records:{name:"Incidencias de caja",destination:"caja"},
 supplier_records:{name:"Proveedores",destination:"finanzas"},
 bank_account_records:{name:"Cuentas bancarias",destination:"bancos"},
 monthly_budget_records:{name:"Presupuestos",destination:"tableroFinanciero"},
 kpi_records:{name:"Metas y capturas manuales",destination:"kpis"},
};
export function metricFacts(row:MetricRow): EvidenceFacts {
 return { ...row,status:row.status??"Pendiente",scheduled:row.start&&row.end?`${row.start}-${row.end}`:row.scheduledStart&&row.scheduledEnd?`${row.scheduledStart}-${row.scheduledEnd}`:undefined,
 requiresPair:row.requiresPhoto===true||row.evidence==="photo",requiresEvidence:row.requiresEvidence??(row.requiresPhoto===true||!!row.evidence&&row.evidence!=="none"), validationRequired:row.validationRequired===true };
}
export function systemMetrics(sources:MetricSources, now=new Date()): SystemMetric[] {
 const output:SystemMetric[]=[];
 const add=(source:string,id:string,name:string,value:number|null,unit:string,detail:string,problem=false)=>output.push({source,id,name,value,unit,detail,problem,destination:sourceInfo[source]?.destination??"kpis"});
 for(const [source,entry] of Object.entries(sources)) {
  if(!entry.available || ["kpi_records","planned_activity_records"].includes(source)) continue;
  const rows=entry.rows.filter(r=>!r.removedAt && !(source==="process_instance_records"&&r.processId==="apertura"));
  const rule=sourceInfo[source];
  add(source,source+"-count",rule?.name??source.replace(/_records$/," ").replace(/_/g," "),rows.length,"registros",`Registros del periodo a los que tienes acceso. ${rule?"":"Módulo detectado automáticamente; aún no tiene una regla de cumplimiento específica."}`);
  if(rule?.done) {
   const completed=rows.filter(r=>rule.done!.includes(r.status)).length;
   add(source,source+"-complete",rule.completionName??("Cumplimiento · "+rule.name),rows.length?completed/rows.length*100:null,"%",`${completed} terminados / ${rows.length} registros. ${source==="centro_records"?"Sólo Validada cuenta como cumplimiento; Por validar sigue pendiente.":"Los pendientes futuros no se consideran vencidos."}`);
  }
 }
 const cycles=sources.staff_cycle_records;
 if(cycles?.available){const rows=cycles.rows.filter(r=>!r.missingPlanDays);const total=rows.reduce((s,r)=>s+Number(r.total??0),0),validated=rows.reduce((s,r)=>s+Number(r.validated??0),0);add("staff_cycle_records","weekly-validated","Actividades hechas y validadas en ciclos cerrados",total?validated/total*100:null,"%",`${validated}/${total} obligaciones exigibles. ${cycles.rows.length-rows.length} cierres parciales excluidos por días sin plan. El mínimo de 80% orienta la decisión humana.`);}
 const readiness=sources.work_readiness_records;
 if(readiness?.available){const rows=readiness.rows;const toolRows=rows.filter(r=>r.toolsRequired);add("work_readiness_records","uniform-compliance","Uniforme conforme en checadas",rows.length?rows.filter(r=>r.uniformOk===true).length/rows.length*100:null,"%",`${rows.filter(r=>r.uniformOk===true).length}/${rows.length} revisiones respondidas. No se presume conformidad por una foto.`,rows.some(r=>r.uniformOk===false));add("work_readiness_records","tools-compliance","Herramientas completas en checadas",toolRows.length?toolRows.filter(r=>r.toolsOk===true).length/toolRows.length*100:null,"%",`${toolRows.filter(r=>r.toolsOk===true).length}/${toolRows.length} revisiones de jefes y auxiliares. Incidencias declaradas quedan registradas.`,toolRows.some(r=>r.toolsOk===false));add("work_readiness_records","weekly-photos","Evidencias semanales recibidas",rows.filter(r=>r.hasPhoto).length,"fotos","Fotos de entrada y salida de los días seleccionados; no se evalúa automáticamente su contenido.");}
 const orders=sources.matriz_order_records;
 if(orders?.available){const rows=orders.rows;const late=rows.filter(r=>evidenceAssessment(metricFacts(r),now).onTime===false);add("matriz_order_records","orders-overdue","Pasos de pedidos fuera de horario",late.length,"pasos","Incluye pasos no iniciados desde la activación del rol y entregas posteriores a las 11:00. Cada paso corresponde a su responsable.",late.length>0);}
 const tasks=sources.daily_task_records;
 const runs=sources.planned_activity_records?.available?sources.planned_activity_records:sources.activity_run_records;
 for(const [key,entry] of [["daily_task_records",tasks],["activity_run_records",runs],["centro_records",sources.centro_records],["matriz_opening_step_records",sources.matriz_opening_step_records]] as const) {
  if(!entry?.available) continue;
  const rows=entry.rows.filter(r=>!r.removedAt && r.affectsEvaluation!==false);
  const assessments=rows.map(row=>evidenceAssessment(metricFacts({...row,validationRequired:key==="centro_records"}),now));
  const finished=assessments.filter(a=>a.complete);
  const evaluable=finished.filter(a=>a.onTime!==null&&a.inForm!==null);
  const good=evaluable.filter(a=>a.onTime&&a.inForm).length;
  add(key,key+"-quality","En tiempo y forma · "+sourceInfo[key].name,evaluable.length?good/evaluable.length*100:null,"%",`${good}/${evaluable.length} entregas evaluables; ${finished.length-evaluable.length} entregas sin horario, fecha o validación suficientes.`,evaluable.some(a=>!a.onTime||!a.inForm));
  const overdue=assessments.filter(a=>!a.complete&&a.onTime===false).length;
  add(key,key+"-overdue","Vencidas sin terminar · "+sourceInfo[key].name,overdue,"actividades","Se compara fecha y hora de entrega en Ciudad de México; se descuentan pausas para el SLA.",overdue>0);
  const missing=finished.filter(a=>a.inForm===false).length;
  add(key,key+"-missing","Entregas con evidencia o requisitos faltantes · "+sourceInfo[key].name,missing,"actividades","No basta con marcar terminada: se revisan fotos requeridas y validación.",missing>0);
 }
 if(runs?.available) {
  const rows=runs.rows.filter(r=>r.affectsEvaluation!==false);
  add("activity_run_records","agenda-completed",(sources.planned_activity_records?.available?"Cumplimiento de la agenda guardada":"Cumplimiento de actividades registradas"),rows.length?rows.filter(r=>evidenceAssessment(metricFacts(r),now).complete).length/rows.length*100:null,"%",sources.planned_activity_records?.available?`${rows.length} obligaciones conocidas; incluye las que no se iniciaron. Sin plan guardado no se inventan obligaciones.`:"Historial parcial: sólo actividades que tienen registro. Falta agenda guardada para conocer las no iniciadas.");
 }
 const openings=sources.opening_records;
 if(openings?.available) {
  const opened=openings.rows.filter(r=>r.openedAt);
  const timely=opened.filter(r=>{const date=new Date(r.openedAt);if(!Number.isFinite(date.getTime()))return false;const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"America/Mexico_City",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(date);return r.branch==="Sucursal Centro"?parts>="08:45"&&parts<="09:00":parts>="08:00"&&parts<="08:15";});
  add("opening_records","opening-punctual","Aperturas puntuales",opened.length?timely.length/opened.length*100:null,"%",`${timely.length}/${opened.length} aperturas confirmadas. Panel y Procesos se cuentan una sola vez.`);
 }
 const cuts=sources.cash_cut_records;
 if(cuts?.available) {
  const rows=cuts.rows;
  add("cash_cut_records","sales","Ventas registradas en cortes",rows.length?rows.reduce((s,r)=>s+Number(r.erpSales??0),0):null,"$","Fuente: ventas ERP de cortes de caja. No suma depósitos bancarios ni ventas de Centro para evitar duplicarlas.");
  add("cash_cut_records","cash-difference","Diferencia absoluta de caja",rows.length?rows.reduce((s,r)=>s+Math.abs(Number(r.difference??0)),0):null,"$","Suma de diferencias absolutas; una diferencia positiva no cancela otra negativa.",rows.some(r=>Number(r.difference)!==0));
 }
 const banks=sources.bank_transaction_records;
 if(banks?.available) add("bank_transaction_records","bank-reconciled","Movimientos conciliados",banks.rows.length?banks.rows.filter(r=>r.reconciled===true).length/banks.rows.length*100:null,"%","Conciliación registrada en Bancos; transferencias internas no se interpretan como ventas.");
 const payables=sources.payable_records;
 if(payables?.available) {
  const cutoff=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const late=payables.rows.filter(r=>r.dueDate&&r.dueDate<cutoff&&Number(r.amount??0)>Number(r.paidAmount??0));
  add("payable_records","overdue-payables","Saldo vencido de cuentas del periodo",late.reduce((s,r)=>s+Math.max(0,Number(r.amount??0)-Number(r.paidAmount??0)),0),"$","Saldo actual de documentos capturados en el periodo; no representa toda la deuda histórica.",late.length>0);
 }
 const audits=sources.process_audit_records;
 if(audits?.available) { const total=audits.rows.reduce((s,r)=>s+Number(r.checksTotal??0),0),passed=audits.rows.reduce((s,r)=>s+Number(r.checksPassed??0),0);add("process_audit_records","audits-passed","Requisitos de auditoría cumplidos",total?passed/total*100:null,"%",`${passed}/${total} requisitos; excluye No aplica.`); }
 const attendance=sources.attendance_records;
 if(attendance?.available) {const entries=attendance.rows.filter(r=>r.in);add("attendance_records","attendance-closed","Jornadas con salida registrada",entries.length?entries.filter(r=>r.out).length/entries.length*100:null,"%",`${entries.filter(r=>r.out).length}/${entries.length} jornadas con entrada. No supone faltas ni retardos cuando no existe calendario laboral confirmado.`);}
 const evaluations=sources.evaluation_records;
 if(evaluations?.available){const values=evaluations.rows.map(r=>r.evaluationAverage).filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);add("evaluation_records","evaluation-average","Promedio de evaluaciones registradas",values.length?values.reduce((a,b)=>a+b,0)/values.length:null,"puntos",`${values.length} evaluaciones con criterios numéricos. No incluye criterios faltantes como cero.`);}
 const cleaning=sources.cleaning_evaluation_records;
 if(cleaning?.available){const values=cleaning.rows.map(r=>r.qualityScore).filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);add("cleaning_evaluation_records","cleaning-quality","Calidad de aseo evaluada",values.length?values.reduce((a,b)=>a+b,0)/values.length:null,"puntos","Promedio de la calidad capturada por responsables; no se deduce calidad visual de una foto.");}
 const centro=sources.centro_records;
 if(centro?.available){const reports=centro.rows.filter(r=>r.taskId==="atencion"&&r.visitors!==null&&r.visitors!==undefined&&r.buyers!==null&&r.buyers!==undefined);const visitors=reports.reduce((s,r)=>s+Number(r.visitors),0),buyers=reports.reduce((s,r)=>s+Number(r.buyers),0);add("centro_records","centro-conversion","Conversión registrada en Centro",visitors>0?buyers/visitors*100:null,"%",`${buyers} compradores / ${visitors} visitantes de ${reports.length} reportes capturados. Sin visitantes no se inventa una tasa.`);const inventories=centro.rows.filter(r=>String(r.taskId).startsWith("inventario-"));add("centro_records","centro-inventory","Revisiones de inventario validadas",inventories.length?inventories.filter(r=>r.status==="Validada").length/inventories.length*100:null,"%","Mide revisión y validación en Alegra POS; un comentario Sin incidencias no prueba por sí solo exactitud de inventario.");}
 return output;
}
