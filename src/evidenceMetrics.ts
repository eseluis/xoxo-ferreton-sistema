import { activeMinutes, type PriorityClock } from "./priorityPause";
export type EvidenceFacts = PriorityClock & {
 date?: string; scheduled?: string; status: string; requiresPair?: boolean; requiresEvidence?: boolean;
 before?: { dataUrl?: string }; after?: { dataUrl?: string }; single?: { dataUrl?: string };
 link?: string; links?: { label: string; url: string }[]; comment?: string; commentAccepted?: boolean;
 evidenceComplete?: boolean; slaMinutes?: number; submittedAt?: string; validationRequired?: boolean; windowStartRequired?: boolean;
};
export type EvidenceAssessment = { timing: string; form: string; result: string; tone: "ok"|"warn"|"danger"; complete: boolean; onTime: boolean|null; inForm: boolean|null; reasons: string[] };
export function evidenceAssessment(item: EvidenceFacts, now = new Date()): EvidenceAssessment {
 const complete = Boolean(item.completedAt || item.submittedAt || ["Completada","Completado","Completada con retraso","Por validar","Validada"].includes(item.status));
 const captured = item.evidenceComplete ?? (item.requiresPair ? Boolean(item.before?.dataUrl && item.after?.dataUrl) : Boolean(item.single?.dataUrl || item.before?.dataUrl || item.after?.dataUrl || item.link || item.links?.length || item.commentAccepted && item.comment?.trim()));
 const requires = item.requiresPair || item.requiresEvidence !== false;
 const reviewed = item.status === "Validada" || !item.validationRequired;
 const inForm = item.status === "Corrección" || item.status === "Incidencia" ? false : requires && !captured ? false : !reviewed ? null : complete ? true : null;
 const form = inForm === true ? "En forma" : inForm === false ? (item.status === "Corrección" ? "Requiere corrección" : "Falta evidencia o requisito") : !reviewed ? "Por validar" : "Pendiente de terminar";
 const reasons: string[]=[];
 const deadlineTime = item.scheduled?.match(/(?:–|-)\s*([0-2]?\d:[0-5]\d)\s*$/)?.[1];
 const deadline = item.date && deadlineTime ? Date.parse(`${item.date}T${deadlineTime.padStart(5,"0")}:00-06:00`) : NaN;
 const completed = Date.parse(item.completedAt ?? item.submittedAt ?? "");
 let onTime: boolean|null = null;
 if (complete) {
  if (Number.isFinite(deadline) && Number.isFinite(completed)) { onTime=completed<=deadline; if(!onTime) reasons.push("Se entregó después del horario previsto."); }
  const startTime=item.scheduled?.match(/^([0-2]?\d:[0-5]\d)/)?.[1];
  const windowStart=item.date&&startTime?Date.parse(`${item.date}T${startTime.padStart(5,"0")}:00-06:00`):NaN;
  if(item.windowStartRequired&&Number.isFinite(windowStart)&&Number.isFinite(completed)&&completed<windowStart){onTime=false;reasons.push("Se confirmó antes de la ventana autorizada.");}
  if(item.startedAt&&Number.isFinite(completed)&&Number.isFinite(Date.parse(item.startedAt))&&completed<Date.parse(item.startedAt)){onTime=null;reasons.push("Las fechas de inicio y entrega son inconsistentes.");}
  if(item.slaMinutes && (!item.startedAt || !Number.isFinite(Date.parse(item.startedAt)))) {if(onTime!==false)onTime=null;reasons.push("Falta el inicio verificable para evaluar el tiempo SLA.");}
  if (item.slaMinutes && item.startedAt && Number.isFinite(completed) && Number.isFinite(Date.parse(item.startedAt))) {
   const within=activeMinutes({...item,completedAt:new Date(completed).toISOString()},now.getTime())<=item.slaMinutes;
   if(!within){onTime=false;reasons.push("Excedió el tiempo activo permitido, descontando pausas.");}
   else if (!Number.isFinite(deadline)) { reasons.push("Cumplió el SLA; falta horario de entrega para evaluar puntualidad."); }
  }
 } else if(Number.isFinite(deadline) && now.getTime()>deadline) {onTime=false;reasons.push("El horario de entrega venció y la actividad sigue pendiente.");}
 if (complete && onTime===null) reasons.push("Falta horario o fecha de entrega; no se supone puntualidad.");
 if (inForm===false) reasons.push(form+".");
 if (item.validationRequired && !reviewed) reasons.push("La evidencia aún requiere revisión del responsable.");
 const result=!complete ? onTime===false ? "Vencida sin terminar" : "En seguimiento" : onTime===false || inForm===false ? "Fuera de tiempo o forma" : onTime===true && inForm===true ? "En tiempo y forma" : "No evaluable completamente";
 return {timing:onTime===true ? "En tiempo" : onTime===false ? "Fuera de tiempo" : complete ? "Tiempo no evaluable" : "En seguimiento",form,result,tone:onTime===false||inForm===false?"danger":onTime===true&&inForm===true?"ok":"warn",complete,onTime,inForm,reasons};
}
